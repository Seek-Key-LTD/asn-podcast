#!/usr/bin/env node
/**
 * 把一批剧集入库：音频上传 R2 + 目录写 D1。
 *
 * 用法：
 *   node scripts/ingest-episodes.mjs scripts/episodes.s1.json --dry-run
 *   node scripts/ingest-episodes.mjs scripts/episodes.s1.json
 *
 * 前置条件：
 *   - mc：已配置指向 R2 的别名（manifest.mcAlias 可覆盖）
 *   - wrangler：已登录，且对目标账号有 workers_kv:write + d1:write 权限
 *
 * 关于写 D1 的方式：`wrangler d1 execute --file` 没有绑定参数入口，值必须写进
 * SQL 字面量。SQLite 的字符串转义**只有单引号双写一条规则**（没有反斜杠转义），
 * 所以 `'` → `''` 是完备且安全的。但语句长度会随正文增长，因此有 90 KB 断言
 * （D1 上限 100 KB）。
 *
 * 幂等：全部 `ON CONFLICT DO NOTHING` 语义的 upsert。中途失败重跑即可收敛。
 */

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import process from 'node:process'

const AUDIO_TYPE_BY_EXTENSION = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
}

/** D1 单条语句上限 100 KB，留 10 KB 余量。 */
const MAX_STMT_BYTES = 90000

function inferAudioType(path) {
  const dot = path.lastIndexOf('.')
  return AUDIO_TYPE_BY_EXTENSION[dot === -1 ? '' : path.slice(dot).toLowerCase()] ?? 'audio/mpeg'
}

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 'S1E8.5' → 排序三件套 + 展示标签 + slug 片段的派生值。 */
function parseIssue(issueNo) {
  const m = /^S(\d+)E(\d+)(?:\.(\d+))?$/.exec(String(issueNo).trim())
  if (!m)
    throw new Error(`issue 格式无法解析（应为 S1E4 / S1E8.5）: ${issueNo}`)
  const season = Number(m[1])
  const major = Number(m[2])
  const minor = m[3] === undefined ? 0 : Number(m[3])
  return {
    season,
    major,
    minor,
    episodeNo: `S${pad2(season)}E${pad2(major)}${minor > 0 ? `.${minor}` : ''}`,
    slugPart: `s${pad2(season)}e${pad2(major)}${minor > 0 ? `.${minor}` : ''}`,
  }
}

function sqlStr(value) {
  if (value === null || value === undefined)
    return 'NULL'
  return `'${String(value).replace(/'/g, '\'\'')}'`
}

function sqlNum(value) {
  return value === null || value === undefined ? 'NULL' : String(value)
}

function parseArgs(argv) {
  const positional = argv.filter(a => !a.startsWith('--'))
  const flags = new Set(argv.filter(a => a.startsWith('--')))
  if (positional.length !== 1) {
    console.error('用法: node scripts/ingest-episodes.mjs <manifest.json> [--dry-run]')
    process.exit(1)
  }
  return { manifestPath: positional[0], dryRun: flags.has('--dry-run') }
}

const { manifestPath, dryRun } = parseArgs(process.argv.slice(2))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const {
  bucket,
  mcAlias = 'r2',
  publicBase,
  keyPrefix = '',
  dbName,
  env: runEnv = 'production',
  series,
  episodes,
} = manifest

for (const required of ['bucket', 'publicBase', 'dbName', 'episodes']) {
  if (!manifest[required]) {
    console.error(`manifest 缺少必填字段: ${required}`)
    process.exit(1)
  }
}
if (!series?.id || !series?.feedSlug || !series?.title) {
  console.error('manifest.series 需要 id / feedSlug / title')
  process.exit(1)
}

const workDir = mkdtempSync(join(tmpdir(), 'asn-ingest-'))
const normalizedPrefix = keyPrefix.replace(/^\/|\/$/g, '')
const normalizedBase = publicBase.replace(/\/$/, '')
const remoteFlag = '--remote'

console.info(`manifest : ${manifestPath}`)
console.info(`R2       : ${mcAlias}/${bucket}${normalizedPrefix ? `/${normalizedPrefix}` : ''}`)
console.info(`D1       : ${dbName} (env=${runEnv})`)
console.info(`系列     : ${series.id} (feed_slug=${series.feedSlug})`)
console.info(`剧集数   : ${episodes.length}${dryRun ? '  (dry-run，不写入)' : ''}\n`)

const statements = []
const seenIssues = new Set()

// 外键要先落 series 行，否则 episodes 的 INSERT 会被 FOREIGN KEY 拒掉
const now = Date.now()
statements.push(
  `INSERT INTO series (id,title,description,cover,feed_slug,sort_order,created_at,updated_at) VALUES (`
  + `${sqlStr(series.id)},${sqlStr(series.title)},${sqlStr(series.description ?? '')},`
  + `${sqlStr(series.cover ?? null)},${sqlStr(series.feedSlug)},${sqlNum(series.sortOrder ?? 0)},${now},${now}) `
  + `ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, `
  + `cover=COALESCE(excluded.cover, series.cover), feed_slug=excluded.feed_slug, sort_order=excluded.sort_order, `
  + `updated_at=excluded.updated_at`,
)

for (const episode of episodes) {
  const { issue, file, objectKey, title, intro = '', body = '', publishedAt, durationSec, legacySlug = null } = episode

  if (!issue || !file || !objectKey || !title || !publishedAt) {
    console.error(`剧集条目缺少必填字段（issue/file/objectKey/title/publishedAt）: ${JSON.stringify(episode).slice(0, 140)}`)
    process.exit(1)
  }
  if (seenIssues.has(issue)) {
    console.error(`${issue}: 与前面的剧集重复`)
    process.exit(1)
  }
  seenIssues.add(issue)

  const parsed = parseIssue(issue)
  const slug = `${series.feedSlug}/${parsed.slugPart}`
  const publishedMs = Date.parse(publishedAt)
  if (!Number.isFinite(publishedMs) || publishedMs < 1e12) {
    console.error(`${issue}: publishedAt 必须是带时区的 ISO 字符串（如 2026-09-15T02:00:00Z），收到 "${publishedAt}"`)
    process.exit(1)
  }

  const localSize = statSync(file).size
  const contentType = inferAudioType(objectKey)
  const remoteKey = normalizedPrefix ? `${normalizedPrefix}/${objectKey}` : objectKey
  const audioUrl = `${normalizedBase}/${remoteKey.split('/').map(encodeURIComponent).join('/')}`

  console.info(`── ${issue}  ${parsed.episodeNo}  ${title}`)
  console.info(`   slug : ${slug}${legacySlug ? `   legacy: ${legacySlug}` : ''}`)
  console.info(`   本地 : ${basename(file)}  ${(localSize / 1024 / 1024).toFixed(1)} MiB`)
  console.info(`   远端 : ${remoteKey}  (${contentType})`)

  if (dryRun) {
    console.info(`   [dry-run] mc cp --attr Content-Type=${contentType} …`)
    console.info(`   [dry-run] D1 upsert ${runEnv}|${slug}\n`)
    continue
  }

  run('mc', ['cp', '--attr', `Content-Type=${contentType}`, file, `${mcAlias}/${bucket}/${remoteKey}`])

  statements.push(
    `INSERT INTO episodes (env,slug,kind,date,legacy_slug,series_id,episode_no,season,episode_major,episode_minor,`
    + `title,summary,intro_content,blog_content,podcast_content,stories_json,tags_json,`
    + `audio_url,audio_bytes,duration_sec,published_at,updated_at) VALUES (${
      [
        sqlStr(runEnv),
        sqlStr(slug),
        sqlStr('series'),
        'NULL',
        sqlStr(legacySlug),
        sqlStr(series.id),
        sqlStr(parsed.episodeNo),
        sqlNum(parsed.season),
        sqlNum(parsed.major),
        sqlNum(parsed.minor),
        sqlStr(title),
        sqlStr(intro),
        sqlStr(intro),
        sqlStr(body),
        sqlStr(''),
        sqlStr('[]'),
        sqlStr('[]'),
        sqlStr(audioUrl),
        sqlNum(localSize),
        sqlNum(durationSec ?? null),
        sqlNum(publishedMs),
        sqlNum(now),
      ].join(',')}) ON CONFLICT(env,slug) DO UPDATE SET `
      + `title=excluded.title, summary=excluded.summary, intro_content=excluded.intro_content, `
      + `blog_content=excluded.blog_content, podcast_content=excluded.podcast_content, `
      + `audio_url=excluded.audio_url, audio_bytes=excluded.audio_bytes, `
      + `duration_sec=COALESCE(excluded.duration_sec, episodes.duration_sec), `
      + `legacy_slug=COALESCE(excluded.legacy_slug, episodes.legacy_slug), `
      + `updated_at=excluded.updated_at`,
  )

  console.info(`   ✓ 已上传 R2，D1 upsert 已排队\n`)
}

if (dryRun) {
  console.info(`dry-run 结束（${episodes.length} 期为只读演练，未上传也未写库）。`)
  process.exit(0)
}

for (const stmt of statements) {
  const bytes = Buffer.byteLength(stmt, 'utf8')
  if (bytes > MAX_STMT_BYTES) {
    console.error(`SQL 语句 ${bytes} 字节，超过 ${MAX_STMT_BYTES} 的安全线（D1 上限 100 KB）`)
    process.exit(1)
  }
}
const longest = Math.max(...statements.map(s => Buffer.byteLength(s, 'utf8')))

const sqlPath = join(workDir, 'ingest.sql')
writeFileSync(sqlPath, `${statements.join(';\n')};\n`, 'utf8')

console.info(`写入 D1（${statements.length} 条语句，最长 ${longest} 字节）…`)
run('npx', ['wrangler', 'd1', 'execute', dbName, remoteFlag, '--file', sqlPath])
console.info('完成。')
console.info('提示：线上页面有 revalidate 缓存（首页 600s / RSS 3600s / 单集 7200s），刷新不会立刻生效。')

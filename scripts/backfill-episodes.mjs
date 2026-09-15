#!/usr/bin/env node
/**
 * 把 KV 里的剧集目录回填进 D1。
 *
 * 用法：
 *   node scripts/backfill-episodes.mjs --dry-run            # 只打印派生结果与 SQL，不写
 *   node scripts/backfill-episodes.mjs --local              # 写本地 D1
 *   node scripts/backfill-episodes.mjs                      # 写远程 D1
 *   node scripts/backfill-episodes.mjs --verify             # 写完回读，逐字段比对
 *
 * 数据源是 **KV 的实值**，不是 scripts/episodes.s1.json。
 * 原因：历史记录的 `audio` URL 没有做过 encodeURIComponent，manifest 的拼接规则
 * 已经和它们不一致；从 manifest 重拼会改坏 URL。
 *
 * 幂等：全部走 `ON CONFLICT DO NOTHING`。重跑不会覆盖 workflow 后来更新的行，
 * 也不会因为半途失败而需要回滚——再跑一次就收敛。
 */

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// ---- 配置 ----------------------------------------------------------------

const KV_NAMESPACE_ID = '6a50d6f93dcc467a8552f889cd238da1'
const RUN_ENV = 'production'
const KV_PREFIX = `content:${RUN_ENV}:hacker-podcast:`

const DB_NAME = 'asn-podcast-db'

/** 系列标题 → 系列元数据。加新系列时在这里登记一行。 */
const SERIES_BY_TITLE = {
  '三更道场 · 第一季《寻舵》': {
    id: 'sangeng',
    title: '三更道场',
    feedSlug: 'sangeng',
    description: '深夜硬核学术闲聊。十八路主理人用物理第一性原理审计与历史会计复式记账，拆解被文人史学层层包裹的两千年旧账。',
    sortOrder: 0,
  },
}

/** 无法从 audio URL 的 last-modified 拿到时的兜底（毫秒）。 */
const FALLBACK_PUBLISHED_AT = Date.parse('2026-09-14T12:00:00Z')

// ---- 参数 ----------------------------------------------------------------

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const useLocal = argv.includes('--local')
const verify = argv.includes('--verify')
const remoteFlag = useLocal ? '--local' : '--remote'
const target = useLocal ? '本地' : '远程'

// ---- 工具 ----------------------------------------------------------------

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * wrangler 要走网络，偶发失败（超时、限流、连接重置）会让 execFileSync 直接抛，
 * 整个脚本带着堆栈崩掉。这里重试几次——读 KV、写 D1 都是幂等的，重试安全。
 */
function wrangler(args, attempts = 3) {
  let lastErr
  for (let i = 1; i <= attempts; i++) {
    try {
      return run('npx', ['wrangler', ...args])
    }
    catch (err) {
      lastErr = err
      const tail = String(err.stderr ?? err.stdout ?? err.message).trim().split('\n').slice(-3).join(' | ')
      if (i < attempts) {
        console.warn(`  wrangler 第 ${i} 次失败，重试中… (${tail.slice(0, 160)})`)
      }
      else {
        throw new Error(`wrangler ${args.slice(0, 3).join(' ')} 连续 ${attempts} 次失败: ${tail.slice(0, 300)}`)
      }
    }
  }
  throw lastErr
}

/** SQLite 字符串字面量转义：只认单引号双写，没有反斜杠转义。 */
function sqlStr(value) {
  if (value === null || value === undefined)
    return 'NULL'
  return `'${String(value).replace(/'/g, '\'\'')}'`
}

function sqlNum(value) {
  return value === null || value === undefined ? 'NULL' : String(value)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** 'S1E8.5' → { season: 1, major: 8, minor: 5, episodeNo: 'S01E08.5', slugPart: 's01e08.5' } */
function parseIssue(issueNo) {
  const m = /^S(\d+)E(\d+)(?:\.(\d+))?$/.exec(String(issueNo).trim())
  if (!m)
    return null
  const season = Number(m[1])
  const major = Number(m[2])
  const minor = m[3] === undefined ? 0 : Number(m[3])
  const episodeNo = `S${pad2(season)}E${pad2(major)}${minor > 0 ? `.${minor}` : ''}`
  const slugPart = `s${pad2(season)}e${pad2(major)}${minor > 0 ? `.${minor}` : ''}`
  return { season, major, minor, episodeNo, slugPart }
}

// ---- 读 KV ---------------------------------------------------------------

function listKvKeys() {
  const out = wrangler(['kv', 'key', 'list', '--namespace-id', KV_NAMESPACE_ID, '--prefix', KV_PREFIX, '--remote'])
  const start = out.indexOf('[')
  if (start === -1)
    throw new Error(`kv key list 未返回 JSON:\n${out.slice(0, 400)}`)
  return JSON.parse(out.slice(start)).map(k => k.name)
}

function getKvValue(key) {
  const out = wrangler(['kv', 'key', 'get', key, '--namespace-id', KV_NAMESPACE_ID, '--remote'])
  const start = out.indexOf('{')
  if (start === -1)
    throw new Error(`kv key get 未返回 JSON (${key}):\n${out.slice(0, 400)}`)
  return JSON.parse(out.slice(start))
}

/** 从音频文件的 last-modified 取真实发布时刻。取不到返回 null。 */
async function fetchPublishedAt(audioUrl) {
  try {
    const res = await fetch(audioUrl, { method: 'HEAD' })
    if (!res.ok)
      return null
    const lm = res.headers.get('last-modified')
    if (!lm)
      return null
    const t = Date.parse(lm)
    return Number.isFinite(t) ? t : null
  }
  catch {
    return null
  }
}

// ---- 派生行 ---------------------------------------------------------------

async function buildRows() {
  const keys = listKvKeys()
  console.info(`KV 里找到 ${keys.length} 条记录（前缀 ${KV_PREFIX}）`)

  const rows = []
  const seriesSeen = new Map()

  for (const key of keys) {
    const v = getKvValue(key)
    const seriesTitle = v.extra?.series_title
    const issue = v.issue_no ? parseIssue(v.issue_no) : null

    if (issue && seriesTitle) {
      const series = SERIES_BY_TITLE[seriesTitle]
      if (!series)
        throw new Error(`未知的系列标题 "${seriesTitle}"，请在 SERIES_BY_TITLE 里登记`)

      const publishedAt = (await fetchPublishedAt(v.audio)) ?? FALLBACK_PUBLISHED_AT
      seriesSeen.set(series.id, series)

      rows.push({
        kind: 'series',
        env: RUN_ENV,
        slug: `${series.feedSlug}/${issue.slugPart}`,
        legacySlug: v.date ?? null,
        seriesId: series.id,
        episodeNo: issue.episodeNo,
        season: issue.season,
        major: issue.major,
        minor: issue.minor,
        // audio_url 逐字保留，绝不用 manifest 的 base+key 重拼
        title: v.title,
        summary: v.introContent ?? '',
        introContent: v.introContent ?? '',
        blogContent: v.blogContent ?? '',
        podcastContent: v.podcastContent ?? '',
        storiesJson: JSON.stringify(v.stories ?? []),
        tagsJson: JSON.stringify(v.extra?.tags ?? []),
        audioUrl: v.audio,
        audioBytes: v.audioSize ?? null,
        durationSec: v.duration ?? null,
        publishedAt,
        updatedAt: v.updatedAt ?? publishedAt,
      })
    }
    else {
      if (!v.date)
        throw new Error(`既不是系列剧也没有 date，无法定位：${key}`)
      const publishedAt = Date.parse(`${v.date}T00:00:00Z`)
      rows.push({
        kind: 'daily',
        env: RUN_ENV,
        slug: v.date,
        legacySlug: null,
        seriesId: null,
        episodeNo: null,
        season: null,
        major: null,
        minor: null,
        title: v.title,
        summary: v.introContent ?? '',
        introContent: v.introContent ?? '',
        blogContent: v.blogContent ?? '',
        podcastContent: v.podcastContent ?? '',
        storiesJson: JSON.stringify(v.stories ?? []),
        tagsJson: JSON.stringify(v.extra?.tags ?? []),
        audioUrl: v.audio,
        audioBytes: v.audioSize ?? null,
        durationSec: v.duration ?? null,
        publishedAt,
        updatedAt: v.updatedAt ?? publishedAt,
      })
    }
  }

  // 系列剧按期次排序，日报按日期倒序
  rows.sort((a, b) => {
    if (a.kind !== b.kind)
      return a.kind === 'series' ? -1 : 1
    if (a.kind === 'series') {
      return (a.season - b.season) || (a.major - b.major) || (a.minor - b.minor)
    }
    return a.slug < b.slug ? 1 : -1
  })

  return { rows, seriesSeen: [...seriesSeen.values()] }
}

// ---- 生成 SQL --------------------------------------------------------------

const MAX_STMT_BYTES = 90000 // D1 单条语句上限 100 KB，留 10 KB 余量

function buildSql(rows, seriesList) {
  const now = Date.now()
  const stmts = []

  for (const s of seriesList) {
    stmts.push(
      `INSERT INTO series (id,title,description,cover,feed_slug,sort_order,created_at,updated_at) VALUES (`
      + `${sqlStr(s.id)},${sqlStr(s.title)},`
      + `${sqlStr(s.description)},NULL,${sqlStr(s.feedSlug)},${sqlNum(s.sortOrder)},${now},${now}) `
      + `ON CONFLICT(id) DO NOTHING`,
    )
  }

  for (const r of rows) {
    stmts.push(
      `INSERT INTO episodes (env,slug,kind,date,legacy_slug,series_id,episode_no,season,episode_major,episode_minor,`
      + `title,summary,intro_content,blog_content,podcast_content,stories_json,tags_json,audio_url,audio_bytes,duration_sec,`
      + `published_at,updated_at) VALUES (${
        [
          sqlStr(r.env),
          sqlStr(r.slug),
          sqlStr(r.kind),
          r.kind === 'daily' ? sqlStr(r.slug) : 'NULL',
          sqlStr(r.legacySlug),
          sqlStr(r.seriesId),
          sqlStr(r.episodeNo),
          sqlNum(r.season),
          sqlNum(r.major),
          sqlNum(r.minor),
          sqlStr(r.title),
          sqlStr(r.summary),
          sqlStr(r.introContent),
          sqlStr(r.blogContent),
          sqlStr(r.podcastContent),
          sqlStr(r.storiesJson),
          sqlStr(r.tagsJson),
          sqlStr(r.audioUrl),
          sqlNum(r.audioBytes),
          sqlNum(r.durationSec),
          sqlNum(r.publishedAt),
          sqlNum(r.updatedAt),
        ].join(',')}) ON CONFLICT(env,slug) DO NOTHING`,
    )
  }

  for (const stmt of stmts) {
    const bytes = Buffer.byteLength(stmt, 'utf8')
    if (bytes > MAX_STMT_BYTES) {
      throw new Error(`SQL 语句 ${bytes} 字节，超过 ${MAX_STMT_BYTES} 的安全线（D1 上限 100 KB）`)
    }
  }

  return stmts
}

// ---- 主流程 ---------------------------------------------------------------

const { rows, seriesSeen } = await buildRows()

console.info(`\n派生结果（${rows.length} 条）`)
console.info(`${'kind'.padEnd(7)}${'slug'.padEnd(22)}${'期次'.padEnd(10)}${'audioBytes'.padEnd(12)}published_at`)
console.info('-'.repeat(84))
for (const r of rows) {
  const when = new Date(r.publishedAt).toISOString()
  console.info(`${r.kind.padEnd(7)}${r.slug.padEnd(22)}${(r.episodeNo ?? '-').padEnd(10)}${String(r.audioBytes ?? '-').padEnd(12)}${when}`)
}

const stmts = buildSql(rows, seriesSeen)
const longest = Math.max(...stmts.map(s => Buffer.byteLength(s, 'utf8')))
console.info(`\n共 ${stmts.length} 条语句（含 ${seriesSeen.length} 条 series），最长 ${longest} 字节`)

if (dryRun) {
  console.info('\n--- SQL（dry-run，未写入）---')
  for (const s of stmts) console.info(`${s}\n`)
  console.info('dry-run 结束。')
  process.exit(0)
}

const workDir = mkdtempSync(join(tmpdir(), 'asn-backfill-'))
const sqlPath = join(workDir, 'backfill.sql')
writeFileSync(sqlPath, `${stmts.join(';\n')};\n`, 'utf8')

console.info(`\n写入${target} D1（${DB_NAME}）…`)
wrangler(['d1', 'execute', DB_NAME, remoteFlag, '--file', sqlPath])
console.info('写入完成。')

if (verify) {
  console.info('\n--- 回读校验 ---')
  const expect = new Map(rows.map(r => [`${r.env}|${r.slug}`, r]))
  const out = wrangler([
    'd1',
    'execute',
    DB_NAME,
    remoteFlag,
    '--json',
    '--command',
    `select env,slug,kind,episode_no,season,episode_major,episode_minor,audio_url,audio_bytes,duration_sec,`
    + `published_at,updated_at,legacy_slug from episodes order by kind, season, episode_major, episode_minor, slug`,
  ])
  const json = JSON.parse(out.slice(out.indexOf('[')))[0].results

  let bad = 0
  for (const got of json) {
    const want = expect.get(`${got.env}|${got.slug}`)
    if (!want) {
      console.error(`  ✗ D1 里有 KV 中没有的行: ${got.env}|${got.slug}`)
      bad++
      continue
    }
    const checks = [
      ['kind', want.kind, got.kind],
      ['episode_no', want.episodeNo, got.episode_no],
      ['season', want.season, got.season],
      ['episode_major', want.major, got.episode_major],
      ['episode_minor', want.minor, got.episode_minor],
      ['audio_url', want.audioUrl, got.audio_url],
      ['audio_bytes', want.audioBytes, got.audio_bytes],
      ['published_at', want.publishedAt, got.published_at],
      ['legacy_slug', want.legacySlug, got.legacy_slug],
    ]
    for (const [field, w, g] of checks) {
      if (w !== g) {
        console.error(`  ✗ ${got.slug} 的 ${field}: 期望 ${JSON.stringify(w)}，实际 ${JSON.stringify(g)}`)
        bad++
      }
    }
    if (want.durationSec !== null && Math.abs((got.duration_sec ?? 0) - want.durationSec) > 0.001) {
      console.error(`  ✗ ${got.slug} 的 duration_sec: 期望 ${want.durationSec}，实际 ${got.duration_sec}`)
      bad++
    }
  }

  const missing = rows.filter(r => !json.some(g => g.env === r.env && g.slug === r.slug))
  for (const r of missing) {
    console.error(`  ✗ KV 里的 ${r.slug} 没有写进 D1`)
    bad++
  }

  if (bad === 0) {
    console.info(`  ✓ ${json.length} 行全部一致`)
  }
  else {
    console.error(`\n校验失败：${bad} 处不一致`)
    process.exit(1)
  }
}

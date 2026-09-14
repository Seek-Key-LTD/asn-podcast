#!/usr/bin/env node
/**
 * 把一批音频入库到 asn-podcast。
 *
 * 做两件事：
 *   1) 把音频上传到 Cloudflare R2（通过 mc 客户端）
 *   2) 把剧集记录写进 Cloudflare KV（通过 wrangler）
 *
 * 用法：
 *   node scripts/ingest-episodes.mjs scripts/episodes.s1.json
 *   node scripts/ingest-episodes.mjs scripts/episodes.s1.json --dry-run
 *
 * 前置条件：
 *   - mc：已配置好指向 R2 的别名（默认 `r2`，可用 manifest.mcAlias 覆盖）
 *   - wrangler：已登录，且对目标账号有 workers_kv:write 权限
 *
 * KV 键只有一套（首页、单集页、RSS、sitemap 共用）：
 *   content:{runEnv}:hacker-podcast:{YYYY-MM-DD}
 *
 * 注意：`date` 同时决定单集页 URL（/episode/{date}），必须是唯一的 YYYY-MM-DD。
 */

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

function inferAudioType(path) {
  const dot = path.lastIndexOf('.')
  return AUDIO_TYPE_BY_EXTENSION[dot === -1 ? '' : path.slice(dot).toLowerCase()] ?? 'audio/mpeg'
}

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
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
  namespaceId,
  runEnv = 'production',
  series,
  updatedAt = Date.now(),
} = manifest

for (const required of ['bucket', 'publicBase', 'namespaceId', 'episodes']) {
  if (!manifest[required]) {
    console.error(`manifest 缺少必填字段: ${required}`)
    process.exit(1)
  }
}

const seenDates = new Set()
const workDir = mkdtempSync(join(tmpdir(), 'asn-ingest-'))
const normalizedPrefix = keyPrefix.replace(/^\/|\/$/g, '')
const normalizedBase = publicBase.replace(/\/$/, '')

console.info(`manifest : ${manifestPath}`)
console.info(`目标桶   : ${mcAlias}/${bucket}${normalizedPrefix ? `/${normalizedPrefix}` : ''}`)
console.info(`公开基址 : ${normalizedBase}`)
console.info(`KV 前缀  : content:${runEnv}:hacker-podcast:`)
console.info(`剧集数   : ${manifest.episodes.length}${dryRun ? '  (dry-run，不写入)' : ''}\n`)

for (const episode of manifest.episodes) {
  const { issue, date, file, objectKey, title, intro = '', body = '' } = episode

  if (!issue || !date || !file || !objectKey || !title) {
    console.error(`剧集条目缺少必填字段（issue/date/file/objectKey/title）: ${JSON.stringify(episode).slice(0, 120)}`)
    process.exit(1)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`${issue}: date 必须是 YYYY-MM-DD，收到 "${date}"`)
    process.exit(1)
  }
  if (seenDates.has(date)) {
    console.error(`${issue}: date "${date}" 与前面的剧集重复，会互相覆盖`)
    process.exit(1)
  }
  seenDates.add(date)

  const localSize = statSync(file).size
  const contentType = inferAudioType(objectKey)
  const remoteKey = normalizedPrefix ? `${normalizedPrefix}/${objectKey}` : objectKey
  const audioUrl = `${normalizedBase}/${remoteKey.split('/').map(encodeURIComponent).join('/')}`

  console.info(`── ${issue}  ${date}  ${title}`)
  console.info(`   本地 : ${basename(file)}  ${(localSize / 1024 / 1024).toFixed(1)} MiB`)
  console.info(`   远端 : ${remoteKey}  (${contentType})`)

  if (dryRun) {
    console.info(`   [dry-run] mc cp --attr Content-Type=${contentType} ...`)
    console.info(`   [dry-run] KV put content:${runEnv}:hacker-podcast:${date}`)
    console.info(`   URL  : ${audioUrl}\n`)
    continue
  }

  run('mc', [
    'cp',
    '--attr',
    `Content-Type=${contentType}`,
    file,
    `${mcAlias}/${bucket}/${remoteKey}`,
  ])

  const article = {
    date,
    issue_no: issue,
    locale: 'zh',
    agent_id: 'kunpengzhi',
    title,
    introContent: intro,
    blogContent: body,
    podcastContent: '',
    audio: audioUrl,
    audioSize: localSize,
    stories: [],
    updatedAt,
    extra: series ? { series_title: series } : undefined,
  }

  const articlePath = join(workDir, `${issue.replace(/[^\w.-]/g, '_')}.json`)
  writeFileSync(articlePath, JSON.stringify(article, null, 2), 'utf8')

  const kvKey = `content:${runEnv}:hacker-podcast:${date}`
  run('npx', [
    'wrangler',
    'kv',
    'key',
    'put',
    kvKey,
    '--path',
    articlePath,
    '--namespace-id',
    namespaceId,
    '--remote',
  ])

  console.info(`   ✓ 上传并写入 ${kvKey}\n`)
}

console.info('完成。')
if (!dryRun) {
  console.info('提示：线上页面有 revalidate 缓存（首页 600s / RSS 3600s），刷新不会立刻生效。')
  console.info('      急的话可以在 Cloudflare 面板对该 worker 做一次 Purge，或等缓存过期。')
}

import type { EpisodeUpsert } from '@/lib/db'

/**
 * 把 N8N（或任何调用方）传来的 JSON 校验、归一化成 `EpisodeUpsert`。
 *
 * 为什么校验写在这层而不是 SQL 层：表上有几条 CHECK 约束（daily/series 各自的
 * 形状、`published_at >= 1e12`），D1 一旦不满足会抛一个含内部细节的错。
 * 这里先把约束翻译成人话，调用方拿到的是「season 必须 >= 1」而不是
 * 「CHECK constraint failed」。校验逻辑与 `migrations/0001` 的 CHECK 对齐。
 */

export type ValidationResult
  = | { ok: true, value: EpisodeUpsert }
    | { ok: false, error: string }

/** 表约束要求的时间戳下限（≈2001-09-09）。 */
const MS_FLOOR = 1_000_000_000_000

function asString(v: unknown, fallback = ''): string {
  if (v === undefined || v === null)
    return fallback
  return typeof v === 'string' ? v : String(v)
}

function asNullableString(v: unknown): string | null {
  if (v === undefined || v === null)
    return null
  return asString(v)
}

function asNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '')
    return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** stories_json / tags_json：接受字符串（校验合法 JSON）或任意值（序列化），非法退回 '[]'。 */
function asJsonString(v: unknown): string {
  if (typeof v === 'string') {
    try {
      JSON.parse(v)
      return v
    }
    catch {
      return '[]'
    }
  }
  if (v === undefined || v === null)
    return '[]'
  try {
    return JSON.stringify(v)
  }
  catch {
    return '[]'
  }
}

export function validateEpisodeInput(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null)
    return { ok: false, error: '请求体必须是一个对象' }

  const r = raw as Record<string, unknown>
  const problems: string[] = []

  const slug = asString(r.slug)
  if (!slug)
    problems.push('slug 必填且为字符串')

  const kind = asString(r.kind)
  if (kind !== 'daily' && kind !== 'series')
    problems.push(`kind 必须是 'daily' 或 'series'，收到：${JSON.stringify(kind)}`)

  const title = asString(r.title)
  if (!title)
    problems.push('title 必填')

  const audioUrl = asString(r.audioUrl)
  if (!audioUrl)
    problems.push('audioUrl 必填（NOT NULL）')

  const now = Date.now()
  const publishedAt = asNumber(r.publishedAt) ?? now
  const updatedAt = asNumber(r.updatedAt) ?? now
  if (publishedAt < MS_FLOOR)
    problems.push('publishedAt 必须是合理的毫秒时间戳（>= 1e12）')
  if (updatedAt < MS_FLOOR)
    problems.push('updatedAt 必须是合理的毫秒时间戳（>= 1e12）')

  // env 默认 'production'：读侧无 NODE_ENV 绑定时按 production 取数，
  // 写 production 才能被前台看到（这就是之前日报「写进去不显示」的根因）。
  const env = asString(r.env, 'production') || 'production'

  const base = {
    env,
    slug,
    kind: kind as 'daily' | 'series',
    title,
    summary: asString(r.summary),
    introContent: asString(r.introContent),
    blogContent: asString(r.blogContent),
    podcastContent: asString(r.podcastContent),
    storiesJson: asJsonString(r.storiesJson),
    tagsJson: asJsonString(r.tagsJson),
    audioUrl,
    legacySlug: asNullableString(r.legacySlug),
    audioBytes: asNumber(r.audioBytes),
    durationSec: asNumber(r.durationSec),
    publishedAt,
    updatedAt,
  }

  let value!: EpisodeUpsert

  if (kind === 'daily') {
    const date = asString(r.date)
    if (!date)
      problems.push('kind=\'daily\' 时 date 必填')
    if (date && date !== slug)
      problems.push('kind=\'daily\' 时 date 必须等于 slug')
    value = {
      ...base,
      date,
      seriesId: null,
      episodeNo: null,
      season: null,
      episodeMajor: null,
      episodeMinor: null,
    }
  }
  else if (kind === 'series') {
    const seriesId = asString(r.seriesId)
    const episodeNo = asString(r.episodeNo)
    const season = asNumber(r.season)
    const episodeMajor = asNumber(r.episodeMajor)
    const episodeMinor = asNumber(r.episodeMinor)
    if (!seriesId)
      problems.push('kind=\'series\' 时 seriesId 必填')
    if (!episodeNo)
      problems.push('kind=\'series\' 时 episodeNo 必填')
    if (season === null || season < 1)
      problems.push('season 必须 >= 1')
    if (episodeMajor === null || episodeMajor < 1)
      problems.push('episodeMajor 必须 >= 1')
    if (episodeMinor === null || episodeMinor < 0)
      problems.push('episodeMinor 必须 >= 0')
    value = {
      ...base,
      date: null,
      seriesId: seriesId || null,
      episodeNo: episodeNo || null,
      season,
      episodeMajor,
      episodeMinor,
    }
  }
  else {
    // kind 非法，problems 已记录，直接返回
    return { ok: false, error: problems.join('；') }
  }

  if (problems.length)
    return { ok: false, error: problems.join('；') }
  return { ok: true, value }
}

import type { EpisodeListRow, EpisodeRow } from '@/lib/db'
import type { Episode } from '@/types/podcast'

function appendUpdatedAt(url: string, updatedAt?: number): string {
  return updatedAt ? `${url}?t=${updatedAt}` : url
}

export function buildAudioUrl(staticHost: string | undefined, audioPath: string, updatedAt?: number): string {
  const normalizedHost = staticHost?.replace(/\/$/, '')
  if (/^https?:\/\//.test(audioPath)) {
    return appendUpdatedAt(audioPath, updatedAt)
  }

  const cleanedPath = audioPath.replace(/^\//, '')
  return appendUpdatedAt(`${normalizedHost}/${cleanedPath}`, updatedAt)
}

const AUDIO_TYPE_BY_EXTENSION: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
}

/**
 * 按扩展名推断音频 MIME 类型。
 *
 * 原来这里（以及 RSS enclosure）硬编码 `audio/mpeg`，但归档里存在 m4a/AAC
 * 等非 MP3 文件。网页播放器不校验该字段，严格的三方播客客户端会校验，
 * 类型不符可能被拒收。
 */
export function inferAudioType(src: string): string {
  const path = src.split('?')[0]?.toLowerCase() ?? ''
  const dot = path.lastIndexOf('.')
  const extension = dot === -1 ? '' : path.slice(dot)
  return AUDIO_TYPE_BY_EXTENSION[extension] ?? 'audio/mpeg'
}

function buildReferencesSection(stories?: Story[]): string {
  if (!stories || stories.length === 0) {
    return ''
  }

  const items = stories
    .map((story) => {
      const title = story.title || story.url || story.hackerNewsUrl || ''
      const href = story.url || story.hackerNewsUrl || '#'
      if (!title || !href)
        return null
      return `- [${title}](${href})`
    })
    .filter(Boolean)

  if (items.length === 0) {
    return ''
  }

  return ['## 参考链接', ...items].join('\n')
}

function parseStories(json?: string): Story[] {
  if (!json)
    return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed as Story[] : []
  }
  catch {
    // 存进库的 JSON 理论上一定合法；真坏了也别让整个页面挂掉
    return []
  }
}

/**
 * 列表查询故意不投影正文（见 lib/db.ts 的 EpisodeListRow），所以这里要能
 * 容忍字段缺席——列表页只渲染 summary，不读 content。
 */
type RowLike = EpisodeRow | EpisodeListRow

function optionalField(row: RowLike, key: 'blog_content' | 'podcast_content' | 'stories_json'): string {
  return (row as Partial<EpisodeRow>)[key] ?? ''
}

export interface BuildEpisodeOptions {
  /** 系列标题，仅用于列表徽标。 */
  seriesTitle?: string
}

/**
 * `Episode.id` 的语义从「日期」变成了「URL 路径」（slug）——这是本次迁移的
 * 核心变化：身份不再由日期承担。
 *
 * `published` 用 published_at（毫秒）转 ISO 字符串。`lib/date.ts` 的两个格式化
 * 函数都收 number/string/Date，所以展示层零改动。排序**只**来自 SQL 的
 * `ORDER BY`，这里不再做二次排序——之前 `.sort((a,b) => a.published < ...)`
 * 那个二次排序正是 S01E08.5 位置错乱的来源之一。
 */
export function buildEpisodeFromRow(
  row: RowLike,
  staticHost: string | undefined,
  options: BuildEpisodeOptions = {},
): Episode {
  const blogContent = optionalField(row, 'blog_content')
  const podcastContent = optionalField(row, 'podcast_content')
  const stories = parseStories(optionalField(row, 'stories_json'))

  const description
    = row.intro_content
      || podcastContent.split('\n')?.[0]
      || blogContent.split('\n')?.[0]
      || row.title

  const sections: string[] = []
  if (blogContent) {
    sections.push(blogContent)
  }
  if (podcastContent) {
    sections.push(`## 播客全文\n\n${podcastContent}`)
  }

  const references = buildReferencesSection(stories)
  if (references) {
    sections.push(references)
  }

  const audioSrc = buildAudioUrl(staticHost, row.audio_url, row.updated_at)

  return {
    id: row.slug,
    title: row.title,
    description,
    content: sections.join('\n\n'),
    published: new Date(row.published_at).toISOString(),
    audio: {
      src: audioSrc,
      type: inferAudioType(audioSrc),
    },
    summary: row.intro_content,
    stories,
    kind: row.kind,
    episodeNo: row.episode_no ?? undefined,
    seriesId: row.series_id ?? undefined,
    seriesTitle: options.seriesTitle,
  }
}

export function buildEpisodesFromRows(
  rows: RowLike[],
  staticHost: string | undefined,
  options: BuildEpisodeOptions = {},
): Episode[] {
  return rows.map(row => buildEpisodeFromRow(row, staticHost, options))
}

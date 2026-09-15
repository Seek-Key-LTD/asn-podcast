import type { EpisodeRow } from '@/lib/db'
import type { Episode } from '@/types/podcast'
import { env } from 'cloudflare:workers'
import markdownit from 'markdown-it'
import { Podcast } from 'podcast'
import { podcast as podcastConfig } from '@/config'
import { buildAudioUrl, inferAudioType } from '@/lib/episodes'
import { getBaseUrl } from '@/lib/seo'

/**
 * 日报与系列剧共用同一套 feed 构造逻辑。两条 feed 只在 channel 元数据与
 * item 的 itunes:* 字段上不同，取数、渲染、enclosure 全部一致——所以抽在这里，
 * 避免把 app/rss.xml 那 80 行复制一遍。
 */

const md = markdownit()

export interface FeedConfig {
  title: string
  description: string
  /** feed 自身的绝对 URL。 */
  feedUrl: string
  /** 站点首页，用于 item 的 url。 */
  siteUrl: string
  imageUrl: string
  language?: string
  /** Apple 的 serial 类型。系列剧用 serial，日报保持默认 episodic。 */
  itunesType?: 'episodic' | 'serial'
  categories?: string[]
}

export function createPodcastFeed(cfg: FeedConfig): Podcast {
  const ownerEmail = 'asn-podcast@git4ta.fun'
  const feed = new Podcast({
    title: cfg.title,
    description: cfg.description,
    feedUrl: cfg.feedUrl,
    siteUrl: cfg.siteUrl,
    imageUrl: cfg.imageUrl,
    language: cfg.language ?? 'zh-CN',
    pubDate: new Date(),
    ttl: 60,
    generator: podcastConfig.base.title,
    author: podcastConfig.base.title,
    categories: cfg.categories ?? ['technology', 'news'],
    itunesImage: cfg.imageUrl,
    itunesCategory: [{ text: 'Technology' }, { text: 'News' }],
    itunesOwner: { name: podcastConfig.base.title, email: ownerEmail },
    managingEditor: ownerEmail,
    webMaster: ownerEmail,
    ...(cfg.itunesType ? { itunesType: cfg.itunesType } : {}),
  })
  return feed
}

/**
 * 把一个剧集加进 feed。
 *
 * `guid` 用**绝对 URL**（旧 feed 用的是相对路径 `/episode/...`）。这次切换是
 * 唯一安全的窗口：系列剧去的是全新 feed、全新订阅，没有客户端持有旧 guid；
 * 日报 feed 里那 4 条系列剧 item 会整条离开，所以不存在「原地改 guid」的条目。
 */
export function addEpisodeToFeed(
  feed: Podcast,
  episode: Episode,
  row: EpisodeRow,
  options: { baseUrl: string },
): void {
  const links = parseStories(row.stories_json)
    .map(s => `<li><a href="${s.hackerNewsUrl || s.url || ''}" title="${s.title || ''}">${s.title || ''}</a></li>`)
    .join('')
  const linkContent = links ? `<p><b>相关链接：</b></p><ul>${links}</ul>` : ''
  const blogContentHtml = md.render(row.blog_content || '')
  const trackingImage = env.NEXT_TRACKING_IMAGE

  const content = `
      <div>${blogContentHtml}<hr/>${linkContent}</div>
      ${trackingImage ? `<img src="${trackingImage}/${row.slug}" alt="" width="1" height="1" loading="lazy" aria-hidden="true" style="opacity: 0;pointer-events: none;" />` : ''}
    `

  const itemUrl = `${options.baseUrl}/episode/${row.slug}`

  // episode_minor > 0 就是番外集（S01E08.5），正好对上 Apple 的 bonus 语义。
  // itunesEpisode 只能收整数，所以 .5 集落到 episode_major。
  const isBonus = (row.episode_minor ?? 0) > 0

  feed.addItem({
    title: row.title || '',
    description: row.intro_content || row.podcast_content || '',
    content,
    url: itemUrl,
    guid: itemUrl,
    date: new Date(row.published_at),
    enclosure: {
      url: buildAudioUrl(env.NEXT_STATIC_HOST, row.audio_url, row.updated_at),
      type: inferAudioType(row.audio_url),
      // 回填与管线都会写 audio_bytes，所以不再对 R2 发 HEAD 探测
      size: row.audio_bytes ?? 0,
    },
    ...(row.kind === 'series' && row.season !== null
      ? {
          itunesSeason: row.season,
          itunesEpisode: row.episode_major ?? undefined,
          itunesEpisodeType: isBonus ? 'bonus' : 'full',
          ...(row.duration_sec !== null ? { itunesDuration: row.duration_sec } : {}),
        }
      : {}),
  })
}

function parseStories(json?: string): Story[] {
  if (!json)
    return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed as Story[] : []
  }
  catch {
    return []
  }
}

export function feedResponse(feed: Podcast, revalidateSeconds: number): Response {
  return new Response(feed.buildXml(), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `public, max-age=${revalidateSeconds}, s-maxage=${revalidateSeconds}`,
    },
  })
}

export { getBaseUrl }

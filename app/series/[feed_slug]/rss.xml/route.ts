import { getFeedEpisodes, getSeries } from '@/lib/articles'
import { buildEpisodesFromRows } from '@/lib/episodes'
import { addEpisodeToFeed, createPodcastFeed, feedResponse } from '@/lib/feed'
import { getBaseUrl } from '@/lib/seo'

/** 系列剧的独立 feed。与日报 feed 分开，因为两者的生命周期不同（日报会过期、系列剧永久）。 */
export const revalidate = 3600

/** feed 不截断：系列剧是策展内容，全集都该在 feed 里。 */
const maxFeedItems = 200

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feed_slug: string }> },
) {
  const { feed_slug: feedSlug } = await params
  const series = await getSeries(feedSlug)

  if (!series) {
    return new Response('Not Found', { status: 404 })
  }

  const baseUrl = getBaseUrl()
  const rows = await getFeedEpisodes('series', maxFeedItems, series.id)
  const episodes = buildEpisodesFromRows(rows, undefined, { seriesTitle: series.title })

  const feed = createPodcastFeed({
    title: series.title,
    description: series.description,
    feedUrl: `${baseUrl}/series/${series.feed_slug}/rss.xml`,
    siteUrl: `${baseUrl}/series/${series.feed_slug}`,
    // Apple 要求封面 ≥1400×1400；series.cover 没配时退回站标（1024×1024，
    // 低于门槛，提交前需要给系列剧补一张真封面）。
    imageUrl: series.cover ?? `${baseUrl}/logo.png`,
    // serial：系列剧是顺序作品，客户端会按期次而不是发布时间排
    itunesType: 'serial',
  })

  rows.forEach((row, index) => {
    addEpisodeToFeed(feed, episodes[index]!, row, { baseUrl })
  })

  return feedResponse(feed, revalidate)
}

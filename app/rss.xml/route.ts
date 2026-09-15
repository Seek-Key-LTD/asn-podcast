import { podcast as podcastConfig } from '@/config'
import { getFeedEpisodes } from '@/lib/articles'
import { buildEpisodesFromRows } from '@/lib/episodes'
import { addEpisodeToFeed, createPodcastFeed, feedResponse } from '@/lib/feed'
import { getBaseUrl } from '@/lib/seo'

/** 日报 feed。系列剧各自有独立的 feed（app/series/[feed_slug]/rss.xml）。 */
export const revalidate = 3600

const maxFeedItems = 10

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('lang') || 'zh'
  const baseUrl = getBaseUrl()

  if (locale !== 'zh') {
    // 迁移前这里按 ?lang= 切 feed 标题，但内容键从来没有分语言写过，所以
    // 「非中文 feed」一直是空壳。宁可 404，也不再给一个假承诺。
    return new Response('Not Found', { status: 404 })
  }

  const rows = await getFeedEpisodes('daily', maxFeedItems)
  const episodes = buildEpisodesFromRows(rows, undefined)

  const feed = createPodcastFeed({
    title: podcastConfig.base.title,
    description: podcastConfig.base.description,
    feedUrl: `${baseUrl}/rss.xml`,
    siteUrl: baseUrl,
    imageUrl: `${baseUrl}/logo.png`,
  })

  rows.forEach((row, index) => {
    addEpisodeToFeed(feed, episodes[index]!, row, { baseUrl })
  })

  return feedResponse(feed, revalidate)
}

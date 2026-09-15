import { getSitemapEpisodes, getSitemapSeries } from '@/lib/articles'
import { getBaseUrl } from '@/lib/seo'

export const revalidate = 86400

export default async function sitemap() {
  const baseUrl = getBaseUrl()
  const [episodes, series] = await Promise.all([
    getSitemapEpisodes(),
    getSitemapSeries(),
  ])

  const latestModified = episodes.reduce((max, e) => Math.max(max, e.updated_at), 0)

  return [
    {
      url: baseUrl,
      lastModified: new Date(latestModified || Date.now()),
      changeFrequency: 'daily',
      priority: 1,
    },
    // 系列剧索引与专页。放在单集之前，因为它们是列表层级。
    {
      url: `${baseUrl}/series`,
      lastModified: new Date(latestModified || Date.now()),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    ...series.map(s => ({
      url: `${baseUrl}/series/${s.feed_slug}`,
      // lastmod 的语义是「最后改动」，所以用 updated_at 而不是 published_at
      lastModified: new Date(s.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...episodes.map(e => ({
      url: `${baseUrl}/episode/${e.slug}`,
      lastModified: new Date(e.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}

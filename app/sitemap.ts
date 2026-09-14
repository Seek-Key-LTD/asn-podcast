import { listEpisodeDates } from '@/lib/articles'
import { getBaseUrl } from '@/lib/seo'

export const revalidate = 86400

export default async function sitemap() {
  const baseUrl = getBaseUrl()
  const posts = (await listEpisodeDates()).map(date => ({ date }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(posts[0]?.date ?? Date.now()),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...posts.map(post => ({
      url: `${baseUrl}/episode/${post.date}`,
      lastModified: new Date(post.date),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}

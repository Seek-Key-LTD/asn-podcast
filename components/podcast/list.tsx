import type { PodcastInfo } from '@/types/podcast'
import { env } from 'cloudflare:workers'
import { redirect } from 'next/navigation'
import { Podcast } from '@/components/podcast'
import { StructuredData } from '@/components/seo/structured-data'
import { keepDays, podcast, site } from '@/config'
import { buildEpisodesFromArticles } from '@/lib/episodes'
import { getAbsoluteUrl } from '@/lib/seo'
import { getPastDays } from '@/lib/utils'

interface PodcastListProps {
  currentPage: number
}

export async function PodcastList({ currentPage }: PodcastListProps) {
  const runEnv = env.NODE_ENV || 'production'
  const pastDays = getPastDays(keepDays)
  const kvPrefix = `content:${runEnv}:hacker-podcast:`
  const totalEpisodes = pastDays.length
  const totalPages = Math.max(1, Math.ceil(totalEpisodes / site.pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)

  if (safePage !== currentPage) {
    redirect(safePage <= 1 ? '/' : `/page/${safePage}`)
  }

  const startIndex = (safePage - 1) * site.pageSize
  const pageDays = pastDays.slice(startIndex, startIndex + site.pageSize)

  const posts = (
    await Promise.all(
      pageDays.map(async (day) => {
        const post = await env.HACKER_PODCAST_KV.get(`${kvPrefix}${day}`, 'json')
        return post as unknown as Article
      }),
    )
  ).filter(Boolean)

  const episodes = buildEpisodesFromArticles(posts, env.NEXT_STATIC_HOST)

  const podcastInfo: PodcastInfo = {
    title: podcast.base.title,
    description: podcast.base.description,
    link: podcast.base.link,
    cover: podcast.base.cover,
  }
  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${podcast.base.link}/#organization`,
        'name': podcast.base.title,
        'url': podcast.base.link,
        'logo': getAbsoluteUrl(podcast.base.cover),
      },
      {
        '@type': 'PodcastSeries',
        '@id': `${podcast.base.link}/#podcast`,
        'name': podcast.base.title,
        'description': podcast.base.description,
        'url': podcast.base.link,
        'image': getAbsoluteUrl(podcast.base.cover),
        'inLanguage': 'zh-CN',
        'webFeed': getAbsoluteUrl('/rss.xml'),
        'publisher': {
          '@id': `${podcast.base.link}/#organization`,
        },
      },
    ],
  }

  return (
    <>
      <StructuredData data={structuredData} />
      <Podcast
        episodes={episodes}
        currentPage={safePage}
        totalEpisodes={totalEpisodes}
        podcastInfo={podcastInfo}
      />
    </>
  )
}

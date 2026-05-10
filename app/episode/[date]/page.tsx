import { env } from 'cloudflare:workers'
import { notFound } from 'next/navigation'
import { EpisodeDetail } from '@/components/episodes/detail'
import { PodcastScaffold } from '@/components/podcast/scaffold'
import { StructuredData } from '@/components/seo/structured-data'
import { podcast, site } from '@/config'
import { getArticleByDate } from '@/lib/articles'
import { toIsoDateString } from '@/lib/date'
import { buildEpisodeFromArticle } from '@/lib/episodes'
import { cleanMetadataDescription, getAbsoluteUrl } from '@/lib/seo'

export const revalidate = 7200

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const post = await getArticleByDate(date)

  if (!post) {
    return notFound()
  }

  const episode = buildEpisodeFromArticle(post, env.NEXT_STATIC_HOST)
  const title = episode.title || site.seo.defaultTitle
  const description = cleanMetadataDescription(episode.description || site.seo.defaultDescription)
  const url = `${podcast.base.link}/episode/${episode.id}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      locale: site.seo.locale,
      type: 'article',
      publishedTime: toIsoDateString(episode.published),
      images: [
        {
          url: getAbsoluteUrl(site.seo.defaultImage),
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [getAbsoluteUrl(site.seo.defaultImage)],
    },
  }
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ date }, pageQuery] = await Promise.all([params, searchParams])
  const fallbackPage = Number.parseInt(pageQuery.page ?? '1', 10)

  const post = await getArticleByDate(date)

  if (!post) {
    return notFound()
  }

  const episode = buildEpisodeFromArticle(post, env.NEXT_STATIC_HOST)
  const title = episode.title || site.seo.defaultTitle
  const podcastInfo = {
    title: podcast.base.title,
    description: podcast.base.description,
    link: podcast.base.link,
    cover: podcast.base.cover,
  }
  const url = `${podcast.base.link}/episode/${episode.id}`
  const description = cleanMetadataDescription(episode.description || site.seo.defaultDescription)
  const publishedDate = toIsoDateString(episode.published)
  const modifiedDate = toIsoDateString(post.updatedAt ?? episode.published)
  const organizationId = `${podcast.base.link}/#organization`
  const podcastId = `${podcast.base.link}/#podcast`
  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        'name': podcast.base.title,
        'url': podcast.base.link,
        'logo': getAbsoluteUrl(podcast.base.cover),
      },
      {
        '@type': 'PodcastSeries',
        '@id': podcastId,
        'name': podcast.base.title,
        'description': podcast.base.description,
        'url': podcast.base.link,
        'image': getAbsoluteUrl(podcast.base.cover),
        'inLanguage': 'zh-CN',
        'webFeed': getAbsoluteUrl('/rss.xml'),
        'publisher': {
          '@id': organizationId,
        },
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        'headline': title,
        description,
        url,
        'image': getAbsoluteUrl(site.seo.defaultImage),
        'datePublished': publishedDate,
        'dateModified': modifiedDate,
        'inLanguage': 'zh-CN',
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': url,
        },
        'author': {
          '@id': organizationId,
        },
        'publisher': {
          '@id': organizationId,
        },
      },
      {
        '@type': 'PodcastEpisode',
        '@id': `${url}#podcast-episode`,
        'name': title,
        description,
        url,
        'datePublished': publishedDate,
        'associatedMedia': {
          '@type': 'MediaObject',
          'contentUrl': episode.audio.src,
          'encodingFormat': episode.audio.type,
        },
        'partOfSeries': {
          '@id': podcastId,
        },
      },
    ],
  }

  const safePage = Number.isNaN(fallbackPage) ? 1 : Math.max(1, fallbackPage)
  return (
    <PodcastScaffold podcastInfo={podcastInfo}>
      <StructuredData data={structuredData} />
      <EpisodeDetail episode={episode} initialPage={safePage} />
    </PodcastScaffold>
  )
}

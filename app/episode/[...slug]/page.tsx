import { env } from 'cloudflare:workers'
import { notFound, permanentRedirect } from 'next/navigation'
import { EpisodeDetail } from '@/components/episodes/detail'
import { PodcastScaffold } from '@/components/podcast/scaffold'
import { StructuredData } from '@/components/seo/structured-data'
import { podcast, site } from '@/config'
import { EPISODE_DATE_PATTERN, getEpisode, getLegacyTarget, getSeries } from '@/lib/articles'
import { toIsoDateString } from '@/lib/date'
import { buildEpisodeFromRow } from '@/lib/episodes'
import { cleanMetadataDescription, getAbsoluteUrl } from '@/lib/seo'

export const revalidate = 7200

/**
 * slug 是 catch-all 数组：日报是 `['2026-09-15']`，系列剧是
 * `['sangeng', 's01e04']`。这样「slug 里能不能带斜杠」变成纯数据问题，
 * 而且六处 `/episode/${episode.id}` 一行都不用改。
 */
interface EpisodePageProps {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<{ page?: string }>
}

/**
 * 解析路径。迁移前系列剧住在 `/episode/2026-09-14` 这种日期式 URL 上
 * （已进过 sitemap、发过 feed），靠 `legacy_slug` 列 308 到新 slug。
 */
async function resolveEpisode(slugParts: string[]) {
  const path = slugParts.join('/')
  const row = await getEpisode(path)
  if (row) {
    return { row, series: row.series_id ? await getSeriesBySeriesId(row.series_id) : null }
  }

  // 只对「单个日期形状的段」做遗留跳转，避免把任意不存在的路径都当旧 URL
  if (slugParts.length === 1 && EPISODE_DATE_PATTERN.test(slugParts[0]!)) {
    const target = await getLegacyTarget(slugParts[0]!)
    if (target) {
      // permanentRedirect 才是 308。普通 redirect 是 307（临时），
      // 而这是一次性的永久迁移，307 会让搜索引擎反复回来确认。
      permanentRedirect(`/episode/${target}`)
    }
  }

  return null
}

/** series_id 形如 'sangeng-s1'，feed_slug 是 'sangeng'。这里只为了拿 feed_slug 拼 JSON-LD 的 @id。 */
async function getSeriesBySeriesId(seriesId: string) {
  const feedSlug = seriesId.replace(/-s\d+$/, '')
  return getSeries(feedSlug)
}

export async function generateMetadata({ params }: EpisodePageProps) {
  const { slug } = await params
  const resolved = await resolveEpisode(slug)

  if (!resolved) {
    return notFound()
  }

  const episode = buildEpisodeFromRow(resolved.row, env.NEXT_STATIC_HOST)
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

export default async function EpisodePage({ params, searchParams }: EpisodePageProps) {
  const [{ slug }, pageQuery] = await Promise.all([params, searchParams])
  const resolved = await resolveEpisode(slug)

  if (!resolved) {
    return notFound()
  }

  const { row, series } = resolved
  const episode = buildEpisodeFromRow(row, env.NEXT_STATIC_HOST, { seriesTitle: series?.title })
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
  const modifiedDate = toIsoDateString(row.updated_at)
  const organizationId = `${podcast.base.link}/#organization`

  // 系列剧集的 partOfSeries 指向该系列自己的 PodcastSeries，而不是全站的；
  // 否则 Apple/Google 会把每一集都算进同一个只有日报的系列。
  const seriesPodcastId = series
    ? `${podcast.base.link}/series/${series.feed_slug}#podcast`
    : `${podcast.base.link}/#podcast`

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
        '@id': seriesPodcastId,
        'name': series?.title ?? podcast.base.title,
        'description': series?.description ?? podcast.base.description,
        'url': series ? `${podcast.base.link}/series/${series.feed_slug}` : podcast.base.link,
        'image': getAbsoluteUrl(series?.cover ?? podcast.base.cover),
        'inLanguage': 'zh-CN',
        'webFeed': getAbsoluteUrl(series ? `/series/${series.feed_slug}/rss.xml` : '/rss.xml'),
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
          '@id': seriesPodcastId,
        },
        ...(row.episode_major !== null
          ? {
              episodeNumber: row.episode_major,
              ...(row.season !== null ? { partOfSeason: row.season } : {}),
            }
          : {}),
      },
    ],
  }

  const fallbackPage = Number.parseInt(pageQuery.page ?? '1', 10)
  const safePage = Number.isNaN(fallbackPage) ? 1 : Math.max(1, fallbackPage)
  return (
    <PodcastScaffold podcastInfo={podcastInfo}>
      <StructuredData data={structuredData} />
      <EpisodeDetail episode={episode} initialPage={safePage} />
    </PodcastScaffold>
  )
}

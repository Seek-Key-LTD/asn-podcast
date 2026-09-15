import { env } from 'cloudflare:workers'
import { notFound } from 'next/navigation'
import { Podcast } from '@/components/podcast'
import { UpcomingSeasons } from '@/components/podcast/upcoming-seasons'
import { StructuredData } from '@/components/seo/structured-data'
import { podcast } from '@/config'
import { getSeries, getSeriesEpisodes, getSeriesPremieres } from '@/lib/articles'
import { buildEpisodesFromRows } from '@/lib/episodes'
import { getAbsoluteUrl } from '@/lib/seo'

export const revalidate = 600

interface SeriesPageProps {
  params: Promise<{ feed_slug: string }>
}

export async function generateMetadata({ params }: SeriesPageProps) {
  const { feed_slug: feedSlug } = await params
  const series = await getSeries(feedSlug)
  if (!series)
    return {}

  return {
    title: `${series.title} · ${podcast.base.title}`,
    description: series.description,
    alternates: { canonical: `${podcast.base.link}/series/${series.feed_slug}` },
  }
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { feed_slug: feedSlug } = await params
  const series = await getSeries(feedSlug)

  if (!series) {
    return notFound()
  }

  // 按期次正序（season → episode_major → episode_minor），
  // S01E08.5 自然落在 E8 与 E10 之间。
  const rows = await getSeriesEpisodes(series.id)
  const episodes = buildEpisodesFromRows(rows, env.NEXT_STATIC_HOST, { seriesTitle: series.title })
  const upcoming = await getSeriesPremieres(series.id)

  const base = `${podcast.base.link}/series/${series.feed_slug}`
  const podcastInfo = {
    title: series.title,
    description: series.description,
    link: base,
    cover: series.cover ?? podcast.base.cover,
  }

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'PodcastSeries',
        '@id': `${base}#podcast`,
        'name': series.title,
        'description': series.description,
        'url': base,
        'image': getAbsoluteUrl(series.cover ?? podcast.base.cover),
        'inLanguage': 'zh-CN',
        'webFeed': getAbsoluteUrl(`/series/${series.feed_slug}/rss.xml`),
        'numberOfEpisodes': rows.length,
      },
    ],
  }

  return (
    <>
      <StructuredData data={structuredData} />
      <Podcast
        episodes={episodes}
        currentPage={1}
        totalPages={1}
        podcastInfo={podcastInfo}
        heading={series.title}
        listHeading="按期次"
      />
      {upcoming.length > 0 && (
        <section className={`
          px-4 pt-8
          md:px-10
          lg:px-20
        `}
        >
          <h2 className={`
            text-lg font-semibold text-foreground
            md:text-xl
          `}
          >
            即将上线
          </h2>
          <UpcomingSeasons
            upcoming={upcoming}
            className={`
              mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground
            `}
          />
        </section>
      )}
    </>
  )
}

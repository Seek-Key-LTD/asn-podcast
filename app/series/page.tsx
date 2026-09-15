import { PodcastScaffold } from '@/components/podcast/scaffold'
import { SeriesShelf } from '@/components/podcast/series-shelf'
import { podcast } from '@/config'
import { getSeriesIndex } from '@/lib/articles'

export const revalidate = 600

export const metadata = {
  title: `系列 · ${podcast.base.title}`,
  description: '按系列成卷播出的长节目，按期次顺序收听。',
}

export default async function SeriesIndexPage() {
  const series = await getSeriesIndex()

  const podcastInfo = {
    title: podcast.base.title,
    description: podcast.base.description,
    link: podcast.base.link,
    cover: podcast.base.cover,
  }

  return (
    <PodcastScaffold podcastInfo={podcastInfo}>
      {series.length === 0
        ? (
            <p
              className={`
                px-4 py-20 text-center text-muted-foreground
                md:px-10
                lg:px-20
              `}
              role="status"
            >
              暂无系列
            </p>
          )
        : <SeriesShelf series={series} />}
    </PodcastScaffold>
  )
}

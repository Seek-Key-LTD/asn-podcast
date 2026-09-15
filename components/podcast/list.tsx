import type { PodcastInfo } from '@/types/podcast'
import { env } from 'cloudflare:workers'
import { redirect } from 'next/navigation'
import { Podcast } from '@/components/podcast'
import { SeriesShelf } from '@/components/podcast/series-shelf'
import { StructuredData } from '@/components/seo/structured-data'
import { podcast, site } from '@/config'
import { getDailyPage, getSeriesIndex } from '@/lib/articles'
import { buildEpisodesFromRows } from '@/lib/episodes'
import { pageHref } from '@/lib/pagination'
import { getAbsoluteUrl } from '@/lib/seo'

interface PodcastListProps {
  currentPage: number
}

export async function PodcastList({ currentPage }: PodcastListProps) {
  // 一条 SQL 拿一页 + 总数，替代原来的「KV list 取全部 → slice → 逐条 get」。
  const page = await getDailyPage(currentPage, site.pageSize)

  // 越界页夹取后重定向。totalPages 由服务端算，客户端不再重复这个公式。
  if (page.page !== currentPage) {
    redirect(pageHref(page.page))
  }

  // 货架只在首页第 1 页出现——分页往后翻时它只是噪音。
  const series = page.page === 1 ? await getSeriesIndex() : []

  const episodes = buildEpisodesFromRows(page.items, env.NEXT_STATIC_HOST)

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
        currentPage={page.page}
        totalPages={page.totalPages}
        podcastInfo={podcastInfo}
      >
        <SeriesShelf series={series} />
      </Podcast>
    </>
  )
}

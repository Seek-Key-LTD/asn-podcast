import type { SeriesWithCounts } from '@/lib/db'
import Link from 'next/link'
import { formatZhCnUtcDate } from '@/lib/date'

/**
 * 首页的系列剧货架。
 *
 * 为什么系列剧不进首页那个扁平列表：那个列表是日期序，而系列剧的排序轴是
 * 期次（season/episodeMajor/episodeMinor）。混在一起就会重演 S01E08.5 被
 * 日期挤出正确位置的老问题——那正是这次 D1 迁移要修的。
 *
 * 只在首页第 1 页渲染（分页后传 `children` 为 undefined）。
 */
export function SeriesShelf({ series }: { series: SeriesWithCounts[] }) {
  if (series.length === 0)
    return null

  return (
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
        系列
      </h2>
      <ul className={`
        mt-4 grid grid-cols-1 gap-4
        sm:grid-cols-2
        lg:grid-cols-3
      `}
      >
        {series.map(item => (
          <li key={item.id}>
            <Link
              href={`/series/${item.feed_slug}`}
              className={`
                flex h-full flex-col gap-2 rounded-lg border border-border
                bg-card p-4 transition-colors
                hover:bg-accent
              `}
            >
              <span className="text-base font-semibold text-card-foreground">{item.title}</span>
              <span className="line-clamp-3 text-sm text-muted-foreground">{item.description}</span>
              <span className="mt-auto text-xs text-muted-foreground">
                {item.episode_count}
                {' '}
                集
                {item.latest_published_at
                  ? ` · 最近 ${formatZhCnUtcDate(item.latest_published_at)}`
                  : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

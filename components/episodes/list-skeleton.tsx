'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { site } from '@/config'

interface EpisodeListSkeletonProps {
  count?: number
}

export function EpisodeListSkeleton({ count = site.pageSize }: EpisodeListSkeletonProps) {
  const items = Array.from({ length: count }, (_, index) => `episode-skeleton-${index + 1}`)

  return (
    <ul className="flex flex-col" aria-label="节目列表加载中" aria-busy="true">
      {items.map(item => (
        <li key={item} className="list-none">
          <article className={`
            flex flex-col gap-3 border-b border-border px-4 py-8
            sm:px-6
            md:px-10 md:py-12
            lg:px-20
          `}
          >
            <Skeleton className="
              h-4 w-28 rounded-sm
              md:h-5
            "
            />
            <div className="space-y-3">
              <Skeleton className="
                h-6 w-11/12 rounded-sm
                md:h-8
              "
              />
              <Skeleton className="
                h-6 w-2/3 rounded-sm
                md:h-8
              "
              />
            </div>
            <div className="space-y-2">
              <Skeleton className="
                h-6 w-full rounded-sm
                md:h-7
              "
              />
              <Skeleton className="
                h-6 w-4/5 rounded-sm
                md:h-7
              "
              />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Skeleton className="
                h-4 w-12 rounded-sm
                md:h-5
              "
              />
              <Skeleton className="
                h-4 w-1 rounded-sm
                md:h-5
              "
              />
              <Skeleton className="
                h-4 w-16 rounded-sm
                md:h-5
              "
              />
            </div>
          </article>
        </li>
      ))}
    </ul>
  )
}

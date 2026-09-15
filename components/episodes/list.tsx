'use client'

import type { Episode } from '@/types/podcast'
import { useStore } from '@tanstack/react-store'
import { useEffect, useId } from 'react'
import { Waveform } from '@/components/common/waveform'
import { EpisodeItem } from '@/components/episodes/episode-item'
import { EpisodeListSkeleton } from '@/components/episodes/list-skeleton'
import { EpisodePagination } from '@/components/episodes/pagination'
import { completePageNavigation, getPageStore } from '@/stores/page-store'
import { setDefaultEpisode } from '@/stores/player-store'

interface EpisodeListProps {
  episodes: Episode[]
  currentPage: number
  /** 由服务端算好传下来。客户端不再自己算，避免两端算出不同的页数。 */
  totalPages: number
  /** 顶部标题，默认「节目列表」。系列剧专页会传系列名。 */
  heading?: string
  /** 列表小标题，默认「最近更新」。系列剧专页传「按期次」。 */
  listHeading?: string
}

export function EpisodeList({
  episodes,
  currentPage,
  totalPages,
  heading = '节目列表',
  listHeading = '最近更新',
}: EpisodeListProps) {
  const pageStore = getPageStore()
  const isNavigating = useStore(pageStore, state => state.isNavigating)
  const pendingPage = useStore(pageStore, state => state.pendingPage)

  useEffect(() => {
    completePageNavigation(currentPage)
  }, [currentPage])

  useEffect(() => {
    if (!episodes[0])
      return

    setDefaultEpisode(episodes[0])
  }, [episodes])

  const headingId = useId()
  const listHeadingId = useId()
  const hasEpisodes = episodes.length > 0
  const showPagination = totalPages > 1
  const showSkeleton = isNavigating && pendingPage !== null && pendingPage !== currentPage

  return (
    <section className="flex w-full flex-col" aria-labelledby={headingId}>
      <header className={`
        sticky top-0 z-10 border-b border-border bg-background/95
        backdrop-blur-lg
        md:bg-background md:backdrop-blur-none
      `}
      >
        <div className="relative flex items-center">
          <Waveform
            className={`
              hidden h-24 w-full
              md:block
            `}
            aria-hidden="true"
          />
          <h2
            id={headingId}
            className={`
              px-4 py-6 text-xl font-bold text-pretty
              md:absolute md:inset-0 md:top-10 md:px-10 md:py-0 md:text-2xl
              lg:px-20
            `}
          >
            {heading}
          </h2>
        </div>
      </header>

      <div className={`
        px-4 pt-6
        md:px-10 md:pt-12
        lg:px-20
      `}
      >
        <h3
          id={listHeadingId}
          className={`
            text-lg font-semibold text-pretty text-foreground
            md:text-xl
          `}
        >
          {listHeading}
        </h3>
      </div>

      {showSkeleton
        ? (
            <>
              <EpisodeListSkeleton />
              {showPagination && <EpisodePagination currentPage={currentPage} totalPages={totalPages} />}
            </>
          )
        : !hasEpisodes
            ? (
                <p
                  className={`
                    px-4 py-8 text-center text-muted-foreground
                    md:px-10 md:py-20
                    lg:px-20
                  `}
                  role="status"
                >
                  暂无节目
                </p>
              )
            : (
                <>
                  <ul className="flex flex-col" aria-labelledby={listHeadingId}>
                    {episodes.map(episode => (
                      <EpisodeItem key={episode.id} episode={episode} />
                    ))}
                  </ul>
                  {showPagination && <EpisodePagination currentPage={currentPage} totalPages={totalPages} />}
                </>
              )}
    </section>
  )
}

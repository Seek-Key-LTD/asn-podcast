'use client'

import type { ReactNode } from 'react'
import type { Episode, PodcastInfo } from '@/types/podcast'
import { EpisodeList } from '@/components/episodes/list'
import { PodcastScaffold } from '@/components/podcast/scaffold'

interface PodcastProps {
  episodes: Episode[]
  currentPage: number
  totalPages: number
  podcastInfo: PodcastInfo
  /** 列表上方的插槽。首页用来放系列剧货架；分页第 2 页起不传。 */
  children?: ReactNode
  heading?: string
  listHeading?: string
}

export function Podcast({ episodes, currentPage, totalPages, podcastInfo, children, heading, listHeading }: PodcastProps) {
  return (
    <PodcastScaffold podcastInfo={podcastInfo}>
      {children}
      <EpisodeList
        episodes={episodes}
        currentPage={currentPage}
        totalPages={totalPages}
        heading={heading}
        listHeading={listHeading}
      />
    </PodcastScaffold>
  )
}

'use client'

import type { Episode, PodcastInfo } from '@/types/podcast'
import { EpisodeList } from '@/components/episodes/list'
import { PodcastScaffold } from '@/components/podcast/scaffold'

interface PodcastProps {
  episodes: Episode[]
  currentPage: number
  totalEpisodes: number
  podcastInfo: PodcastInfo
}

export function Podcast({ episodes, currentPage, totalEpisodes, podcastInfo }: PodcastProps) {
  return (
    <PodcastScaffold podcastInfo={podcastInfo}>
      <EpisodeList episodes={episodes} currentPage={currentPage} totalEpisodes={totalEpisodes} />
    </PodcastScaffold>
  )
}

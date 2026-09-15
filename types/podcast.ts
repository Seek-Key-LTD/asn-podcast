export type ThemeColor
  = | 'blue'
    | 'pink'
    | 'purple'
    | 'green'
    | 'yellow'
    | 'orange'
    | 'red'

export interface Site {
  themeColor: ThemeColor
  pageSize: number
  defaultDescriptionLength: number
  seo: {
    siteName: string
    defaultTitle: string
    defaultDescription: string
    defaultImage: string
    twitterHandle?: string
    locale: string
  }
  favicon: string
}

export interface PodcastHost {
  name: string
  link: string
}

export interface PodcastPlatform {
  id: string
  name: string
  link: string
}

export interface PodcastBase {
  title: string
  description: string
  link: string
  cover: string
}

export interface Podcast {
  base: PodcastBase
  hosts: PodcastHost[]
  platforms: PodcastPlatform[]
}

export interface PodcastInfo {
  title: string
  description: string
  link: string
  cover: string
}

export interface EpisodeAudio {
  src: string
  type: string
}

export interface Episode {
  /** URL 路径（slug）。daily 是日期，series 是 `sangeng/s01e04`。 */
  id: string
  title: string
  description: string
  content?: string
  published: string
  audio: EpisodeAudio
  summary?: string
  stories?: Story[]
  /** 内容类型。日报与系列剧的排序轴、生命周期都不同（见 lib/db.ts）。 */
  kind: 'daily' | 'series'
  /** 系列剧的期次标签，如 'S01E08.5'。日报为 undefined。 */
  episodeNo?: string
  seriesId?: string
  seriesTitle?: string
}

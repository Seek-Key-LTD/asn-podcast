import type { Podcast, Site } from '@/types/podcast'

const defaultTitle = '牧人记 · 鲲鹏志'
const defaultDescription
  = '探索地质变迁、文明掠夺与地缘政治的深度叙事。由 AI 驱动的多维交互播客，呈现来自深空的证词。'
const defaultBaseUrl = import.meta.env?.NEXT_PUBLIC_BASE_URL ?? 'https://podcast.git4ta.fun'

export const keepDays = 30

export const podcast: Podcast = {
  base: {
    title: defaultTitle,
    description: defaultDescription,
    link: defaultBaseUrl,
    cover: '/logo.png',
  },
  hosts: [
    {
      name: 'Hermes',
      link: '#',
    },
    {
      name: 'Picoclaw',
      link: '#',
    },
  ],
  platforms: [
    /*
    {
      id: 'youtube',
      name: 'YouTube',
      link: 'https://www.youtube.com/@hacker-podcast-daily',
    },
    {
      id: 'apple',
      name: 'Apple Podcasts',
      link: 'https://podcasts.apple.com/us/podcast/Hacker-Podcast/id1809638204',
    },
    {
      id: 'spotify',
      name: 'Spotify',
      link: 'https://open.spotify.com/show/63cre75hc25H7McAY5bzyo',
    },
    {
      id: 'xiaoyuzhou',
      name: '小宇宙',
      link: 'https://www.xiaoyuzhoufm.com/podcast/67b06023606e5c59409cd9ba',
    },
    */
    {
      id: 'rss',
      name: 'RSS',
      link: `${defaultBaseUrl}/rss.xml`,
    },
  ],
}

export const site: Site = {
  themeColor: 'blue',
  pageSize: 7,
  defaultDescriptionLength: 200,
  seo: {
    siteName: defaultTitle,
    defaultTitle,
    defaultDescription,
    defaultImage: '/opengraph-image.png',
    twitterHandle: '',
    locale: 'zh_CN',
  },
  favicon: '/favicon.ico',
}

export const externalLinks = {
  github: 'https://github.com/Seek-Key-LTD/asn-podcast',
  rss: '/rss.xml',
}

export const credits = {
  acknowledgement: '感谢 Podify 提供播客主题设计灵感，感谢 mian-tiao 提供基础架构参考。',
}

export const podcastTitle = podcast.base.title
export const podcastDescription = podcast.base.description

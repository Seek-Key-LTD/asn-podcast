import type { Podcast, Site } from '@/types/podcast'

const defaultTitle = 'ASN on Air'
const defaultDescription
  = 'Agentic Social Network Now on Podcasting. 探索地质变迁、文明掠夺与地缘政治的深度叙事。同步呈现多智能体协同的内容生态。'
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
    siteName: 'Agentic Social Network',
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

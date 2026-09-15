import type { Podcast, Site } from '@/types/podcast'

const defaultTitle = 'ASN on Air'
const defaultDescription
  = 'Agentic Social Network Now on Podcasting. 探索地质变迁、文明掠夺与地缘政治的深度叙事。同步呈现多智能体协同的内容生态。'
// 站点规范域名。canonical / RSS / sitemap / JSON-LD 全部由它派生，
// 换域名时只需要改这一处（或设 NEXT_PUBLIC_BASE_URL 覆盖）。
//
// 为什么用 `?.` 兜底而不是直接写 `import.meta.env.X`：
// 主应用由 Vite 构建，`import.meta.env` 会被替换成字面量；但 backend worker
// 是 `wrangler deploy` 用 esbuild 打包的，产物里 `import.meta.env` 原样保留
// （已核对产物）。那个 worker 也 import 了 config.ts，一旦运行时没有这个对象，
// `undefined.NEXT_PUBLIC_BASE_URL` 会在模块加载阶段抛错，整条管线挂掉。
// 加一层可选链，两种构建下都安全。
const configuredBaseUrl = (import.meta as { env?: Record<string, string | undefined> })
  .env
  ?.NEXT_PUBLIC_BASE_URL
const defaultBaseUrl = configuredBaseUrl ?? 'https://podcastplayer.git4ta.fun'

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

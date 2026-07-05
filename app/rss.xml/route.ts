import { env } from 'cloudflare:workers'
import markdownit from 'markdown-it'
import { NextResponse } from 'next/server'
import { Podcast } from 'podcast'
import { podcast } from '@/config'
import { buildAudioUrl } from '@/lib/episodes'
import { getBaseUrl } from '@/lib/seo'

const md = markdownit()

export const revalidate = 3600

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('lang') || 'zh'
  const baseUrl = getBaseUrl()

  // 如果没有缓存，生成新的响应
  const feed = new Podcast({
    title: `${podcast.base.title}${locale !== 'zh' ? ` (${locale.toUpperCase()})` : ''}`,
    description: podcast.base.description,
    feedUrl: `${baseUrl}/rss.xml${locale !== 'zh' ? `?lang=${locale}` : ''}`,
    siteUrl: baseUrl,
    imageUrl: `${baseUrl}/logo.png`,
    language: locale === 'zh' ? 'zh-CN' : locale,
    pubDate: new Date(),
    ttl: 60,
    generator: podcast.base.title,
    author: podcast.base.title,
    categories: ['technology', 'news'],
    itunesImage: `${baseUrl}/logo.png`,
    itunesCategory: [{ text: 'Technology' }, { text: 'News' }],
    itunesOwner: {
      name: podcast.base.title,
      email: 'asn-podcast@git4ta.fun',
    },
    managingEditor: 'asn-podcast@git4ta.fun',
    webMaster: 'asn-podcast@git4ta.fun',
  })

  const runEnv = env.NODE_ENV || 'production'
  const indexKey = `index:${runEnv}:locale:${locale}`
  const episodeDates = await env.HACKER_PODCAST_KV.get(indexKey, 'json') as string[] || []
  const recentDates = episodeDates.slice(0, 10)

  const posts = (await Promise.all(
    recentDates.map(async (date) => {
      const post = await env.HACKER_PODCAST_KV.get(`content:${runEnv}:locale:${locale}:date:${date}`, 'json')
      return post as unknown as Article
    }),
  )).filter(Boolean)

  const audioSizes = await Promise.all(
    posts.map(async (post) => {
      if (post.audioSize !== undefined) {
        return post.audioSize
      }

      if (!post.audio || !/^https?:\/\//.test(post.audio)) {
        return 0
      }

      try {
        const audioInfo = await fetch(post.audio, { method: 'HEAD' })
        const contentLength = audioInfo.headers.get('content-length')
        return contentLength ? Number(contentLength) : 0
      } catch {
        return 0
      }
    }),
  )

  posts.forEach((post, index) => {
    const audioSize = audioSizes[index]

    const links = post.stories
      .map(s => `<li><a href="${s.hackerNewsUrl || s.url || ''}" title="${s.title || ''}">${s.title || ''}</a></li>`)
      .join('')
    const linkContent = `<p><b>相关链接：</b></p><ul>${links}</ul>`
    const blogContentHtml = md.render(post.blogContent || '')
    const finalContent = `
      <div>${blogContentHtml}<hr/>${linkContent}</div>
      ${env.NEXT_TRACKING_IMAGE ? `<img src="${env.NEXT_TRACKING_IMAGE}/${post.date}" alt="" width="1" height="1" loading="lazy" aria-hidden="true" style="opacity: 0;pointer-events: none;" />` : ''}
    `

    feed.addItem({
      title: post.title || '',
      description: post.introContent || post.podcastContent || '',
      content: finalContent,
      url: `${baseUrl}/episode/${post.date}`,
      guid: `/episode/${post.date}`,
      date: new Date(post.updatedAt ?? post.date),
      enclosure: {
        url: buildAudioUrl(env.NEXT_STATIC_HOST, post.audio, post.updatedAt),
        type: 'audio/mpeg',
        size: audioSize,
      },
    })
  })

  const response = new NextResponse(feed.buildXml(), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `public, max-age=${revalidate}, s-maxage=${revalidate}`,
    },
  })

  return response
}

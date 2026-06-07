import puppeteer from '@cloudflare/puppeteer'
import * as cheerio from 'cheerio'
import { $fetch } from 'ofetch'
import type { Env } from './context'

interface ContentSelector {
  include?: string
  exclude?: string
}

interface ContentKeys {
  JINA_KEY?: string
  FIRECRAWL_KEY?: string
  SEARXNG_URL?: string
}

function xmlBlock(tag: string, content: string): string {
  return `
<${tag}>
${content}
</${tag}>
`
}

/**
 * 使用 SearXNG 进行搜索
 */
export async function searchWithSearXNG(query: string, searxngUrl: string): Promise<any[]> {
  console.info('searching with searxng:', query)
  try {
    const url = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`
    const response = await $fetch<any>(url)
    return response.results || []
  } catch (error) {
    console.error('searxng search failed:', error)
    return []
  }
}

/**
 * 从 Hugo RSS 提取内容
 * @param rssUrl RSS 地址
 */
export async function getLibraryStories(rssUrl: string): Promise<Story[]> {
  console.info('fetching library stories from rss', rssUrl)
  const xml = await $fetch<string>(rssUrl, { parseResponse: txt => txt })
  const $ = cheerio.load(xml, { xmlMode: true })
  
  const stories: Story[] = []
  $('item').each((_, el) => {
    const title = $(el).find('title').text()
    const link = $(el).find('link').text()
    const description = $(el).find('description').text()
    
    stories.push({
      id: link,
      title: title,
      url: link,
      hackerNewsUrl: link, // 复用此字段作为原始链接
      content: description, // 缓存内容
    })
  })
  
  return stories
}

export async function getLibraryStory(story: Story): Promise<string> {
  const content = story.content || ''
  const cleanContent = cheerio.load(content).text().trim()
  
  const blocks = [
    story.title ? xmlBlock('title', story.title) : '',
    cleanContent ? xmlBlock('article', cleanContent) : '',
  ]

  return blocks.filter(Boolean).join('\n\n---\n\n')
}

// 保持兼容性的 Hacker News 函数
export async function getHackerNewsTopStories(today: string, env: { JINA_KEY?: string }): Promise<Story[]> {
  const rssUrl = 'https://github.seekkey.tech/index.xml'
  return getLibraryStories(rssUrl)
}

export async function getHackerNewsStory(story: Story, maxTokens: number, env: { JINA_KEY?: string }): Promise<string> {
  return getLibraryStory(story)
}

export async function queryRAG(query: string, env: Env): Promise<string> {
  try {
    const embRes = await env.AI.run('@cf/baai/bge-m3', { text: [query] })
    const vector = (embRes as any).data[0]
    const matches = await env.VECTORIZE_KUNPENGZHI.query(vector, {
      topK: 8,
      returnMetadata: true,
      returnValues: false,
    })

    const results = matches.matches || []
    if (!results.length) return ''

    return results
      .filter(m => m.metadata?.text)
      .map((m, i) => `[知识库参考 ${i + 1}] (相关度: ${m.score.toFixed(2)})\n${m.metadata!.text as string}`)
      .join('\n\n---\n\n')
  } catch (error) {
    console.error('RAG query failed:', error)
    return ''
  }
}

export async function concatAudioFiles(audioFiles: string[], BROWSER: Fetcher, { workerUrl }: { workerUrl: string }): Promise<Blob> {
  const browser = await puppeteer.launch(BROWSER)
  try {
    const page = await browser.newPage()
    await page.goto(`${workerUrl}/audio`)

    console.info('start concat audio files', audioFiles)
    const fileUrl = await page.evaluate(async (audioFiles) => {
      // @ts-expect-error 浏览器内的对象
      const blob = await concatAudioFilesOnBrowser(audioFiles)

      const result = new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      return await result
    }, audioFiles) as string

    console.info('concat audio files result', fileUrl.substring(0, 100))

    const response = await fetch(fileUrl)
    return await response.blob()
  }
  finally {
    await browser.close()
  }
}

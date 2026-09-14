import { env } from 'cloudflare:workers'
import { cache } from 'react'

const EPISODE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 剧集内容在 KV 中的统一键前缀。
 * 首页列表、单集页、RSS、sitemap 全部走这一套，不要再引入第二套键。
 */
export function contentKeyPrefix(runEnv: string): string {
  return `content:${runEnv}:hacker-podcast:`
}

/**
 * 列出 KV 中实际存在的剧集日期（倒序）。
 *
 * 早期实现是按「最近 N 天」逐日 get，这会带来两个问题：
 * 1. 超出窗口的旧剧集会凭空消失；
 * 2. 空白天也要发 N 次请求。
 * 改为按前缀 list，只读真实存在的键。
 */
async function listEpisodeDatesUncached(): Promise<string[]> {
  const runEnv = env.NODE_ENV || 'production'
  const prefix = contentKeyPrefix(runEnv)
  const dates: string[] = []
  let cursor: string | undefined

  for (;;) {
    const page = await env.HACKER_PODCAST_KV.list({ prefix, cursor })
    for (const key of page.keys) {
      const date = key.name.slice(prefix.length)
      if (EPISODE_DATE_PATTERN.test(date)) {
        dates.push(date)
      }
    }

    if (page.list_complete) {
      break
    }

    cursor = page.cursor
  }

  return dates.sort((a, b) => (a < b ? 1 : -1))
}

export const listEpisodeDates = cache(listEpisodeDatesUncached)

async function getArticleByDateUncached(date: string): Promise<Article | null> {
  const runEnv = env.NODE_ENV || 'production'
  const article = await env.HACKER_PODCAST_KV.get(`${contentKeyPrefix(runEnv)}${date}`, 'json')
  return article as Article | null
}

export const getArticleByDate = cache(getArticleByDateUncached)

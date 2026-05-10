import { env } from 'cloudflare:workers'
import { cache } from 'react'

async function getArticleByDateUncached(date: string): Promise<Article | null> {
  const runEnv = env.NODE_ENV || 'production'
  const article = await env.HACKER_PODCAST_KV.get(`content:${runEnv}:hacker-podcast:${date}`, 'json')
  return article as Article | null
}

export const getArticleByDate = cache(getArticleByDateUncached)

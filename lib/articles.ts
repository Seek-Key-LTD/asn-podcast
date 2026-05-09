import { env } from 'cloudflare:workers'
import { cache } from 'react'

export const getArticleByDate = cache(async (date: string, locale: string = 'zh'): Promise<Article | null> => {
  const runEnv = env.NODE_ENV || 'production'
  // Use the new multi-locale key structure
  return await env.HACKER_PODCAST_KV.get(`content:${runEnv}:locale:${locale}:date:${date}`, 'json') as unknown as Article | null
})

import type { EpisodeListRow, EpisodeRow, Page, SeriesRow, SeriesWithCounts } from '@/lib/db'
import { env } from 'cloudflare:workers'
import { cache } from 'react'
import {
  getEpisodeBySlug,
  getSeriesByFeedSlug,
  listDailyPage,
  listFeedEpisodes,
  listSeriesEpisodes,
  listSeriesForIndex,
  listSeriesSitemapEntries,
  listSitemapEntries,
  resolveLegacySlug,
} from '@/lib/db'

/**
 * 读侧的缓存包装层。`lib/db.ts` 只管 SQL，这里只管「按当前环境取数 + 请求内去重」。
 *
 * 注意 `cache()` 只做**单次请求内**去重，不是跨请求缓存。扛并发的是各路由的
 * `export const revalidate`（首页 600s / RSS 3600s / 单集 7200s / sitemap 86400s）。
 * D1 是单库单线程、查询串行，那几个数字是第一道缓冲，别为了"实时"调小。
 */

/** 日期形状的旧 slug，用来识别需要 308 的遗留路径。 */
export const EPISODE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function runEnv(): string {
  return env.NODE_ENV || 'production'
}

/**
 * `HACKER_PODCAST_DB` 在 CloudflareEnv 里是必绑的（两个 wrangler.jsonc 都声明了），
 * 所以这里不用兜底——真为 undefined 就该直接炸，而不是静默返回空列表。
 */
function db(): D1Database {
  return env.HACKER_PODCAST_DB
}

export const getEpisode = cache((slug: string): Promise<EpisodeRow | null> =>
  getEpisodeBySlug(db(), runEnv(), slug))

export const getLegacyTarget = cache((legacySlug: string): Promise<string | null> =>
  resolveLegacySlug(db(), runEnv(), legacySlug))

export const getDailyPage = cache((page: number, pageSize: number): Promise<Page<EpisodeListRow>> =>
  listDailyPage(db(), runEnv(), page, pageSize))

export const getSeriesIndex = cache((): Promise<SeriesWithCounts[]> =>
  listSeriesForIndex(db(), runEnv()))

export const getSeries = cache((feedSlug: string): Promise<SeriesRow | null> =>
  getSeriesByFeedSlug(db(), runEnv(), feedSlug))

export const getSeriesEpisodes = cache((seriesId: string): Promise<EpisodeListRow[]> =>
  listSeriesEpisodes(db(), runEnv(), seriesId))

export const getFeedEpisodes = cache((kind: 'daily' | 'series', limit: number, seriesId?: string): Promise<EpisodeRow[]> =>
  listFeedEpisodes(db(), runEnv(), kind, limit, seriesId))

export const getSitemapEpisodes = cache(() => listSitemapEntries(db(), runEnv()))

export const getSitemapSeries = cache(() => listSeriesSitemapEntries(db()))

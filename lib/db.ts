/**
 * 剧集目录的 SQL 层。所有 D1 读写都走这个文件——别在别处拼 SQL。
 *
 * 三条硬规矩：
 *   0. **db 显式传入，不用模块级的 `cloudflare:workers` env**。workflow 的
 *      `step.do` 回调里没有请求上下文，模块级 env 可能是 undefined；显式传
 *      `ctx.db` 两边都安全。
 *   1. **读函数一律要 env 参数且不给默认值**。KV 时代 dev/prod 靠键前缀隔离，
 *      进 D1 后靠 `env` 列；漏传就编译不过，这是对「管线跑在 development、
 *      读侧跑在 production」那个坑的工程化防线。
 *   2. **列表查询不投影 blog_content / podcast_content / stories_json**。
 *      那些字段是整篇 markdown，列表页只渲染 summary——不投影能把首页的
 *      RSC payload 砍掉 80% 以上。
 */

// ---- 行类型 ----------------------------------------------------------------

export interface SeriesRow {
  id: string
  title: string
  description: string
  cover: string | null
  feed_slug: string
  sort_order: number
  created_at: number
  updated_at: number
}

export interface EpisodeRow {
  env: string
  slug: string
  kind: 'daily' | 'series'
  date: string | null
  legacy_slug: string | null
  series_id: string | null
  episode_no: string | null
  season: number | null
  episode_major: number | null
  episode_minor: number | null
  title: string
  summary: string
  intro_content: string
  blog_content: string
  podcast_content: string
  stories_json: string
  tags_json: string
  audio_url: string
  audio_bytes: number | null
  duration_sec: number | null
  published_at: number
  updated_at: number
}

/** 列表投影：去掉几个大字段。注意 blog_content 等在这里**不存在**，误用会编译报错。 */
export type EpisodeListRow
  = Omit<EpisodeRow, 'blog_content' | 'podcast_content' | 'stories_json' | 'tags_json'>

export type SitemapRow = Pick<EpisodeRow, 'slug' | 'kind' | 'series_id' | 'updated_at'>

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SeriesWithCounts extends SeriesRow {
  episode_count: number
  latest_published_at: number | null
}

export interface UpcomingSeason {
  series_id: string
  season: number
  /** Unix 毫秒；null = 待定。 */
  premieres_at: number | null
  /** 日期依据，如「立冬」。 */
  note: string
}

/** 货架卡片用的聚合结果：series 行的统计 + 尚未开播的季。 */
export interface SeriesForShelf extends SeriesWithCounts {
  upcoming: UpcomingSeason[]
}

// ---- 列清单 ----------------------------------------------------------------

/** 显式列名而不是 SELECT *：将来加列时不会把大字段悄悄带进 payload。 */
const LIST_COLUMNS = `slug, kind, date, series_id, episode_no, season,
  episode_major, episode_minor, title, summary, intro_content,
  audio_url, audio_bytes, duration_sec, published_at, updated_at`

const FULL_COLUMNS = `env, slug, kind, date, legacy_slug, series_id, episode_no,
  season, episode_major, episode_minor, title, summary, intro_content,
  blog_content, podcast_content, stories_json, tags_json,
  audio_url, audio_bytes, duration_sec, published_at, updated_at`

// ---- 读：单集与列表 ---------------------------------------------------------

export async function getEpisodeBySlug(db: D1Database, envName: string, slug: string): Promise<EpisodeRow | null> {
  const row = await db
    .prepare(`SELECT ${FULL_COLUMNS} FROM episodes WHERE env = ?1 AND slug = ?2 LIMIT 1`)
    .bind(envName, slug)
    .first<EpisodeRow>()
  return row ?? null
}

/** 旧 URL（`/episode/2026-09-14` 这种日期式路径）→ 新的 slug。 */
export async function resolveLegacySlug(db: D1Database, envName: string, legacySlug: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT slug FROM episodes WHERE env = ?1 AND legacy_slug = ?2 LIMIT 1`)
    .bind(envName, legacySlug)
    .first<{ slug: string }>()
  return row?.slug ?? null
}

/** 日报分页。走 idx_ep_daily_date，一条 SQL 拿一页 + 总数。 */
export async function listDailyPage(db: D1Database, envName: string, page: number, pageSize: number): Promise<Page<EpisodeListRow>> {
  const safePage = Math.max(1, Math.floor(page) || 1)

  const [countRow, listed] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS n FROM episodes WHERE env = ?1 AND kind = 'daily'`)
      .bind(envName)
      .first<{ n: number }>(),
    db
      .prepare(`SELECT ${LIST_COLUMNS} FROM episodes WHERE env = ?1 AND kind = 'daily'
                ORDER BY date DESC LIMIT ?2 OFFSET ?3`)
      .bind(envName, pageSize, (safePage - 1) * pageSize)
      .all<EpisodeListRow>(),
  ])

  const total = countRow?.n ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    items: listed.results ?? [],
    total,
    page: Math.min(safePage, totalPages),
    pageSize,
    totalPages,
  }
}

// ---- 读：系列 --------------------------------------------------------------

export async function getSeriesByFeedSlug(db: D1Database, envName: string, feedSlug: string): Promise<SeriesRow | null> {
  const row = await db
    .prepare(`SELECT id, title, description, cover, feed_slug, sort_order, created_at, updated_at
              FROM series WHERE feed_slug = ?1 LIMIT 1`)
    .bind(feedSlug)
    .first<SeriesRow>()
  return row ?? null
}

/**
 * 首页货架的系列卡片。
 *
 * 注意 episodes 侧的 env 过滤写在 JOIN 的 ON 里而不是 WHERE：写在 WHERE 会把
 * 没有该 env 剧集的系列整行滤掉，货架就空了。
 */
export async function listSeriesForIndex(db: D1Database, envName: string): Promise<SeriesWithCounts[]> {
  const res = await db
    .prepare(`SELECT s.id, s.title, s.description, s.cover, s.feed_slug,
                     s.sort_order, s.created_at, s.updated_at,
                     COUNT(e.slug) AS episode_count,
                     MAX(e.published_at) AS latest_published_at
              FROM series s
              LEFT JOIN episodes e ON e.series_id = s.id AND e.env = ?1
              GROUP BY s.id
              ORDER BY s.sort_order ASC, latest_published_at DESC`)
    .bind(envName)
    .all<SeriesWithCounts>()
  return res.results ?? []
}

/** 所有尚未开播的季。数据量极小（每剧每季一行），一次全取再在内存里归组。 */
export async function listSeasonPremieres(db: D1Database): Promise<UpcomingSeason[]> {
  const res = await db
    .prepare(`SELECT series_id, season, premieres_at, note
              FROM season_premieres ORDER BY series_id ASC, season ASC`)
    .all<UpcomingSeason>()
  return res.results ?? []
}

/** 系列全集，按期次正序。E8.5 会自然落在 E8 与 E10 之间。 */
export async function listSeriesEpisodes(db: D1Database, envName: string, seriesId: string): Promise<EpisodeListRow[]> {
  const res = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM episodes
              WHERE env = ?1 AND series_id = ?2
              ORDER BY season ASC, episode_major ASC, episode_minor ASC`)
    .bind(envName, seriesId)
    .all<EpisodeListRow>()
  return res.results ?? []
}

// ---- 读：feed 与 sitemap ---------------------------------------------------

/** feed 要全文（description 用 intro_content）。日报按日期倒序，系列剧按期次正序。 */
export async function listFeedEpisodes(
  db: D1Database,
  envName: string,
  kind: 'daily' | 'series',
  limit: number,
  seriesId?: string,
): Promise<EpisodeRow[]> {
  const order = kind === 'daily'
    ? 'ORDER BY date DESC'
    : 'ORDER BY season ASC, episode_major ASC, episode_minor ASC'

  const sql = kind === 'daily'
    ? `SELECT ${FULL_COLUMNS} FROM episodes WHERE env = ?1 AND kind = 'daily' ${order} LIMIT ?2`
    : `SELECT ${FULL_COLUMNS} FROM episodes WHERE env = ?1 AND series_id = ?2 ${order} LIMIT ?3`

  const stmt = kind === 'daily'
    ? db.prepare(sql).bind(envName, limit)
    : db.prepare(sql).bind(envName, seriesId, limit)

  const res = await stmt.all<EpisodeRow>()
  return res.results ?? []
}

export async function listSitemapEntries(db: D1Database, envName: string): Promise<SitemapRow[]> {
  const res = await db
    .prepare(`SELECT slug, kind, series_id, updated_at FROM episodes WHERE env = ?1 ORDER BY updated_at DESC`)
    .bind(envName)
    .all<SitemapRow>()
  return res.results ?? []
}

export async function listSeriesSitemapEntries(db: D1Database): Promise<Array<Pick<SeriesRow, 'feed_slug' | 'updated_at'>>> {
  const res = await db
    .prepare(`SELECT feed_slug, updated_at FROM series ORDER BY sort_order ASC`)
    .all<Pick<SeriesRow, 'feed_slug' | 'updated_at'>>()
  return res.results ?? []
}

// ---- 写 --------------------------------------------------------------------

export interface EpisodeUpsert {
  env: string
  slug: string
  kind: 'daily' | 'series'
  date?: string | null
  legacySlug?: string | null
  seriesId?: string | null
  episodeNo?: string | null
  season?: number | null
  episodeMajor?: number | null
  episodeMinor?: number | null
  title: string
  summary: string
  introContent: string
  blogContent: string
  podcastContent: string
  storiesJson: string
  tagsJson: string
  audioUrl: string
  audioBytes?: number | null
  durationSec?: number | null
  publishedAt: number
  updatedAt: number
}

/**
 * upsert 一条剧集。
 *
 * `ON CONFLICT DO UPDATE` 不是优化，是正确性要求：workflow 的 `step.do` 配了
 * `retries.limit = 5`，裸 INSERT 在第 2 次重试就会抛 UNIQUE，把 5 次重试全烧掉
 * 然后整条 workflow 失败。
 *
 * 三个刻意的取舍：
 *   `published_at` 不在 DO UPDATE 里——重跑不该改写首发时刻。
 *   `audio_bytes` 用 COALESCE——processAudio 在没有 BROWSER 时返回 0，
 *     别拿 0 覆盖掉已有的正确值。
 *   一律 `prepare().bind()`，绝不拼字符串——LLM 生成的正文可能撞 D1 那条
 *     100 KB 的语句上限，而绑定参数的值不计入上限。
 */
export async function upsertEpisode(db: D1Database, row: EpisodeUpsert): Promise<void> {
  await db
    .prepare(`INSERT INTO episodes (
        env, slug, kind, date, legacy_slug, series_id, episode_no,
        season, episode_major, episode_minor,
        title, summary, intro_content, blog_content, podcast_content,
        stories_json, tags_json, audio_url, audio_bytes, duration_sec,
        published_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
        ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22
      )
      ON CONFLICT(env, slug) DO UPDATE SET
        title           = excluded.title,
        summary         = excluded.summary,
        intro_content   = excluded.intro_content,
        blog_content    = excluded.blog_content,
        podcast_content = excluded.podcast_content,
        stories_json    = excluded.stories_json,
        tags_json       = excluded.tags_json,
        audio_url       = excluded.audio_url,
        audio_bytes     = COALESCE(excluded.audio_bytes, episodes.audio_bytes),
        duration_sec    = COALESCE(excluded.duration_sec, episodes.duration_sec),
        updated_at      = excluded.updated_at`)
    .bind(
      row.env,
      row.slug,
      row.kind,
      row.date ?? null,
      row.legacySlug ?? null,
      row.seriesId ?? null,
      row.episodeNo ?? null,
      row.season ?? null,
      row.episodeMajor ?? null,
      row.episodeMinor ?? null,
      row.title,
      row.summary,
      row.introContent,
      row.blogContent,
      row.podcastContent,
      row.storiesJson,
      row.tagsJson,
      row.audioUrl,
      row.audioBytes ?? null,
      row.durationSec ?? null,
      row.publishedAt,
      row.updatedAt,
    )
    .run()
}

export async function upsertSeries(db: D1Database, row: {
  id: string
  title: string
  description: string
  cover?: string | null
  feedSlug: string
  sortOrder?: number
}): Promise<void> {
  const now = Date.now()
  await db
    .prepare(`INSERT INTO series (id, title, description, cover, feed_slug, sort_order, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
              ON CONFLICT(id) DO UPDATE SET
                title       = excluded.title,
                description = excluded.description,
                cover       = COALESCE(excluded.cover, series.cover),
                feed_slug   = excluded.feed_slug,
                sort_order  = excluded.sort_order,
                updated_at  = excluded.updated_at`)
    .bind(row.id, row.title, row.description, row.cover ?? null, row.feedSlug, row.sortOrder ?? 0, now, now)
    .run()
}

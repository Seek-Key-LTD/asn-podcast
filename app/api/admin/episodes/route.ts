import type { EpisodeUpsert } from '@/lib/db'
import { env } from 'cloudflare:workers'
import { NextResponse } from 'next/server'
import { buildUpsertEpisode, upsertEpisode } from '@/lib/db'
import { validateEpisodeInput } from '@/lib/episode-input'

export const dynamic = 'force-dynamic'

/**
 * 管理端写入接口，供 N8N flow（或任何编排工具）把剧集写进 D1。
 *
 * 鉴权：Bearer 令牌，取自环境变量 `ADMIN_API_TOKEN`。
 *   - 未配置令牌 → 503（fail-closed，绝不裸奔）。
 *   - 令牌已配置但请求没带 / 带错 → 401。
 *
 * 生产用 `wrangler secret put ADMIN_API_TOKEN` 注入；本地用 `.dev.vars` 的
 * `ADMIN_API_TOKEN=...`（见 .gitignore，不会进仓库）。
 *
 * 请求体：单个对象，或对象数组（批量，走 `db.batch` 原子写入）。
 * 字段直接对应 `EpisodeUpsert`（camelCase）。`env` 缺省 'production'，所以写
 * 进去的剧集前台立刻可见（读侧无 NODE_ENV 时按 production 取数）。
 *
 * 响应：
 *   200 { ok: true, upserted: N }
 *   400 { ok: false, error, details? }   校验失败
 *   401 { ok: false, error: 'unauthorized' }
 *   503 { ok: false, error: 'server misconfigured: ADMIN_API_TOKEN unset' }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = env.ADMIN_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'server misconfigured: ADMIN_API_TOKEN unset' },
      { status: 503 },
    )
  }

  const auth = request.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  if (provided !== token) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  const items = Array.isArray(body) ? body : [body]
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: 'empty batch' }, { status: 400 })
  }

  const values: EpisodeUpsert[] = []
  const errors: { index: number, error: string }[] = []
  items.forEach((raw, i) => {
    const res = validateEpisodeInput(raw)
    if (res.ok)
      values.push(res.value)
    else
      errors.push({ index: i, error: res.error })
  })
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: 'validation failed', details: errors }, { status: 400 })
  }

  const db = env.HACKER_PODCAST_DB
  try {
    if (values.length === 1) {
      await upsertEpisode(db, values[0]!)
    }
    else {
      await db.batch(values.map(v => buildUpsertEpisode(db, v)))
    }
  }
  catch (e) {
    return NextResponse.json(
      { ok: false, error: 'database error', message: String(e) },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, upserted: values.length })
}

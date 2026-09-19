import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ALLOWED_TRANSCRIPT_HOSTS = new Set([
  'podcast-r2.git4ta.fun',
  'cernet-s3.git4ta.fun',
])

function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 400 })
}

export async function GET(request: Request): Promise<Response> {
  const source = new URL(request.url).searchParams.get('url')
  if (!source)
    return badRequest('missing url')

  let target: URL
  try {
    target = new URL(source)
  }
  catch {
    return badRequest('invalid url')
  }

  if (target.protocol !== 'https:' || !ALLOWED_TRANSCRIPT_HOSTS.has(target.hostname))
    return badRequest('transcript host is not allowed')

  try {
    const upstream = await fetch(target, {
      headers: { Accept: 'text/plain, text/vtt, */*' },
    })
    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `upstream returned ${upstream.status}` },
        { status: upstream.status },
      )
    }

    return new Response(await upstream.text(), {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': upstream.headers.get('content-type') ?? 'text/plain; charset=utf-8',
      },
    })
  }
  catch {
    return NextResponse.json({ ok: false, error: 'transcript fetch failed' }, { status: 502 })
  }
}

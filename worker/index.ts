import { HackerNewsWorkflow } from '../workflow'
import synthesize from '../workflow/tts'

interface Env extends CloudflareEnv {
  HACKER_PODCAST_WORKFLOW: Workflow
  BROWSER: Fetcher
  HACKER_PODCAST_WORKER_URL: string
  HACKER_PODCAST_R2_BUCKET_URL: string
  QSTASH_URL?: string
  QSTASH_TOKEN?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    if (pathname === '/audio') {
      return fetch(new URL(pathname, request.url))
    }

    if (pathname === '/scheduled') {
      const id = await env.HACKER_PODCAST_WORKFLOW.create()
      return new Response(`Workflow created: ${id.id}`)
    }

    if (pathname === '/api/tts' && request.method === 'POST') {
      try {
        const { text, gender, instanceId, podcastKey, segmentIndex } = await request.json<{
          text: string
          gender: string
          instanceId: string
          podcastKey: string
          segmentIndex: number
        }>()

        const audio = await synthesize(text, gender, env)

        if (!audio.size) {
          throw new Error('synthesized audio is empty')
        }

        const audioKey = `tmp/${instanceId}/${podcastKey}-${segmentIndex}.mp3`
        await env.HACKER_PODCAST_R2.put(audioKey, audio)

        const audioUrl = `${env.HACKER_PODCAST_R2_BUCKET_URL}/${audioKey}`
        await env.HACKER_PODCAST_KV.put(`tmp:${instanceId}:audio:${segmentIndex}`, audioUrl, { expirationTtl: 3600 })

        return new Response(JSON.stringify({ success: true, audioUrl }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (error) {
        console.error('TTS handler failed:', error)
        return new Response(JSON.stringify({ success: false, error: String(error) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('ASN Podcast Worker is running. Content is stored in KV/R2.')
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await env.HACKER_PODCAST_WORKFLOW.create()
  },
}

export { HackerNewsWorkflow }

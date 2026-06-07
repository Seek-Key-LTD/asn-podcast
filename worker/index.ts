import { HackerNewsWorkflow } from '../workflow'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    if (pathname === '/audio') {
      return fetch(new URL(pathname, request.url))
    }

    if (pathname === '/scheduled') {
      const id = await env.HACKER_PODCAST_WORKFLOW.create()
      return new Response(\`Workflow created: \${id.id}\`)
    }

    return new Response('ASN Podcast Worker is running. Content is stored in KV/R2.')
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await env.HACKER_PODCAST_WORKFLOW.create()
  },
}

export { HackerNewsWorkflow }

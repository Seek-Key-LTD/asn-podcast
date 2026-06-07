export * from '../workflow'

interface Env extends CloudflareEnv {
  HACKER_PODCAST_WORKFLOW: Workflow
  BROWSER: Fetcher
  PUSH_TOKEN: string // Secret token for pushing content from local agents
}

export default {
  runWorkflow(event: ScheduledEvent | Request, env: Env, ctx: ExecutionContext) {
    console.info('trigger event by:', event)

    const createWorkflow = async () => {
      const instance = await env.HACKER_PODCAST_WORKFLOW.create()

      const instanceDetails = {
        id: instance.id,
        details: await instance.status(),
      }

      console.info('instance detail:', instanceDetails)
      return instanceDetails
    }

    ctx.waitUntil(createWorkflow())

    return new Response('create workflow success')
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname, hostname } = new URL(request.url)

    // 1. 静态资源处理
    if (pathname.includes('/static')) {
      const filename = pathname.replace('/static/', '')
      const file = await env.HACKER_PODCAST_R2.get(filename)
      console.info('fetch static file:', filename, {
        uploaded: file?.uploaded,
        size: file?.size,
      })
      return new Response(file?.body)
    }

    // 2. 自定义内容推送接口 (用于本地 Agents/GitLab CI)
    if (pathname === '/api/v1/publish' && request.method === 'POST') {
      const auth = request.headers.get('Authorization')
      if (auth !== `Bearer ${env.PUSH_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 })
      }

      try {
        const body = await request.json<{ title: string, content: string, articles?: Array<{ title: string, content: string, url?: string }> }>()
        
        // Trigger workflow with custom payload
        const instance = await env.HACKER_PODCAST_WORKFLOW.create()

        return new Response(JSON.stringify({ 
          success: true, 
          instanceId: instance.id,
          message: 'Workflow triggered successfully' 
        }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      catch (error) {
        console.error('Failed to trigger workflow:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    }

    // 3. 原有 Workflow 触发 (保持兼容，可用于以后抓取其他源)
    if (request.method === 'POST' && hostname === 'localhost') {
      return this.runWorkflow(request, env, ctx)
    }

    // 4. 重定向到主应用
    return Response.redirect(`${pathname}`, 302)
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    return this.runWorkflow(event, env, ctx)
  },
}

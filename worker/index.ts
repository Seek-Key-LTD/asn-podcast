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
        const payload = await request.json() as Article
        // 构造多语种 Key: content:production:locale:zh:date:2026-05-09
        const kvKey = `content:production:locale:${payload.locale || 'zh'}:date:${payload.date}`
        await env.HACKER_PODCAST_KV.put(kvKey, JSON.stringify({
          ...payload,
          updatedAt: Date.now(),
        }))
        
        // 更新语种索引 (用于首页流式加载)
        const indexKey = `index:production:locale:${payload.locale || 'zh'}`
        const existingIndex = await env.HACKER_PODCAST_KV.get(indexKey, 'json') as string[] || []
        if (!existingIndex.includes(payload.date)) {
          existingIndex.unshift(payload.date)
          // 只保留最近 100 期
          await env.HACKER_PODCAST_KV.put(indexKey, JSON.stringify(existingIndex.slice(0, 100)))
        }

        return new Response('Published successfully', { status: 200 })
      }
      catch (err) {
        console.error('Publish failed', err)
        return new Response('Internal Server Error', { status: 500 })
      }
    }

    // 3. 原有 Workflow 触发 (保持兼容，可用于以后抓取其他源)
    if (request.method === 'POST' && hostname === 'localhost') {
      return this.runWorkflow(request, env, ctx)
    }

    // 4. 重定向到主应用
    return Response.redirect(`https://hacker-podcast.agi.li${pathname}`, 302)
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    return this.runWorkflow(event, env, ctx)
  },
}

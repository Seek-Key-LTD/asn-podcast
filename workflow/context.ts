import type { WorkflowEvent, WorkflowSleepDuration } from 'cloudflare:workers'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export interface Params {
  today?: string
}

export interface Env extends CloudflareEnv {
  OPENAI_BASE_URL: string
  OPENAI_API_KEY: string
  OPENAI_MODEL: string
  OPENAI_THINKING_MODEL?: string
  OPENAI_MAX_TOKENS?: string
  JINA_KEY?: string
  SEARXNG_URL?: string
  NODE_ENV: string
  HACKER_PODCAST_WORKER_URL: string
  HACKER_PODCAST_WORKFLOW: Workflow
  BROWSER: Fetcher
  AI: Ai
  VECTORIZE_KUNPENGZHI: VectorizeIndex
  QSTASH_URL?: string
  QSTASH_TOKEN?: string
  QSTASH_TTS_URL?: string
  HACKER_PODCAST_WORKER_DEPLOY_URL?: string
}

export interface WorkflowContext {
  runEnv: string
  isDev: boolean
  breakTime: WorkflowSleepDuration
  today: string
  openai: ReturnType<typeof createOpenAICompatible>
  maxTokens: number
  env: Env
}

export interface GeneratedContents {
  podcastContent: string
  blogContent: string
  introContent: string
}

export interface AudioResult {
  audioSize?: number
  // 必填：D1 的 episodes.audio_url 是 NOT NULL。processAudio 两个分支都返回字符串
  // （无 BROWSER 时为空串），所以这里不能声明成可选，否则 saveContent 会拿到
  // string | undefined 并在写库时炸掉。
  podcastAudioUrl: string
  conversations: string[]
}

function parseMaxTokens(value?: string): number {
  const maxTokens = Number.parseInt(value || '', 10)
  return Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 4096
}

export function buildContext(env: Env, event: WorkflowEvent<Params>): WorkflowContext {
  const runEnv = env.NODE_ENV || 'production'
  const isDev = runEnv !== 'production'
  const breakTime = isDev ? '2 seconds' : '5 seconds'
  const today = event.payload?.today || new Date().toISOString().split('T')[0]
  const openai = createOpenAICompatible({
    name: 'openai',
    baseURL: env.OPENAI_BASE_URL,
    apiKey: env.OPENAI_API_KEY,
  })
  const maxTokens = parseMaxTokens(env.OPENAI_MAX_TOKENS)

  return { runEnv, isDev, breakTime, today, openai, maxTokens, env }
}

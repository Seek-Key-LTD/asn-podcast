import type { WorkflowEvent, WorkflowStep, WorkflowStepConfig } from 'cloudflare:workers'
import type { AudioResult, Env, GeneratedContents, Params, WorkflowContext } from './context'
import { generateText } from 'ai'
import { WorkflowEntrypoint } from 'cloudflare:workers'
import { podcastTitle } from '@/config'
import { buildContext } from './context'
import { stepNames } from './names'
import { introPrompt, summarizeBlogPrompt, summarizePodcastPrompt, summarizeStoryPrompt } from './prompt'
import synthesize from './tts'
import { concatAudioFiles, getHackerNewsStory, getHackerNewsTopStories } from './utils'

const retryConfig: WorkflowStepConfig = {
  retries: {
    limit: 5,
    delay: '10 seconds',
    backoff: 'exponential',
  },
  timeout: '3 minutes',
}

async function getTopStories(today: string, isDev: boolean, step: WorkflowStep, env: Env): Promise<Story[]> {
  return await step.do(stepNames.topStories(today), retryConfig, async () => {
    const topStories = await getHackerNewsTopStories(today, env)

    if (!topStories.length) {
      throw new Error('no stories found')
    }

    topStories.length = Math.min(topStories.length, isDev ? 1 : 10)

    return topStories
  })
}

async function processStories(stories: Story[], step: WorkflowStep, ctx: WorkflowContext, event: WorkflowEvent<Params>): Promise<string[]> {
  for (const story of stories) {
    const storyResponse = await step.do(stepNames.storyContent(story), retryConfig, async () => {
      return await getHackerNewsStory(story, ctx.maxTokens, ctx.env)
    })

    console.info(`get story ${story.id} content success`)

    const text = await step.do(stepNames.storySummary(story), retryConfig, async () => {
      const { text, usage, finishReason } = await generateText({
        model: ctx.openai(ctx.env.OPENAI_MODEL),
        system: summarizeStoryPrompt,
        prompt: storyResponse,
      })

      console.info(`get story ${story.id} summary success`, { text, usage, finishReason })
      return text
    })

    await step.do(stepNames.cacheStorySummary(story), retryConfig, async () => {
      const storyKey = `tmp:${event.instanceId}:story:${story.id}`
      await ctx.env.HACKER_PODCAST_KV.put(storyKey, `<story>${text}</story>`, { expirationTtl: 3600 })
      return storyKey
    })

    await step.sleep(stepNames.pauseAfterStory(story), ctx.breakTime)
  }

  return await step.do(stepNames.collectStorySummaries, retryConfig, async () => {
    const summaries = await Promise.all(
      stories.map((story) => {
        const storyKey = `tmp:${event.instanceId}:story:${story.id}`
        return ctx.env.HACKER_PODCAST_KV.get(storyKey)
      }),
    )
    return summaries.filter((summary): summary is string => Boolean(summary))
  })
}

async function generateContents(allStories: string[], stories: Story[], step: WorkflowStep, ctx: WorkflowContext): Promise<GeneratedContents> {
  const podcastContent = await step.do(stepNames.generatePodcastScript, retryConfig, async () => {
    const { text, usage, finishReason } = await generateText({
      model: ctx.openai(ctx.env.OPENAI_THINKING_MODEL || ctx.env.OPENAI_MODEL),
      system: summarizePodcastPrompt,
      prompt: allStories.join('\n\n---\n\n'),
      maxOutputTokens: ctx.maxTokens,
      maxRetries: 3,
    })

    console.info(`create hacker podcast content success`, { text, usage, finishReason })

    return text
  })

  console.info('podcast content:\n', ctx.isDev ? podcastContent : podcastContent.slice(0, 100))

  await step.sleep(stepNames.pauseAfterPodcastScript, ctx.breakTime)

  const blogContent = await step.do(stepNames.generateBlogArticle, retryConfig, async () => {
    const { text, usage, finishReason } = await generateText({
      model: ctx.openai(ctx.env.OPENAI_THINKING_MODEL || ctx.env.OPENAI_MODEL),
      system: summarizeBlogPrompt,
      prompt: `<stories>${JSON.stringify(stories)}</stories>\n\n---\n\n${allStories.join('\n\n---\n\n')}`,
      maxOutputTokens: ctx.maxTokens,
      maxRetries: 3,
    })

    console.info(`create hacker daily blog content success`, { text, usage, finishReason })

    return text
  })

  console.info('blog content:\n', ctx.isDev ? blogContent : blogContent.slice(0, 100))

  await step.sleep(stepNames.pauseAfterBlogArticle, ctx.breakTime)

  const introContent = await step.do(stepNames.generateIntro, retryConfig, async () => {
    const { text, usage, finishReason } = await generateText({
      model: ctx.openai(ctx.env.OPENAI_MODEL),
      system: introPrompt,
      prompt: podcastContent,
      maxRetries: 3,
    })

    console.info(`create intro content success`, { text, usage, finishReason })

    return text
  })

  return { podcastContent, blogContent, introContent }
}

async function processAudio(podcastContent: string, podcastKey: string, step: WorkflowStep, ctx: WorkflowContext, event: WorkflowEvent<Params>): Promise<AudioResult> {
  const conversations = podcastContent.split('\n').filter(Boolean)

  for (const [index, conversation] of conversations.entries()) {
    await step.do(stepNames.audioSegment(index), { ...retryConfig, timeout: '5 minutes' }, async () => {
      if (
        !(conversation.startsWith('男') || conversation.startsWith('女'))
        || !conversation.substring(2).trim()
      ) {
        console.warn('conversation is not valid', conversation)
        return conversation
      }

      console.info('create conversation audio', conversation)
      const audio = await synthesize(conversation.substring(2), conversation[0], ctx.env)

      if (!audio.size) {
        throw new Error('podcast audio size is 0')
      }

      const audioKey = `tmp/${event.instanceId}/${podcastKey}-${index}.mp3`
      const audioUrl = `${ctx.env.HACKER_PODCAST_R2_BUCKET_URL}/${audioKey}?t=${Date.now()}`

      await ctx.env.HACKER_PODCAST_R2.put(audioKey, audio)

      await ctx.env.HACKER_PODCAST_KV.put(`tmp:${event.instanceId}:audio:${index}`, audioUrl, { expirationTtl: 3600 })
      return audioUrl
    })
  }

  const audioFiles = await step.do(stepNames.collectAudioSegments, retryConfig, async () => {
    const audioUrls = await Promise.all(
      conversations.map((_, index) => ctx.env.HACKER_PODCAST_KV.get(`tmp:${event.instanceId}:audio:${index}`)),
    )
    return audioUrls.filter((audioUrl): audioUrl is string => Boolean(audioUrl))
  })

  const audioSize = await step.do(stepNames.mergeAudioSegments, retryConfig, async () => {
    if (!ctx.env.BROWSER) {
      console.warn('browser is not configured, skip concat audio files')
      return
    }

    const blob = await concatAudioFiles(audioFiles, ctx.env.BROWSER, { workerUrl: ctx.env.HACKER_PODCAST_WORKER_URL })
    await ctx.env.HACKER_PODCAST_R2.put(podcastKey, blob)

    const podcastAudioUrl = `${ctx.env.HACKER_PODCAST_R2_BUCKET_URL}/${podcastKey}?t=${Date.now()}`
    console.info('podcast audio url', podcastAudioUrl)
    return blob.size
  })

  console.info('save podcast to r2 success')

  return { audioSize, conversations }
}

async function saveContent(contentKey: string, podcastKey: string, stories: Story[], contents: GeneratedContents, audioSize: number | undefined, step: WorkflowStep, ctx: WorkflowContext): Promise<void> {
  await step.do(stepNames.saveEpisodeContent, retryConfig, async () => {
    await ctx.env.HACKER_PODCAST_KV.put(contentKey, JSON.stringify({
      date: ctx.today,
      title: `${podcastTitle} ${ctx.today}`,
      stories,
      podcastContent: contents.podcastContent,
      blogContent: contents.blogContent,
      introContent: contents.introContent,
      audio: podcastKey,
      audioSize,
      updatedAt: Date.now(),
    }))

    return contents.introContent
  })

  console.info('save content to kv success')
}

async function cleanupTempData(stories: Story[], conversations: string[], podcastKey: string, step: WorkflowStep, ctx: WorkflowContext, event: WorkflowEvent<Params>): Promise<void> {
  await step.do(stepNames.cleanupTemporaryData, retryConfig, async () => {
    const deletePromises = []

    // Clean up story temporary data
    for (const story of stories) {
      const storyKey = `tmp:${event.instanceId}:story:${story.id}`
      deletePromises.push(ctx.env.HACKER_PODCAST_KV.delete(storyKey))
    }

    // Clean up audio temporary data
    for (const [index] of conversations.entries()) {
      const audioKey = `tmp:${event.instanceId}:audio:${index}`
      deletePromises.push(ctx.env.HACKER_PODCAST_KV.delete(audioKey))
    }

    await Promise.all(deletePromises).catch(console.error)

    await Promise.all(
      conversations.map(async (_, index) => {
        try {
          await Promise.any([
            ctx.env.HACKER_PODCAST_R2.delete(`tmp/${event.instanceId}/${podcastKey}-${index}.mp3`),
            new Promise(resolve => setTimeout(resolve, 200)),
          ])
        }
        catch (error) {
          console.error('delete temp files failed', error)
        }
      }),
    )

    return 'temporary data cleaned up'
  })
}

export class HackerNewsWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<void> {
    console.info('trigged event: HackerNewsWorkflow', event)

    const ctx = buildContext(this.env, event)
    const stories = await getTopStories(ctx.today, ctx.isDev, step, ctx.env)
    console.info('top stories', ctx.isDev ? stories : JSON.stringify(stories))

    const allStories = await processStories(stories, step, ctx, event)
    const contents = await generateContents(allStories, stories, step, ctx)
    const contentKey = `content:${ctx.runEnv}:hacker-podcast:${ctx.today}`
    const podcastKey = `${ctx.today.replaceAll('-', '/')}/${ctx.runEnv}/hacker-podcast-${ctx.today}.mp3`
    const { audioSize, conversations } = await processAudio(contents.podcastContent, podcastKey, step, ctx, event)

    await saveContent(contentKey, podcastKey, stories, contents, audioSize, step, ctx)
    await cleanupTempData(stories, conversations, podcastKey, step, ctx, event)
  }
}

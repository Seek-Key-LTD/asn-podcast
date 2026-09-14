import type { Episode } from '@/types/podcast'

function appendUpdatedAt(url: string, updatedAt?: number): string {
  return updatedAt ? `${url}?t=${updatedAt}` : url
}

export function buildAudioUrl(staticHost: string, audioPath: string, updatedAt?: number): string {
  const normalizedHost = staticHost?.replace(/\/$/, '')
  if (/^https?:\/\//.test(audioPath)) {
    return appendUpdatedAt(audioPath, updatedAt)
  }

  const cleanedPath = audioPath.replace(/^\//, '')
  return appendUpdatedAt(`${normalizedHost}/${cleanedPath}`, updatedAt)
}

const AUDIO_TYPE_BY_EXTENSION: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
}

/**
 * 按扩展名推断音频 MIME 类型。
 *
 * 原来这里（以及 RSS enclosure）硬编码 `audio/mpeg`，但归档里存在 m4a/AAC
 * 等非 MP3 文件。网页播放器不校验该字段，严格的三方播客客户端会校验，
 * 类型不符可能被拒收。
 */
export function inferAudioType(src: string): string {
  const path = src.split('?')[0]?.toLowerCase() ?? ''
  const dot = path.lastIndexOf('.')
  const extension = dot === -1 ? '' : path.slice(dot)
  return AUDIO_TYPE_BY_EXTENSION[extension] ?? 'audio/mpeg'
}

function buildReferencesSection(stories?: Story[]): string {
  if (!stories || stories.length === 0) {
    return ''
  }

  const items = stories
    .map((story) => {
      const title = story.title || story.url || story.hackerNewsUrl || ''
      const href = story.url || story.hackerNewsUrl || '#'
      if (!title || !href)
        return null
      return `- [${title}](${href})`
    })
    .filter(Boolean)

  if (items.length === 0) {
    return ''
  }

  return ['## 参考链接', ...items].join('\n')
}

export function buildEpisodeFromArticle(
  article: Article,
  staticHost: string,
): Episode {
  const description
    = article.introContent
      || article.podcastContent?.split('\n')?.[0]
      || article.blogContent?.split('\n')?.[0]
      || article.title

  const sections: string[] = []

  if (article.blogContent) {
    sections.push(article.blogContent)
  }

  if (article.podcastContent) {
    sections.push(`## 播客全文\n\n${article.podcastContent}`)
  }

  const references = buildReferencesSection(article.stories)
  if (references) {
    sections.push(references)
  }

  const audioSrc = buildAudioUrl(staticHost, article.audio, article.updatedAt)

  return {
    id: article.date,
    title: article.title,
    description,
    content: sections.join('\n\n'),
    published: article.date,
    audio: {
      src: audioSrc,
      type: inferAudioType(audioSrc),
    },
    summary: article.introContent,
    stories: article.stories,
  }
}

export function buildEpisodesFromArticles(
  articles: Article[],
  staticHost: string,
): Episode[] {
  return articles
    .map(article => buildEpisodeFromArticle(article, staticHost))
    .sort((a, b) => (a.published < b.published ? 1 : -1))
}

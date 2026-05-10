export const stepNames = {
  topStories(today: string): string {
    return `fetch Hacker News top stories for ${today}`
  },
  storyContent(story: Story): string {
    return `fetch story content ${story.id}`
  },
  storySummary(story: Story): string {
    return `summarize story ${story.id}`
  },
  cacheStorySummary(story: Story): string {
    return `cache story summary ${story.id}`
  },
  pauseAfterStory(story: Story): string {
    return `sleep after story ${story.id}`
  },
  audioSegment(index: number): string {
    return `synthesize audio segment ${index + 1}`
  },
  collectStorySummaries: 'collect story summaries',
  generatePodcastScript: 'generate podcast script',
  pauseAfterPodcastScript: 'sleep after podcast script',
  generateBlogArticle: 'generate blog article',
  pauseAfterBlogArticle: 'sleep after blog article',
  generateIntro: 'generate podcast intro',
  collectAudioSegments: 'collect audio segment URLs',
  mergeAudioSegments: 'merge audio segments',
  saveEpisodeContent: 'save episode content',
  cleanupTemporaryData: 'cleanup temporary workflow data',
} as const

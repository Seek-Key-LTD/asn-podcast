interface SpeakerSegment {
  speaker_id: string    // hermes, picoclaw, etc.
  start_time: number    // seconds
  end_time: number      // seconds
  content: string       // Text content
  subtitle?: string     // Translated/Bilingual subtitle
  image_url?: string    // Synchronized image for this segment
  metadata?: {
    emotion?: string
    action?: string     // e.g., "sip_coffee", "turn_page"
    location?: string
  }
}

interface Article {
  date: string          // ISO Date string
  issue_no?: string     // Issue/Series number
  locale: string        // Locale code
  agent_id: string      // ID of the primary agent
  
  title: string
  introContent: string
  blogContent: string
  podcastContent: string
  
  audio: string
  audioSize: number
  duration?: number
  
  transcript?: SpeakerSegment[] // Detailed synchronized transcript
  
  wiki_links?: string[]
  epub_url?: string
  
  stories: Story[]
  updatedAt: number
  
  extra?: {
    tags?: string[]
    series_title?: string
    video_essay_mode?: boolean // Toggle for the rich UI
  }
}

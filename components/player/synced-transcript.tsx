'use client'

import type { TranscriptCue } from '@/lib/transcript-parser'
import { useStore } from '@tanstack/react-store'
import { useMediaPlayer, useMediaState } from '@vidstack/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseTranscript } from '@/lib/transcript-parser'
import { cn } from '@/lib/utils'
import { getPlayerStore } from '@/stores/player-store'

function transcriptUrl(src: string): string {
  return src.replace(/\.(?:mp3|m4a|wav)(?:\?.*)?$/i, '.lrc')
}

export function SyncedTranscript() {
  const player = useMediaPlayer()
  const currentTime = useMediaState('currentTime')
  const playerStore = getPlayerStore()
  const episode = useStore(playerStore, state => state.currentEpisode)
  const isOpen = useStore(playerStore, state => state.isTranscriptOpen)
  const [cues, setCues] = useState<TranscriptCue[]>([])
  const [error, setError] = useState(false)
  const scrollLockUntil = useRef(0)
  const lineRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const url = useMemo(() => episode ? transcriptUrl(episode.audio.src) : null, [episode])
  const activeCue = cues.find(cue => currentTime * 1000 >= cue.timeMs && currentTime * 1000 < cue.endTimeMs)

  useEffect(() => {
    if (!url || !isOpen)
      return
    const controller = new AbortController()
    fetch(url, { signal: controller.signal })
      .then(response => response.ok ? response.text() : Promise.reject(new Error('transcript unavailable')))
      .then((source) => {
        setError(false)
        setCues(parseTranscript(source))
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name !== 'AbortError')
          setError(true)
      })
    return () => controller.abort()
  }, [isOpen, url])

  useEffect(() => {
    if (!isOpen || !activeCue || Date.now() < scrollLockUntil.current)
      return
    lineRefs.current[activeCue.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeCue, isOpen])

  if (!isOpen)
    return null

  return (
    <section className={`
      fixed inset-x-0 bottom-28 z-40 mx-auto w-[min(42rem,calc(100vw-2rem))]
      overflow-hidden rounded-2xl border bg-background/95 shadow-2xl
      backdrop-blur-md
    `}
    >
      <div className="border-b px-4 py-2 text-xs text-muted-foreground">{episode?.title ?? '逐字稿'}</div>
      <div
        className="max-h-72 overflow-y-auto px-4 py-5"
        onScroll={() => { scrollLockUntil.current = Date.now() + 3000 }}
      >
        {error && <p className="py-8 text-center text-sm text-muted-foreground">暂无逐字稿</p>}
        {!error && !cues.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            正在加载逐字稿…
          </p>
        )}
        <div className="space-y-3">
          {cues.map(cue => (
            <button
              key={cue.id}
              ref={(node) => { lineRefs.current[cue.id] = node }}
              type="button"
              onClick={() => {
                if (player)
                  player.currentTime = cue.timeMs / 1000
              }}
              className={cn(
                `
                  block w-full text-left text-sm leading-6 transition-all
                  duration-200
                `,
                activeCue?.id === cue.id
                  ? `
                    scale-105 text-foreground
                    drop-shadow-[0_0_8px_hsl(var(--foreground)/.45)]
                  `
                  : `
                    text-muted-foreground/35
                    hover:text-muted-foreground
                  `,
              )}
            >
              {cue.text}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

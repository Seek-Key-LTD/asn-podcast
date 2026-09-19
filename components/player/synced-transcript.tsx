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
  const [offsetMs, setOffsetMs] = useState(0)
  const scrollLockUntil = useRef(0)
  const lineRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const url = useMemo(() => episode ? transcriptUrl(episode.audio.src) : null, [episode])
  const effectiveTimeMs = currentTime * 1000 + offsetMs
  const activeCue = cues.find(cue => effectiveTimeMs >= cue.timeMs && effectiveTimeMs < cue.endTimeMs)

  useEffect(() => {
    if (!episode)
      return
    const saved = window.localStorage.getItem(`asn-transcript-offset:${episode.id}`)
    const parsed = saved === null ? 0 : Number(saved)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setOffsetMs(Number.isFinite(parsed) ? parsed : 0)
  }, [episode])

  useEffect(() => {
    if (episode)
      window.localStorage.setItem(`asn-transcript-offset:${episode.id}`, String(offsetMs))
  }, [episode, offsetMs])

  useEffect(() => {
    if (!url || !isOpen)
      return
    const controller = new AbortController()
    const proxyUrl = `/api/transcript?url=${encodeURIComponent(url)}`
    fetch(proxyUrl, { signal: controller.signal })
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

  const offsetSeconds = offsetMs / 1000
  const offsetLabel = `${offsetSeconds > 0 ? '+' : ''}${offsetSeconds.toFixed(1)}s`

  return (
    <section className={`
      fixed inset-x-0 bottom-28 z-40 mx-auto w-[min(42rem,calc(100vw-2rem))]
      overflow-hidden rounded-2xl border bg-background/95 shadow-2xl
      backdrop-blur-md
    `}
    >
      <div className="border-b px-4 py-2">
        <div className="text-xs text-muted-foreground">{episode?.title ?? '逐字稿'}</div>
        <div className={`
          mt-2 flex items-center gap-2 text-xs text-muted-foreground
        `}
        >
          <span className="shrink-0">时间校准</span>
          <input
            aria-label="逐字稿时间校准"
            className="min-w-0 flex-1 accent-foreground"
            type="range"
            min={-10000}
            max={10000}
            step={100}
            value={offsetMs}
            onChange={event => setOffsetMs(Number(event.target.value))}
          />
          <output className="w-12 text-right tabular-nums">{offsetLabel}</output>
          <button
            type="button"
            className={`
              shrink-0 rounded px-1.5 py-0.5
              hover:bg-white/10
            `}
            onClick={() => {
              if (activeCue)
                setOffsetMs(activeCue.timeMs - currentTime * 1000)
            }}
            title="将当前句对齐到播放位置"
          >
            对齐当前句
          </button>
          <button
            type="button"
            className={`
              shrink-0 rounded px-1.5 py-0.5
              hover:bg-white/10
            `}
            onClick={() => setOffsetMs(0)}
            title="恢复默认偏移"
          >
            重置
          </button>
        </div>
      </div>
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
                  player.currentTime = Math.max(0, (cue.timeMs - offsetMs) / 1000)
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

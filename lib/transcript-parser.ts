export interface TranscriptCue {
  id: string
  timeMs: number
  endTimeMs: number
  text: string
}

const LRC_TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g

function timestampToMs(minutes: string, seconds: string, fraction = ''): number {
  const base = (Number(minutes) * 60 + Number(seconds)) * 1000
  if (!fraction)
    return base
  const digits = fraction.length === 1 ? `${fraction}00` : fraction.length === 2 ? `${fraction}0` : fraction.slice(0, 3)
  return base + Number(digits)
}

function finalize(cues: Array<Omit<TranscriptCue, 'endTimeMs'>>): TranscriptCue[] {
  return cues
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((cue, index, sorted) => ({
      ...cue,
      endTimeMs: sorted[index + 1]?.timeMs ?? Number.POSITIVE_INFINITY,
    }))
}

export function parseLrc(source: string): TranscriptCue[] {
  const cues: Array<Omit<TranscriptCue, 'endTimeMs'>> = []
  source.split(/\r?\n/).forEach((line, lineIndex) => {
    const timestamps = [...line.matchAll(LRC_TIMESTAMP)]
    if (!timestamps.length)
      return
    const text = line.replace(LRC_TIMESTAMP, '').trim()
    if (!text)
      return
    timestamps.forEach((match, timestampIndex) => {
      cues.push({
        id: `lrc-${lineIndex}-${timestampIndex}`,
        timeMs: timestampToMs(match[1], match[2], match[3]),
        text,
      })
    })
  })
  return finalize(cues)
}

function parseVttTimestamp(value: string): number {
  const parts = value.trim().replace(',', '.').split(':').map(Number)
  if (parts.length === 3)
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  return (parts[0] * 60 + parts[1]) * 1000
}

export function parseWebVtt(source: string): TranscriptCue[] {
  const cues: TranscriptCue[] = []
  const blocks = source.replace(/^WEBVTT[^\n]*\n/i, '').split(/\r?\n\s*\n/)
  blocks.forEach((block, blockIndex) => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    const timingIndex = lines.findIndex(line => line.includes('-->'))
    if (timingIndex < 0)
      return
    const [start, end] = lines[timingIndex].split('-->').map(value => value.trim().split(/\s+/)[0])
    const timeMs = parseVttTimestamp(start)
    const endTimeMs = parseVttTimestamp(end)
    const text = lines.slice(timingIndex + 1).join(' ').trim()
    if (!text)
      return
    cues.push({ id: `vtt-${blockIndex}`, timeMs, endTimeMs, text })
  })
  return cues.sort((a, b) => a.timeMs - b.timeMs)
}

export function parseTranscript(source: string, format?: 'lrc' | 'vtt'): TranscriptCue[] {
  const detected = format ?? (/^\s*WEBVTT/m.test(source) ? 'vtt' : 'lrc')
  return detected === 'vtt' ? parseWebVtt(source) : parseLrc(source)
}

import type { UpcomingSeason } from '@/lib/db'
import { describeUpcomingSeason } from '@/lib/upcoming'

/** 尚未开播的季的展示块。货架卡片、系列专页共用。 */
export function UpcomingSeasons({ upcoming, className }: { upcoming: UpcomingSeason[], className?: string }) {
  if (upcoming.length === 0)
    return null

  return (
    <span className={className ?? `
      flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground
    `}
    >
      {upcoming.map(s => (
        <span key={s.season}>{describeUpcomingSeason(s)}</span>
      ))}
    </span>
  )
}

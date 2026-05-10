'use client'

import { RiFullscreenExitLine, RiFullscreenLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { useEpisodeFullscreen } from '@/hooks/use-episode-fullscreen'
import { cn } from '@/lib/utils'

interface EpisodeFullscreenToggleProps {
  className?: string
}

export function EpisodeFullscreenToggle({ className }: EpisodeFullscreenToggleProps) {
  const { isFullscreen, toggleFullscreen } = useEpisodeFullscreen()
  const label = isFullscreen ? '退出全屏阅读' : '进入全屏阅读'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleFullscreen}
      aria-label={label}
      title={label}
      className={cn(
        `
          size-10 rounded-full border border-border/80 text-muted-foreground
          hover:border-theme hover:text-theme-text
          md:size-12
        `,
        isFullscreen && `
          border-theme text-theme-text
          hover:text-theme-text-hover
        `,
        className,
      )}
    >
      {isFullscreen
        ? (
            <RiFullscreenExitLine className={`
              size-4
              md:size-5
            `}
            />
          )
        : (
            <RiFullscreenLine className={`
              size-4
              md:size-5
            `}
            />
          )}
    </Button>
  )
}

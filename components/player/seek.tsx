'use client'

import { SeekButton, Tooltip } from '@vidstack/react'
import { SeekBackward15Icon, SeekForward15Icon } from '@vidstack/react/icons'

export function SeekForward() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <SeekButton
          className={`
            relative inline-flex size-8 cursor-pointer items-center
            justify-center rounded-md ring-sky-400 outline-none ring-inset
            hover:bg-white/20
            aria-hidden:hidden
            data-focus:ring-4
          `}
          seconds={15}
          data-umami-event="seek-forward"
        >
          <SeekForward15Icon className="size-6" />
        </SeekButton>
      </Tooltip.Trigger>
      <Tooltip.Content className={`
        z-10 animate-out rounded-sm bg-black/90 px-2 py-0.5 text-sm font-medium
        text-white fade-out slide-out-to-bottom-2
        data-visible:animate-in data-visible:fade-in
        data-visible:slide-in-from-bottom-4
      `}
      >
        快进 15 秒
      </Tooltip.Content>
    </Tooltip.Root>
  )
}

export function SeekBackward() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <SeekButton
          className={`
            relative inline-flex size-8 cursor-pointer items-center
            justify-center rounded-md ring-sky-400 outline-none ring-inset
            hover:bg-white/20
            aria-hidden:hidden
            data-focus:ring-4
          `}
          seconds={-15}
          data-umami-event="seek-backward"
        >
          <SeekBackward15Icon className="size-6" />
        </SeekButton>
      </Tooltip.Trigger>
      <Tooltip.Content className={`
        z-10 animate-out rounded-sm bg-black/90 px-2 py-0.5 text-sm font-medium
        text-white fade-out slide-out-to-bottom-2
        data-visible:animate-in data-visible:fade-in
        data-visible:slide-in-from-bottom-4
      `}
      >
        快退 15 秒
      </Tooltip.Content>
    </Tooltip.Root>
  )
}

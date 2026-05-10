'use client'

import { useSyncExternalStore } from 'react'

const subscribe = (): (() => void) => () => {}

export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== 'undefined',
    () => false,
  )
}

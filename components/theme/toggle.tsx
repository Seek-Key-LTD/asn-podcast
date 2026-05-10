'use client'

import type { Theme } from '@/stores/theme-store'
import { RiMoonLine, RiSunLine } from '@remixicon/react'
import { useTheme } from '@/components/theme/use-theme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    const resolveTheme = (): Theme => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }
      return theme
    }

    const nextTheme = resolveTheme() === 'dark' ? 'light' : 'dark'

    if (typeof document.startViewTransition !== 'function') {
      setTheme(nextTheme)
      return
    }

    document.startViewTransition(() => setTheme(nextTheme))
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`
        cursor-pointer transition-colors
        hover:text-theme-text
      `}
      aria-label="切换主题"
    >
      <RiSunLine className={cn(`
        size-6
        dark:hidden
      `, className)}
      />
      <RiMoonLine className={cn(`
        hidden size-6
        dark:block
      `, className)}
      />
    </button>
  )
}

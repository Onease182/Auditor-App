'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * Dark/light theme toggle. Renders both icons and toggles a CSS class so there
 * is no hydration mismatch (avoiding the set-state-in-effect pattern the
 * React 19 ESLint plugin flags).
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

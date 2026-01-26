'use client'

import { cn } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhaseStepper } from './PhaseStepper'
import { ThemeToggle } from './ThemeToggle'

type Phase = 'input' | 'criteria' | 'rating' | 'explanation' | 'editOptions'

interface AppShellProps {
  children: React.ReactNode
  currentPhase: Phase
  onStartOver: () => void
  className?: string
}

export function AppShell({ children, currentPhase, onStartOver, className }: AppShellProps) {
  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/* Premium slim header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          {/* Logo - elegant wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <svg 
                className="h-4.5 w-4.5 text-primary" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z" fill="currentColor" opacity="0.2" />
                <path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">
              DilemmaWise
            </span>
          </div>

          {/* Phase Stepper - centered on desktop */}
          <div className="hidden md:flex flex-1 justify-center">
            <PhaseStepper currentPhase={currentPhase} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <ThemeToggle />

            <Button
              variant="ghost"
              size="sm"
              onClick={onStartOver}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors rounded-xl"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Start Over</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Phase Stepper - compact */}
      <div className="container py-3 md:hidden">
        <PhaseStepper currentPhase={currentPhase} />
      </div>

      {/* Main Content - generous whitespace */}
      <main className="container py-8 md:py-12">
        {children}
      </main>
    </div>
  )
}

"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

type Phase = 'input' | 'criteria' | 'rating' | 'explanation' | 'editOptions'

interface PhaseStepperProps {
  currentPhase: Phase
  className?: string
}

const PHASES: { id: Phase; label: string }[] = [
  { id: 'input', label: 'Describe' },
  { id: 'criteria', label: 'Prioritize' },
  { id: 'rating', label: 'Rate' },
  { id: 'explanation', label: 'Results' },
]

const PHASE_ORDER: Phase[] = ['input', 'criteria', 'rating', 'explanation']

export function PhaseStepper({ currentPhase, className }: PhaseStepperProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase === 'editOptions' ? 'input' : currentPhase)

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {PHASES.map((phase, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isUpcoming = index > currentIndex

        return (
          <div key={phase.id} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isUpcoming && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-xs font-medium hidden sm:block",
                  isCurrent && "text-foreground",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {phase.label}
              </span>
            </div>
            
            {/* Connector line */}
            {index < PHASES.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 mx-1 transition-colors duration-300",
                  index < currentIndex ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

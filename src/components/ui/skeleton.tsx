import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/50 relative overflow-hidden",
        className
      )}
      style={{
        backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s infinite"
      }}
      {...props}
    />
  )
}

// Specialized skeleton for chat messages
function SkeletonMessage() {
  return (
    <div className="space-y-2 animate-fade-in">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

// Specialized skeleton for ranking cards
function SkeletonRankingCard() {
  return (
    <div className="p-4 border border-border/50 rounded-xl space-y-3 animate-fade-in">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="w-32 h-3 rounded-full" />
      </div>
    </div>
  )
}

// Specialized skeleton for criteria sliders
function SkeletonCriteriaSlider() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

// Specialized skeleton for explanation sections
function SkeletonExplanation() {
  return (
    <div className="space-y-4 animate-fade-in">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  )
}

export { 
  Skeleton, 
  SkeletonMessage, 
  SkeletonRankingCard, 
  SkeletonCriteriaSlider,
  SkeletonExplanation 
}

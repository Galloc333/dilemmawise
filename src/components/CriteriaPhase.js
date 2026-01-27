'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CircularProgress } from '@/components/ui/circular-progress';
import { cn } from '@/lib/utils';
import { handleApiError } from '@/lib/apiErrors';

export default function CriteriaPhase({ criteria, onNext, onBack, savedWeights }) {
  const [weights, setWeights] = useState(
    criteria.reduce((acc, c) => ({ ...acc, [c]: savedWeights?.[c] ?? 5 }), {})
  );
  const [explanations, setExplanations] = useState({});
  const [loadingExplanations, setLoadingExplanations] = useState(true);
  const [hoveredCriterion, setHoveredCriterion] = useState(null);

  // Fetch AI explanations on mount
  useEffect(() => {
    const fetchExplanations = async () => {
      try {
        const res = await fetch('/api/explain-criteria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ criteria }),
        });
        if (res.ok) {
          const data = await res.json();
          setExplanations(data);
        }
      } catch (err) {
        // Non-critical error - explanations are optional
        handleApiError(err, 'explain-criteria');
      } finally {
        setLoadingExplanations(false);
      }
    };
    fetchExplanations();
  }, [criteria]);

  const handleWeightChange = (criterion, value) => {
    setWeights((prev) => ({ ...prev, [criterion]: value[0] }));
  };

  const getImportanceLabel = (value) => {
    if (value <= 2) return 'Very Low';
    if (value <= 4) return 'Low';
    if (value <= 6) return 'Medium';
    if (value <= 8) return 'High';
    return 'Critical';
  };

  const getImportanceColor = (value) => {
    if (value <= 2) return 'text-muted-foreground';
    if (value <= 4) return 'text-muted-foreground';
    if (value <= 6) return 'text-foreground';
    if (value <= 8) return 'text-primary';
    return 'text-primary font-bold';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl"
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-semibold text-foreground">Prioritize Your Criteria</h1>
        <p className="text-muted-foreground">
          How important is each factor in your decision? Slide to set priorities.
        </p>
      </div>

      {/* Criteria Sliders */}
      <Card className="mb-6 p-6">
        <div className="space-y-8">
          {criteria.map((criterion, index) => (
            <motion.div
              key={criterion}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative"
              onMouseEnter={() => setHoveredCriterion(criterion)}
              onMouseLeave={() => setHoveredCriterion(null)}
            >
              {/* Label Row */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{criterion}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        whileHover={{ scale: 1.1, rotate: 15 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      {loadingExplanations ? (
                        <div className="space-y-2">
                          <div className="h-3 w-32 animate-pulse rounded bg-muted/50" />
                          <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
                          <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
                        </div>
                      ) : explanations[criterion] ? (
                        <>
                          <p className="mb-1 font-medium text-primary">
                            How important is {criterion}?
                          </p>
                          <p>{explanations[criterion]}</p>
                        </>
                      ) : (
                        <span>Consider how much this factor affects your decision.</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-sm font-semibold transition-colors',
                      getImportanceColor(weights[criterion])
                    )}
                  >
                    {getImportanceLabel(weights[criterion])}
                  </span>
                  <CircularProgress
                    value={weights[criterion]}
                    size={40}
                    strokeWidth={3}
                    animated={hoveredCriterion === criterion}
                  />
                </div>
              </div>

              {/* Slider */}
              <div className="px-1">
                <Slider
                  value={[weights[criterion]]}
                  onValueChange={(value) => handleWeightChange(criterion, value)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Scale Labels */}
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>1 - Care very little</span>
                <span>10 - Care a lot</span>
              </div>

              {/* Hover tooltip for larger explanation (desktop) */}
              <AnimatePresence>
                {hoveredCriterion === criterion && explanations[criterion] && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="absolute left-full top-1/2 z-10 ml-4 hidden w-72 -translate-y-1/2 rounded-xl border border-primary/20 bg-card p-4 shadow-warm-lg lg:block"
                  >
                    <div className="text-sm">
                      <p className="mb-1 font-semibold text-primary">
                        How important is {criterion}?
                      </p>
                      <p className="leading-relaxed text-muted-foreground">
                        {explanations[criterion]}
                      </p>
                    </div>
                    {/* Arrow */}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-primary/20" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Summary */}
      <Card className="mb-6 bg-secondary/30 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
          >
            <Info className="h-4 w-4" />
          </motion.div>
          <span>
            Your top priorities:{' '}
            <span className="font-medium text-foreground">
              {Object.entries(weights)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([c]) => c)
                .join(', ')}
            </span>
          </span>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="outline" onClick={onBack} className="group gap-2">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={() => onNext(weights)} size="lg" className="group gap-2">
            Continue to Rating
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

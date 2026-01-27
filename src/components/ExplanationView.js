'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Medal,
  BarChart3,
  Target,
  Lightbulb,
  Search,
  Plus,
  Compass,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useConfetti } from '@/hooks/useConfetti';
import { useCountUp } from '@/hooks/useCountUp';
import { handleApiError } from '@/lib/apiErrors';

// Separate component for animated score to prevent re-creation on every render
function AnimatedScore({ score, maxScore, enabled }) {
  const animatedScore = useCountUp(score, {
    duration: 1500,
    decimals: 1,
    enabled,
  });
  return (
    <>
      {animatedScore} / {maxScore}
    </>
  );
}

export default function ExplanationView({
  results,
  userContext = {},
  dilemma,
  options: optionsProp,
  criteria: criteriaProp,
  onReset,
  onBackToRating,
  onEditOptions,
}) {
  const { scores, weights, ranking } = results;
  const criteriaKeys = Object.keys(weights);
  const optionNames = ranking.map((r) => r.option);

  const options = optionsProp || optionNames;
  const criteria = criteriaProp || criteriaKeys;

  const sumWeights = criteriaKeys.reduce((sum, c) => sum + weights[c], 0);
  const maxPossibleScore = sumWeights * 10;

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 4;
  const [hasShownConfetti, setHasShownConfetti] = useState(false);

  // Refs to prevent duplicate API calls (React Strict Mode)
  const hasCalledExplanation = useRef(false);
  const hasCalledSuggestions = useRef(false);

  const [dataAnalysis, setDataAnalysis] = useState('');
  const [whatCouldChange, setWhatCouldChange] = useState('');
  const [personalRecommendation, setPersonalRecommendation] = useState('');
  const [recommendedOption, setRecommendedOption] = useState('');
  const [agreesWithData, setAgreesWithData] = useState(true);
  const [hasUserContext, setHasUserContext] = useState(false);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(true);

  const [viewMode, setViewMode] = useState('weighted');

  const [suggestions, setSuggestions] = useState({
    otherOptions: [],
    missingCriteria: [],
    followUpDilemmas: [],
  });
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);

  const calculations = useMemo(() => {
    const winner = ranking[0];
    const runnerUp = ranking[1] || null;

    const contributions = {};
    options.forEach((opt) => {
      contributions[opt] = {};
      criteria.forEach((crit) => {
        const rating = scores[opt]?.[crit] || 0;
        const weight = weights[crit] || 0;
        contributions[opt][crit] = rating * weight;
      });
    });

    const criterionDeltas = {};
    if (runnerUp) {
      criteria.forEach((crit) => {
        const winnerContrib = contributions[winner.option][crit];
        const runnerUpContrib = contributions[runnerUp.option][crit];
        criterionDeltas[crit] = {
          winner: winnerContrib,
          runnerUp: runnerUpContrib,
          delta: winnerContrib - runnerUpContrib,
          deltaPercent:
            runnerUpContrib > 0 ? ((winnerContrib - runnerUpContrib) / runnerUpContrib) * 100 : 0,
        };
      });
    }

    const gap = runnerUp ? winner.score - runnerUp.score : 0;
    const gapPercent = runnerUp ? (gap / runnerUp.score) * 100 : 100;

    let keyDriver = null;
    if (runnerUp && gap > 0) {
      const drivers = criteria
        .map((crit) => ({
          criterion: crit,
          weight: weights[crit],
          delta: criterionDeltas[crit].delta,
          contribution: Math.abs(criterionDeltas[crit].delta),
        }))
        .sort((a, b) => b.contribution - a.contribution);

      const topDriver = drivers[0];
      if (topDriver.contribution >= gap * 0.5) {
        keyDriver = topDriver;
      }
    }

    return {
      contributions,
      criterionDeltas,
      gap,
      gapPercent,
      keyDriver,
      winner,
      runnerUp,
    };
  }, [ranking, scores, weights, criteria, options]);

  // Confetti celebration when results load
  const shouldTriggerConfetti = !hasShownConfetti && currentPage === 1;
  useConfetti({ trigger: shouldTriggerConfetti, duration: 3000 });

  useEffect(() => {
    if (!hasShownConfetti && currentPage === 1) {
      setHasShownConfetti(true);
    }
  }, [hasShownConfetti, currentPage]);

  useEffect(() => {
    // Prevent duplicate calls in React Strict Mode
    if (hasCalledExplanation.current) return;
    hasCalledExplanation.current = true;

    const fetchExplanations = async () => {
      try {
        const response = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            winner: ranking[0],
            ranking,
            weights,
            scores,
            userContext,
            dilemma,
            options: optionsProp || optionNames,
          }),
        });
        const data = await response.json();

        setDataAnalysis(data.dataAnalysis || '');
        setWhatCouldChange(data.whatCouldChange || '');
        setPersonalRecommendation(data.personalRecommendation || '');
        setRecommendedOption(data.recommendedOption || ranking[0].option);
        setAgreesWithData(data.agreesWithData !== false);
        setHasUserContext(data.hasUserContext || false);
      } catch (error) {
        handleApiError(error, 'explanation');
        setDataAnalysis(
          `${ranking[0].option} ranked highest based on your weighted criteria priorities.`
        );
      } finally {
        setIsLoadingExplanation(false);
      }
    };
    fetchExplanations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Prevent duplicate calls in React Strict Mode
    if (hasCalledSuggestions.current) return;
    hasCalledSuggestions.current = true;

    const fetchSuggestions = async () => {
      try {
        const response = await fetch('/api/generate-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dilemma,
            options,
            criteria,
            winner: ranking[0].option,
            weights,
            userContext,
          }),
        });
        const data = await response.json();

        setSuggestions({
          otherOptions: data.otherOptions || [],
          missingCriteria: data.missingCriteria || [],
          followUpDilemmas: data.followUpDilemmas || [],
        });
      } catch (error) {
        handleApiError(error, 'suggestions');
      } finally {
        setIsLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextSummary = useMemo(() => {
    if (!userContext || Object.keys(userContext).length === 0) return null;
    return Object.entries(userContext)
      .filter(
        ([_, v]) =>
          v && v !== 'null' && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0))
      )
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .slice(0, 4);
  }, [userContext]);

  const goToPage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const effectiveTotalPages = hasUserContext ? 4 : 3;
  const shouldShowLLMPage = hasUserContext && !isLoadingExplanation;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page Progress Indicator */}
      <div className="mb-8 flex justify-center gap-2">
        {[1, 2, 3, 4].map((page) => {
          if (page === 3 && !shouldShowLLMPage) return null;
          return (
            <button
              key={page}
              onClick={() => goToPage(page)}
              className={cn(
                'h-1 max-w-20 flex-1 cursor-pointer rounded-full transition-all',
                page <= currentPage ? 'bg-primary' : 'bg-border'
              )}
            />
          );
        })}
      </div>

      {/* Page 1: Winner */}
      {currentPage === 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Winner Announcement */}
          <div className="mb-8 text-center">
            {/* Weighted Sum Result Badge - Top */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-amber-100/80 px-4 py-1.5 text-sm font-medium text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300">
              <BarChart3 className="h-3.5 w-3.5" />
              Weighted Sum Result
            </div>

            {/* Winner Name with Trophy Badge */}
            <div className="mb-3 flex items-center justify-center gap-5">
              {/* Trophy Badge with Spring Animation */}
              <motion.div
                className="relative shrink-0"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                  delay: 0.2,
                }}
              >
                <div className="flex h-14 w-14 animate-glow-pulse items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/40">
                  <Trophy className="h-7 w-7 text-amber-950" />
                </div>
              </motion.div>

              {/* Winner Name with Slide In */}
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl"
              >
                {calculations.winner.option}
              </motion.h1>
            </div>

            <p className="text-muted-foreground">Based on your weights and ratings</p>
          </div>

          {/* Ranking */}
          <Card className="mb-6 p-6">
            <h2 className="mb-6 text-center text-lg font-semibold text-muted-foreground">
              Final Ranking
            </h2>
            <div className="space-y-3">
              {ranking.map((item, idx) => {
                // Custom badge styling based on rank
                const getBadgeStyle = (rank) => {
                  if (rank === 0)
                    return {
                      bg: 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600',
                      shadow: 'shadow-lg shadow-amber-500/30',
                      text: 'text-amber-950',
                      ring: 'ring-2 ring-amber-300/50',
                    };
                  if (rank === 1)
                    return {
                      bg: 'bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500',
                      shadow: 'shadow-md shadow-slate-400/30',
                      text: 'text-slate-900',
                      ring: 'ring-2 ring-slate-300/50',
                    };
                  if (rank === 2)
                    return {
                      bg: 'bg-gradient-to-br from-amber-600 via-orange-700 to-amber-800',
                      shadow: 'shadow-md shadow-amber-700/30',
                      text: 'text-amber-100',
                      ring: 'ring-2 ring-amber-500/50',
                    };
                  return {
                    bg: 'bg-secondary',
                    shadow: '',
                    text: 'text-muted-foreground',
                    ring: '',
                  };
                };
                const badge = getBadgeStyle(idx);

                return (
                  <motion.div
                    key={item.option}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: idx * 0.15,
                      type: 'spring',
                      stiffness: 100,
                      damping: 15,
                    }}
                    className={cn(
                      'flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md',
                      idx === 0
                        ? 'border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:border-amber-800/30 dark:from-amber-950/20 dark:to-orange-950/10'
                        : 'border-border/50 bg-secondary/30'
                    )}
                  >
                    {/* Custom Medal Badge with Scale Animation */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: idx * 0.15 + 0.2,
                        type: 'spring',
                        stiffness: 300,
                        damping: 20,
                      }}
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold',
                        badge.bg,
                        badge.shadow,
                        badge.text,
                        badge.ring
                      )}
                    >
                      {idx < 3 ? (
                        <span className="flex flex-col items-center leading-none">
                          <Trophy className="mb-0.5 h-5 w-5" />
                          <span className="text-[10px] font-black">{idx + 1}</span>
                        </span>
                      ) : (
                        <span className="text-base font-bold">{idx + 1}</span>
                      )}
                    </motion.div>
                    <div className="flex-1">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.15 + 0.3 }}
                        className={cn(
                          'font-semibold',
                          idx === 0 ? 'text-xl text-amber-900 dark:text-amber-100' : 'text-lg'
                        )}
                      >
                        {item.option}
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.15 + 0.4 }}
                        className="text-sm text-muted-foreground"
                      >
                        Score:{' '}
                        <AnimatedScore
                          score={item.score}
                          maxScore={maxPossibleScore}
                          enabled={currentPage === 1}
                        />
                      </motion.div>
                    </div>
                    <motion.div
                      className="w-32 sm:w-40 md:w-48"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.15 + 0.5 }}
                    >
                      <div className="h-3 overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.score / maxPossibleScore) * 100}%` }}
                          transition={{
                            delay: idx * 0.15 + 0.6,
                            duration: 0.8,
                            ease: 'easeOut',
                          }}
                          className={cn(
                            'h-full rounded-full',
                            idx === 0
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                              : 'bg-gradient-to-r from-primary/40 to-primary/60'
                          )}
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </Card>

          {/* Why Winner Won */}
          <Card className="mb-6 p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <BarChart3 className="h-5 w-5 text-primary" />
              Why {calculations.winner.option} Won
            </h3>
            {isLoadingExplanation ? (
              <div className="space-y-3 py-2">
                <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
                <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted/50" />
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                  {dataAnalysis}
                </p>

                {calculations.keyDriver && (
                  <div className="mt-4 rounded-lg border-l-4 border-primary bg-primary/5 p-4">
                    <div className="mb-1 flex items-center gap-2 font-semibold text-primary">
                      <Key className="h-4 w-4" />
                      Key Driver
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>{calculations.keyDriver.criterion}</strong> creates the dominant
                      separation.
                      {calculations.winner.option} leads by{' '}
                      <strong>+{calculations.keyDriver.contribution.toFixed(1)} points</strong> on
                      this criterion alone (≈{' '}
                      {((calculations.keyDriver.contribution / calculations.gap) * 100).toFixed(0)}%
                      of the total gap).
                    </p>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={onReset} className="group">
                <RotateCcw className="mr-2 h-4 w-4 transition-transform duration-500 group-hover:rotate-180" />
                Start New Analysis
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={nextPage} className="group">
                See Details
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Page 2: Details */}
      {currentPage === 2 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-foreground">Weighted Sum Details</h2>
            <p className="text-muted-foreground">How we calculated the winner</p>
          </div>

          {/* Formula */}
          <Card className="mb-6 p-6 text-center">
            <h3 className="mb-3 text-sm uppercase tracking-wide text-muted-foreground">
              Weighted Sum Model Formula
            </h3>
            <div className="mb-4 rounded-lg bg-secondary/30 p-4 font-serif text-xl italic">
              Winner = arg max<sub>j∈{'{1,...,m}'}</sub> Σ<sub>i=1</sub>
              <sup>n</sup> w<sub>i</sub> · r<sub>i,j</sub>
            </div>
            <div className="mx-auto max-w-lg text-left text-sm text-muted-foreground">
              <p className="mb-2 font-medium">Where:</p>
              <ul className="space-y-1 pl-4">
                <li>
                  •{' '}
                  <strong>
                    w<sub>i</sub>
                  </strong>{' '}
                  = weight of criterion i
                </li>
                <li>
                  •{' '}
                  <strong>
                    r<sub>i,j</sub>
                  </strong>{' '}
                  = rating of option j on criterion i
                </li>
                <li>
                  • <strong>n</strong> = {criteria.length} criteria
                </li>
                <li>
                  • <strong>m</strong> = {options.length} options
                </li>
              </ul>
            </div>
          </Card>

          {/* Toggle & Table */}
          <Card className="mb-6 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Detailed Breakdown</h3>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'rating' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('rating')}
                >
                  View Ratings
                </Button>
                <Button
                  variant={viewMode === 'weighted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('weighted')}
                >
                  View Contributions
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="p-3 text-left font-semibold">Criterion</th>
                    <th className="p-3 text-center font-semibold">Weight</th>
                    {options.map((opt) => (
                      <th key={opt} className="p-3 text-center font-semibold">
                        {opt}
                        <div className="text-xs font-normal text-muted-foreground">
                          {viewMode === 'rating' ? '(rating)' : '(w×r)'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((crit) => (
                    <tr key={crit} className="border-b border-border/50">
                      <td className="p-3 font-medium">{crit}</td>
                      <td className="p-3 text-center">{weights[crit]}</td>
                      {options.map((opt) => {
                        const rating = scores[opt]?.[crit] || 0;
                        const contribution = calculations.contributions[opt][crit];
                        return (
                          <td
                            key={opt}
                            className={cn(
                              'p-3 text-center',
                              opt === ranking[0].option && 'bg-primary/5'
                            )}
                          >
                            {viewMode === 'rating' ? (
                              rating
                            ) : (
                              <span>
                                <strong>{contribution.toFixed(1)}</strong>
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({weights[crit]}×{rating})
                                </span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-secondary/50 font-bold">
                    <td className="border-t-2 border-border p-3">TOTAL</td>
                    <td className="border-t-2 border-border p-3 text-center">-</td>
                    {ranking.map((r) => (
                      <td
                        key={r.option}
                        className={cn(
                          'border-t-2 border-border p-3 text-center',
                          r.option === ranking[0].option && 'text-primary'
                        )}
                      >
                        {r.score.toFixed(1)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Component Charts */}
          <Card className="mb-6 p-6">
            <h3 className="mb-6 font-semibold">Component Comparison</h3>
            <div className="space-y-6">
              {criteria.map((crit) => {
                const maxValue =
                  viewMode === 'rating'
                    ? 10
                    : Math.max(...options.map((opt) => calculations.contributions[opt][crit]));
                return (
                  <div key={crit}>
                    <div className="mb-2 flex justify-between">
                      <span className="font-medium">{crit}</span>
                      <span className="text-sm text-muted-foreground">
                        Weight: {weights[crit]}/10
                      </span>
                    </div>
                    <div className="space-y-2">
                      {options.map((opt) => {
                        const rating = scores[opt]?.[crit] || 0;
                        const contribution = calculations.contributions[opt][crit];
                        const displayValue = viewMode === 'rating' ? rating : contribution;
                        const isWinner = opt === ranking[0].option;
                        return (
                          <div key={opt} className="flex items-center gap-3">
                            <span className="w-28 truncate text-sm">{opt}</span>
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(displayValue / maxValue) * 100}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className={cn(
                                  'h-full rounded-full',
                                  isWinner ? 'bg-primary' : 'bg-muted-foreground/30'
                                )}
                              />
                            </div>
                            <span className="w-16 text-right text-sm font-medium">
                              {viewMode === 'rating' ? `${rating}/10` : contribution.toFixed(1)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={prevPage} className="group">
                <ChevronLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Result
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={nextPage} className="group">
                {shouldShowLLMPage ? 'See LLM Recommendation' : 'See Summary'}
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Page 3: LLM Recommendation */}
      {currentPage === 3 && shouldShowLLMPage && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mb-6 border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-primary/5 p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Target className="h-8 w-8 text-accent" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-foreground">AI Recommendation</h2>
              <p className="text-muted-foreground">
                Based on your personal context, here's an AI-driven recommendation.
              </p>
            </div>

            {contextSummary && contextSummary.length > 0 && (
              <div className="mb-6 rounded-lg border border-border bg-card p-4">
                <span className="text-sm font-medium text-muted-foreground">📝 Context used:</span>
                <p className="mt-1 text-sm text-muted-foreground">{contextSummary.join(' • ')}</p>
              </div>
            )}

            {!agreesWithData && (
              <div className="mb-4 rounded-r-lg border-l-4 border-warning bg-warning/10 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="font-medium">Note:</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Based on your personal context, the LLM suggests a different option than the
                  weighted-sum result.
                </p>
              </div>
            )}

            <p className="mb-6 whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {personalRecommendation}
            </p>

            {recommendedOption && (
              <div
                className={cn(
                  'rounded-lg border-2 p-4 text-center font-semibold',
                  recommendedOption === ranking[0].option
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-accent/30 bg-accent/10 text-accent'
                )}
              >
                <span className="mr-2">
                  {recommendedOption === ranking[0].option ? (
                    <CheckCircle2 className="inline h-5 w-5" />
                  ) : (
                    <Sparkles className="inline h-5 w-5" />
                  )}
                </span>
                LLM's pick: <span className="text-lg">{recommendedOption}</span>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-secondary/50 p-3 text-sm italic text-muted-foreground">
              ⚠️ <strong>Keep in mind:</strong> This is an AI interpretation of your free-form
              preferences.
            </div>
          </Card>

          <div className="flex justify-between">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" onClick={prevPage} className="group">
                <ChevronLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Details
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={nextPage} className="group">
                See Summary
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Page 4: Summary */}
      {(currentPage === 4 || (currentPage === 3 && !shouldShowLLMPage)) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              <Sparkles className="mr-2 inline h-6 w-6 text-primary" />
              Summary & Next Steps
            </h2>
            <p className="text-muted-foreground">Your decision journey at a glance</p>
          </div>

          {/* Quick Summary */}
          <Card className="mb-6 p-6">
            <h3 className="mb-4 text-sm uppercase tracking-wide text-muted-foreground">
              Quick Summary
            </h3>

            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                Weighted-Sum Winner:
              </div>
              <div className="rounded-r-lg border-l-4 border-primary bg-primary/5 p-3">
                <span className="text-lg font-bold">{calculations.winner.option}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({calculations.winner.score.toFixed(1)} points)
                </span>
              </div>
            </div>

            {hasUserContext && recommendedOption && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Target className="h-4 w-4" />
                  LLM's Personal Pick:
                </div>
                <div className="rounded-r-lg border-l-4 border-accent bg-accent/5 p-3">
                  <span className="text-lg font-bold">{recommendedOption}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    (
                    {recommendedOption === ranking[0].option
                      ? 'agrees with data'
                      : 'different from data'}
                    )
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Three Panels */}
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <Search className="h-4 w-4 text-primary" />
                Other Options
              </h4>
              <p className="mb-3 text-sm text-muted-foreground">Worth considering:</p>
              {isLoadingSuggestions ? (
                <div className="space-y-2">
                  <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
                  <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
                  <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
                </div>
              ) : suggestions.otherOptions.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                  {suggestions.otherOptions.map((opt, idx) => (
                    <li key={idx}>{opt}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">No suggestions</p>
              )}
            </Card>

            <Card className="p-5">
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <Plus className="h-4 w-4 text-accent" />
                Missing Criteria?
              </h4>
              <p className="mb-3 text-sm text-muted-foreground">You might also consider:</p>
              {isLoadingSuggestions ? (
                <div className="space-y-2">
                  <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
                  <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
                </div>
              ) : suggestions.missingCriteria.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                  {suggestions.missingCriteria.map((crit, idx) => (
                    <li key={idx}>{crit}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">No suggestions</p>
              )}
            </Card>

            <Card className="p-5">
              <h4 className="mb-3 flex items-center gap-2 font-semibold">
                <Compass className="h-4 w-4 text-gold" />
                What's Next?
              </h4>
              <p className="mb-3 text-sm text-muted-foreground">Follow-up decisions:</p>
              {isLoadingSuggestions ? (
                <div className="space-y-2">
                  <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
                  <div className="h-8 animate-pulse rounded-lg bg-muted/50" />
                </div>
              ) : suggestions.followUpDilemmas.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                  {suggestions.followUpDilemmas.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">No suggestions</p>
              )}
            </Card>
          </div>

          {/* Final Action */}
          <div className="text-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <Button onClick={onReset} size="lg" className="group">
                <RotateCcw className="mr-2 h-5 w-5 transition-transform duration-500 group-hover:rotate-180" />
                Start New Analysis
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

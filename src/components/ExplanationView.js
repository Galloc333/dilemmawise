"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronLeft, ChevronRight, RotateCcw, Medal, BarChart3, Target, Lightbulb, Search, Plus, Compass, Sparkles, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useConfetti } from '@/hooks/useConfetti';

export default function ExplanationView({ results, userContext = {}, dilemma, options: optionsProp, criteria: criteriaProp, onReset, onBackToRating, onEditOptions }) {
    const { scores, weights, ranking } = results;
    const criteriaKeys = Object.keys(weights);
    const optionNames = ranking.map(r => r.option);
    
    const options = optionsProp || optionNames;
    const criteria = criteriaProp || criteriaKeys;

    const sumWeights = criteriaKeys.reduce((sum, c) => sum + weights[c], 0);
    const maxPossibleScore = sumWeights * 10;

    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = 4;
    const [hasShownConfetti, setHasShownConfetti] = useState(false);

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
        followUpDilemmas: []
    });
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);

    const calculations = useMemo(() => {
        const winner = ranking[0];
        const runnerUp = ranking[1] || null;
        
        const contributions = {};
        options.forEach(opt => {
            contributions[opt] = {};
            criteria.forEach(crit => {
                const rating = scores[opt]?.[crit] || 0;
                const weight = weights[crit] || 0;
                contributions[opt][crit] = rating * weight;
            });
        });

        const criterionDeltas = {};
        if (runnerUp) {
            criteria.forEach(crit => {
                const winnerContrib = contributions[winner.option][crit];
                const runnerUpContrib = contributions[runnerUp.option][crit];
                criterionDeltas[crit] = {
                    winner: winnerContrib,
                    runnerUp: runnerUpContrib,
                    delta: winnerContrib - runnerUpContrib,
                    deltaPercent: runnerUpContrib > 0 ? ((winnerContrib - runnerUpContrib) / runnerUpContrib * 100) : 0
                };
            });
        }

        const gap = runnerUp ? winner.score - runnerUp.score : 0;
        const gapPercent = runnerUp ? (gap / runnerUp.score * 100) : 100;

        let keyDriver = null;
        if (runnerUp && gap > 0) {
            const drivers = criteria.map(crit => ({
                criterion: crit,
                weight: weights[crit],
                delta: criterionDeltas[crit].delta,
                contribution: Math.abs(criterionDeltas[crit].delta)
            })).sort((a, b) => b.contribution - a.contribution);

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
            runnerUp
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
                        options: optionsProp || optionNames
                    })
                });
                const data = await response.json();
                
                setDataAnalysis(data.dataAnalysis || '');
                setWhatCouldChange(data.whatCouldChange || '');
                setPersonalRecommendation(data.personalRecommendation || '');
                setRecommendedOption(data.recommendedOption || ranking[0].option);
                setAgreesWithData(data.agreesWithData !== false);
                setHasUserContext(data.hasUserContext || false);
                
            } catch (error) {
                console.error('Explanation error:', error);
                setDataAnalysis(`${ranking[0].option} ranked highest based on your weighted criteria priorities.`);
            } finally {
                setIsLoadingExplanation(false);
            }
        };
        fetchExplanations();
    }, []);

    useEffect(() => {
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
                        userContext
                    })
                });
                const data = await response.json();
                
                setSuggestions({
                    otherOptions: data.otherOptions || [],
                    missingCriteria: data.missingCriteria || [],
                    followUpDilemmas: data.followUpDilemmas || []
                });
            } catch (error) {
                console.error('Suggestions error:', error);
            } finally {
                setIsLoadingSuggestions(false);
            }
        };
        fetchSuggestions();
    }, []);

    const contextSummary = useMemo(() => {
        if (!userContext || Object.keys(userContext).length === 0) return null;
        return Object.entries(userContext)
            .filter(([_, v]) => v && v !== 'null' && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0)))
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
        <div className="max-w-4xl mx-auto">
            {/* Page Progress Indicator */}
            <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4].map(page => {
                    if (page === 3 && !shouldShowLLMPage) return null;
                    return (
                        <button
                            key={page}
                            onClick={() => goToPage(page)}
                            className={cn(
                                "flex-1 max-w-20 h-1 rounded-full transition-all cursor-pointer",
                                page <= currentPage ? "bg-primary" : "bg-border"
                            )}
                        />
                    );
                })}
            </div>

            {/* Page 1: Winner */}
            {currentPage === 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {/* Winner Announcement */}
                    <div className="text-center mb-8">
                        {/* Weighted Sum Result Badge - Top */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/40 font-medium text-sm mb-6">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Weighted Sum Result
                        </div>
                        
                        {/* Winner Name with Trophy Badge */}
                        <div className="flex items-center justify-center gap-4 mb-3">
                            {/* Trophy Badge */}
                            <div className="relative shrink-0">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center ring-2 ring-amber-300/40">
                                    <Trophy className="h-7 w-7 text-amber-950" />
                                </div>
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[9px] font-bold text-white uppercase tracking-wide shadow-sm whitespace-nowrap">
                                    #1
                                </div>
                            </div>
                            
                            {/* Winner Name */}
                            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 bg-clip-text text-transparent">
                                {calculations.winner.option}
                            </h1>
                        </div>
                        
                        <p className="text-muted-foreground">
                            Based on your weights and ratings
                        </p>
                    </div>

                    {/* Ranking */}
                    <Card className="p-6 mb-6">
                        <h2 className="text-lg font-semibold text-center mb-6 text-muted-foreground">
                            Final Ranking
                        </h2>
                        <div className="space-y-3">
                            {ranking.map((item, idx) => {
                                // Custom badge styling based on rank
                                const getBadgeStyle = (rank) => {
                                    if (rank === 0) return {
                                        bg: "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600",
                                        shadow: "shadow-lg shadow-amber-500/30",
                                        text: "text-amber-950",
                                        ring: "ring-2 ring-amber-300/50"
                                    };
                                    if (rank === 1) return {
                                        bg: "bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500",
                                        shadow: "shadow-md shadow-slate-400/30",
                                        text: "text-slate-900",
                                        ring: "ring-2 ring-slate-300/50"
                                    };
                                    if (rank === 2) return {
                                        bg: "bg-gradient-to-br from-amber-600 via-orange-700 to-amber-800",
                                        shadow: "shadow-md shadow-amber-700/30",
                                        text: "text-amber-100",
                                        ring: "ring-2 ring-amber-500/50"
                                    };
                                    return {
                                        bg: "bg-secondary",
                                        shadow: "",
                                        text: "text-muted-foreground",
                                        ring: ""
                                    };
                                };
                                const badge = getBadgeStyle(idx);
                                
                                return (
                                    <motion.div
                                        key={item.option}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-xl border transition-all",
                                            idx === 0
                                                ? "bg-gradient-to-r from-amber-50/80 to-orange-50/50 border-amber-200/60 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-800/30"
                                                : "bg-secondary/30 border-border/50"
                                        )}
                                    >
                                        {/* Custom Medal Badge */}
                                        <div className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                                            badge.bg, badge.shadow, badge.text, badge.ring
                                        )}>
                                            {idx < 3 ? (
                                                <span className="flex flex-col items-center leading-none">
                                                    <Trophy className="h-5 w-5 mb-0.5" />
                                                    <span className="text-[10px] font-black">{idx + 1}</span>
                                                </span>
                                            ) : (
                                                <span className="text-base font-bold">{idx + 1}</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className={cn(
                                                "font-semibold",
                                                idx === 0 ? "text-xl text-amber-900 dark:text-amber-100" : "text-lg"
                                            )}>
                                                {item.option}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Score: {item.score.toFixed(1)} / {maxPossibleScore}
                                            </div>
                                        </div>
                                        <div className="w-28">
                                            <Progress 
                                                value={(item.score / maxPossibleScore) * 100} 
                                                className={cn(
                                                    "h-2.5 rounded-full",
                                                    idx === 0 
                                                        ? "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500" 
                                                        : "[&>div]:bg-muted-foreground/30"
                                                )}
                                            />
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </Card>

                    {/* Why Winner Won */}
                    <Card className="p-6 mb-6">
                        <h3 className="flex items-center gap-2 font-semibold mb-4">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Why {calculations.winner.option} Won
                        </h3>
                        {isLoadingExplanation ? (
                            <div className="flex items-center gap-3 py-4">
                                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <span className="text-muted-foreground">Analyzing your decision data...</span>
                            </div>
                        ) : (
                            <>
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {dataAnalysis}
                                </p>

                                {calculations.keyDriver && (
                                    <div className="mt-4 p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
                                        <div className="flex items-center gap-2 font-semibold text-primary mb-1">
                                            <Key className="h-4 w-4" />
                                            Key Driver
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            <strong>{calculations.keyDriver.criterion}</strong> creates the dominant separation. 
                                            {calculations.winner.option} leads by <strong>+{calculations.keyDriver.contribution.toFixed(1)} points</strong> on this criterion alone 
                                            (≈ {((calculations.keyDriver.contribution / calculations.gap) * 100).toFixed(0)}% of the total gap).
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </Card>

                    {/* Navigation */}
                    <div className="flex justify-between">
                        <Button variant="outline" onClick={onReset}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Start New Analysis
                        </Button>
                        <Button onClick={nextPage}>
                            See Details
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Page 2: Details */}
            {currentPage === 2 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Weighted Sum Details
                        </h2>
                        <p className="text-muted-foreground">How we calculated the winner</p>
                    </div>

                    {/* Formula */}
                    <Card className="p-6 mb-6 text-center">
                        <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">
                            Weighted Sum Model Formula
                        </h3>
                        <div className="text-xl font-serif italic p-4 bg-secondary/30 rounded-lg mb-4">
                            Winner = arg max<sub>j∈{'{1,...,m}'}</sub> Σ<sub>i=1</sub><sup>n</sup> w<sub>i</sub> · r<sub>i,j</sub>
                        </div>
                        <div className="text-sm text-muted-foreground text-left max-w-lg mx-auto">
                            <p className="font-medium mb-2">Where:</p>
                            <ul className="space-y-1 pl-4">
                                <li>• <strong>w<sub>i</sub></strong> = weight of criterion i</li>
                                <li>• <strong>r<sub>i,j</sub></strong> = rating of option j on criterion i</li>
                                <li>• <strong>n</strong> = {criteria.length} criteria</li>
                                <li>• <strong>m</strong> = {options.length} options</li>
                            </ul>
                        </div>
                    </Card>

                    {/* Toggle & Table */}
                    <Card className="p-6 mb-6">
                        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
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
                                        <th className="text-left p-3 font-semibold">Criterion</th>
                                        <th className="text-center p-3 font-semibold">Weight</th>
                                        {options.map(opt => (
                                            <th key={opt} className="text-center p-3 font-semibold">
                                                {opt}
                                                <div className="text-xs font-normal text-muted-foreground">
                                                    {viewMode === 'rating' ? '(rating)' : '(w×r)'}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {criteria.map(crit => (
                                        <tr key={crit} className="border-b border-border/50">
                                            <td className="p-3 font-medium">{crit}</td>
                                            <td className="text-center p-3">{weights[crit]}</td>
                                            {options.map(opt => {
                                                const rating = scores[opt]?.[crit] || 0;
                                                const contribution = calculations.contributions[opt][crit];
                                                return (
                                                    <td 
                                                        key={opt} 
                                                        className={cn(
                                                            "text-center p-3",
                                                            opt === ranking[0].option && "bg-primary/5"
                                                        )}
                                                    >
                                                        {viewMode === 'rating' ? rating : (
                                                            <span>
                                                                <strong>{contribution.toFixed(1)}</strong>
                                                                <span className="text-xs text-muted-foreground ml-1">
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
                                        <td className="p-3 border-t-2 border-border">TOTAL</td>
                                        <td className="text-center p-3 border-t-2 border-border">-</td>
                                        {ranking.map(r => (
                                            <td 
                                                key={r.option} 
                                                className={cn(
                                                    "text-center p-3 border-t-2 border-border",
                                                    r.option === ranking[0].option && "text-primary"
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
                    <Card className="p-6 mb-6">
                        <h3 className="font-semibold mb-6">Component Comparison</h3>
                        <div className="space-y-6">
                            {criteria.map(crit => {
                                const maxValue = viewMode === 'rating' ? 10 : Math.max(...options.map(opt => calculations.contributions[opt][crit]));
                                return (
                                    <div key={crit}>
                                        <div className="flex justify-between mb-2">
                                            <span className="font-medium">{crit}</span>
                                            <span className="text-sm text-muted-foreground">Weight: {weights[crit]}/10</span>
                                        </div>
                                        <div className="space-y-2">
                                            {options.map(opt => {
                                                const rating = scores[opt]?.[crit] || 0;
                                                const contribution = calculations.contributions[opt][crit];
                                                const displayValue = viewMode === 'rating' ? rating : contribution;
                                                const isWinner = opt === ranking[0].option;
                                                return (
                                                    <div key={opt} className="flex items-center gap-3">
                                                        <span className="w-28 text-sm truncate">{opt}</span>
                                                        <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${(displayValue / maxValue) * 100}%` }}
                                                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                                                className={cn(
                                                                    "h-full rounded-full",
                                                                    isWinner ? "bg-primary" : "bg-muted-foreground/30"
                                                                )}
                                                            />
                                                        </div>
                                                        <span className="w-16 text-sm text-right font-medium">
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
                        <Button variant="outline" onClick={prevPage}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back to Result
                        </Button>
                        <Button onClick={nextPage}>
                            {shouldShowLLMPage ? 'See LLM Recommendation' : 'See Summary'}
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Page 3: LLM Recommendation */}
            {currentPage === 3 && shouldShowLLMPage && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="p-8 mb-6 bg-gradient-to-br from-accent/5 to-primary/5 border-2 border-accent/20">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                                <Target className="h-8 w-8 text-accent" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-2">
                                AI Recommendation
                            </h2>
                            <p className="text-muted-foreground">
                                Based on your personal context, here's an AI-driven recommendation.
                            </p>
                        </div>

                        {contextSummary && contextSummary.length > 0 && (
                            <div className="mb-6 p-4 bg-card rounded-lg border border-border">
                                <span className="text-sm font-medium text-muted-foreground">📝 Context used:</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {contextSummary.join(' • ')}
                                </p>
                            </div>
                        )}

                        {!agreesWithData && (
                            <div className="mb-4 p-4 bg-warning/10 border-l-4 border-warning rounded-r-lg">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-warning" />
                                    <span className="font-medium">Note:</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Based on your personal context, the LLM suggests a different option than the weighted-sum result.
                                </p>
                            </div>
                        )}

                        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap mb-6">
                            {personalRecommendation}
                        </p>

                        {recommendedOption && (
                            <div className={cn(
                                "p-4 rounded-lg border-2 text-center font-semibold",
                                recommendedOption === ranking[0].option
                                    ? "bg-success/10 border-success/30 text-success"
                                    : "bg-accent/10 border-accent/30 text-accent"
                            )}>
                                <span className="mr-2">
                                    {recommendedOption === ranking[0].option ? <CheckCircle2 className="h-5 w-5 inline" /> : <Sparkles className="h-5 w-5 inline" />}
                                </span>
                                LLM's pick: <span className="text-lg">{recommendedOption}</span>
                            </div>
                        )}

                        <div className="mt-4 p-3 bg-secondary/50 rounded-lg text-sm text-muted-foreground italic">
                            ⚠️ <strong>Keep in mind:</strong> This is an AI interpretation of your free-form preferences.
                        </div>
                    </Card>

                    <div className="flex justify-between">
                        <Button variant="outline" onClick={prevPage}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back to Details
                        </Button>
                        <Button onClick={nextPage}>
                            See Summary
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </motion.div>
            )}

            {/* Page 4: Summary */}
            {(currentPage === 4 || (currentPage === 3 && !shouldShowLLMPage)) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            <Sparkles className="h-6 w-6 inline mr-2 text-primary" />
                            Summary & Next Steps
                        </h2>
                        <p className="text-muted-foreground">Your decision journey at a glance</p>
                    </div>

                    {/* Quick Summary */}
                    <Card className="p-6 mb-6">
                        <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-4">Quick Summary</h3>
                        
                        <div className="mb-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <BarChart3 className="h-4 w-4" />
                                Weighted-Sum Winner:
                            </div>
                            <div className="p-3 bg-primary/5 border-l-4 border-primary rounded-r-lg">
                                <span className="text-lg font-bold">{calculations.winner.option}</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                    ({calculations.winner.score.toFixed(1)} points)
                                </span>
                            </div>
                        </div>

                        {hasUserContext && recommendedOption && (
                            <div>
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                    <Target className="h-4 w-4" />
                                    LLM's Personal Pick:
                                </div>
                                <div className="p-3 bg-accent/5 border-l-4 border-accent rounded-r-lg">
                                    <span className="text-lg font-bold">{recommendedOption}</span>
                                    <span className="text-sm text-muted-foreground ml-2">
                                        ({recommendedOption === ranking[0].option ? 'agrees with data' : 'different from data'})
                                    </span>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Three Panels */}
                    <div className="grid md:grid-cols-3 gap-4 mb-8">
                        <Card className="p-5">
                            <h4 className="flex items-center gap-2 font-semibold mb-3">
                                <Search className="h-4 w-4 text-primary" />
                                Other Options
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3">Worth considering:</p>
                            {isLoadingSuggestions ? (
                                <div className="flex items-center gap-2 py-2">
                                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    <span className="text-sm text-muted-foreground">Loading...</span>
                                </div>
                            ) : suggestions.otherOptions.length > 0 ? (
                                <ul className="text-sm text-muted-foreground space-y-1.5 pl-4 list-disc">
                                    {suggestions.otherOptions.map((opt, idx) => (
                                        <li key={idx}>{opt}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No suggestions</p>
                            )}
                        </Card>

                        <Card className="p-5">
                            <h4 className="flex items-center gap-2 font-semibold mb-3">
                                <Plus className="h-4 w-4 text-accent" />
                                Missing Criteria?
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3">You might also consider:</p>
                            {isLoadingSuggestions ? (
                                <div className="flex items-center gap-2 py-2">
                                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    <span className="text-sm text-muted-foreground">Loading...</span>
                                </div>
                            ) : suggestions.missingCriteria.length > 0 ? (
                                <ul className="text-sm text-muted-foreground space-y-1.5 pl-4 list-disc">
                                    {suggestions.missingCriteria.map((crit, idx) => (
                                        <li key={idx}>{crit}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No suggestions</p>
                            )}
                        </Card>

                        <Card className="p-5">
                            <h4 className="flex items-center gap-2 font-semibold mb-3">
                                <Compass className="h-4 w-4 text-gold" />
                                What's Next?
                            </h4>
                            <p className="text-sm text-muted-foreground mb-3">Follow-up decisions:</p>
                            {isLoadingSuggestions ? (
                                <div className="flex items-center gap-2 py-2">
                                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    <span className="text-sm text-muted-foreground">Loading...</span>
                                </div>
                            ) : suggestions.followUpDilemmas.length > 0 ? (
                                <ul className="text-sm text-muted-foreground space-y-1.5 pl-4 list-disc">
                                    {suggestions.followUpDilemmas.map((d, idx) => (
                                        <li key={idx}>{d}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No suggestions</p>
                            )}
                        </Card>
                    </div>

                    {/* Final Action */}
                    <div className="text-center">
                        <Button onClick={onReset} size="lg">
                            <RotateCcw className="mr-2 h-5 w-5" />
                            Start New Analysis
                        </Button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

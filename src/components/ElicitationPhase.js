"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, MessageCircle, Check, Info, ExternalLink, BookOpen, Sparkles, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export default function ElicitationPhase({ options, criteria, weights, onComplete, onBack, savedDescription, dilemma, userContext = {} }) {
    const [stage, setStage] = useState('intro');
    const [context, setContext] = useState(() => {
        const initial = {};
        if (userContext && typeof userContext === 'object') {
            Object.entries(userContext).forEach(([key, value]) => {
                if (value && value !== 'null') {
                    initial[key] = value;
                }
            });
        }
        return initial;
    });
    const [contextAnalysis, setContextAnalysis] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [responses, setResponses] = useState([]);
    const [budget, setBudget] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentResponse, setCurrentResponse] = useState('');
    const [currentScores, setCurrentScores] = useState({});
    const [inferredRatings, setInferredRatings] = useState(null);
    const [showWebFacts, setShowWebFacts] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });

        const currentQ = questions[currentQuestionIndex];
        if (currentQ && currentQ.relates_to && currentQ.relates_to.options) {
            const initial = {};
            currentQ.relates_to.options.forEach(opt => {
                initial[opt] = 5;
            });
            setCurrentScores(initial);
        }
    }, [responses, currentQuestionIndex, questions]);

    const analyzeContextNeeds = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/elicit-ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'analyze_context',
                    options,
                    criteria,
                    description: savedDescription,
                    dilemma,
                    userContext: { ...userContext, ...context }
                })
            });

            const data = await res.json();

            if (data.already_known_context) {
                setContext(prev => ({ ...prev, ...data.already_known_context }));
            }

            setContextAnalysis(data);
            return data;
        } catch (error) {
            console.error('Failed to analyze context:', error);
            return { needs_more_context: true, questions: [], placeholder_hint: null };
        } finally {
            setLoading(false);
        }
    };

    const startElicitation = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/elicit-ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'generate_questions',
                    options,
                    criteria,
                    weights,
                    context,
                    description: savedDescription,
                    dilemma
                })
            });

            const data = await res.json();
            setQuestions(data.questions || []);
            setBudget(data.budget || 0);
            setStage('questions');
        } catch (error) {
            console.error('Failed to generate questions:', error);
            alert('Failed to start elicitation. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleIntroNext = async () => {
        const analysis = await analyzeContextNeeds();
        setStage('context');
    };

    const handleContextSubmit = () => {
        setStage('generating');
        startElicitation();
    };

    const handleResponseSubmit = () => {
        const isLastQuestion = currentQuestionIndex === questions.length - 1;
        
        if (isLastQuestion) {
            setLoading(true);
        }
        
        const newResponses = [...responses, {
            questionId: questions[currentQuestionIndex].id,
            question: questions[currentQuestionIndex].text,
            answer: JSON.stringify(currentScores),
            numeric_scores: currentScores,
            relates_to: questions[currentQuestionIndex].relates_to
        }];

        setResponses(newResponses);

        if (!isLastQuestion) {
            setCurrentScores({});
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            inferRatings(newResponses);
        }
    };

    const inferRatings = async (allResponses) => {
        if (!loading) setLoading(true);
        try {
            const res = await fetch('/api/elicit-ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'infer_ratings',
                    options,
                    criteria,
                    responses: allResponses
                })
            });

            const data = await res.json();
            setInferredRatings(data);
            setStage('complete');
        } catch (error) {
            console.error('Failed to infer ratings:', error);
            alert('Failed to process your responses. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = () => {
        onComplete({ 
            weights, 
            scores: inferredRatings.ratings,
            userContext: context
        });
    };

    const renderTextWithSources = (text, sources) => {
        if (!sources || sources.length === 0) return text;
        let renderedText = text;
        sources.forEach((source, idx) => {
            const placeholder = '[source]';
            if (renderedText.includes(placeholder)) {
                renderedText = renderedText.replace(
                    placeholder,
                    `<a href="${source.url}" target="_blank" rel="noopener noreferrer" class="text-primary underline">[${source.title || 'source'}]</a>`
                );
            }
        });
        return <span dangerouslySetInnerHTML={{ __html: renderedText }} />;
    };

    // ========== INTRO STAGE ==========
    if (stage === 'intro') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-semibold text-foreground mb-2">
                        Let's Understand Your Preferences
                    </h1>
                    <p className="text-muted-foreground">
                        I'll ask you a few targeted questions to understand how each option meets your needs.
                    </p>
                </div>

                <Card className="p-6 mb-6">
                    <h3 className="font-semibold text-foreground mb-4">How it works</h3>
                    <div className="space-y-4">
                        {[
                            { num: 1, title: 'Natural conversation', desc: "I'll ask conversational questions, not boring forms" },
                            { num: 2, title: `Just ${Math.floor(criteria.length + 2)} questions max`, desc: 'Short and focused' },
                            { num: 3, title: 'Weighted-sum analysis', desc: 'Your inputs are passed into a weighted-sum algorithm to compute which option fits you best' },
                        ].map((step) => (
                            <div key={step.num} className="flex gap-4 items-start">
                                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                                    {step.num}
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">{step.title}</p>
                                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="flex justify-between gap-4">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Criteria
                    </Button>
                    <Button onClick={handleIntroNext} disabled={loading} size="lg">
                        {loading ? 'Analyzing...' : "Let's Begin"}
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </motion.div>
        );
    }

    // ========== CONTEXT STAGE ==========
    if (stage === 'context') {
        const contextQuestions = contextAnalysis?.questions || [];
        
        const generateContextualPlaceholder = () => {
            if (contextAnalysis?.placeholder_hint) {
                return contextAnalysis.placeholder_hint;
            }
            const optionsList = options.slice(0, 2).join(' or ');
            const criteriaList = criteria.slice(0, 2).join(', ');
            return `e.g., Any personal preferences about ${optionsList}? Constraints related to ${criteriaList}?`;
        };

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl mx-auto"
            >
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-semibold text-foreground mb-2">
                        Just a Few Quick Details
                    </h1>
                    <p className="text-muted-foreground">
                        To give you the best comparison, I'd like to understand a bit more about your situation.
                    </p>
                </div>

                <Card className="p-6 mb-6">
                    <div className="space-y-5">
                        {contextQuestions.length > 0 ? (
                            contextQuestions.map((q, idx) => (
                                <div key={idx}>
                                    <label className="block font-medium text-foreground mb-1">
                                        {q.question}
                                    </label>
                                    {q.reason && (
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {q.reason}
                                        </p>
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Type your answer..."
                                        value={context[q.field] || ''}
                                        onChange={(e) => setContext({ ...context, [q.field]: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    />
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground">
                                No specific questions needed based on your criteria. Feel free to add any additional context below!
                            </p>
                        )}

                        <div className="pt-4 border-t border-border">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">
                                Anything else I should know? (Optional)
                            </label>
                            <textarea
                                placeholder={generateContextualPlaceholder()}
                                value={context.notes || ''}
                                onChange={(e) => setContext({ ...context, notes: e.target.value })}
                                rows={2}
                                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                            />
                        </div>
                    </div>
                </Card>

                <div className="flex justify-between gap-4">
                    <Button variant="outline" onClick={() => setStage('intro')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <Button onClick={handleContextSubmit} size="lg">
                        Continue
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </motion.div>
        );
    }

    // ========== GENERATING STAGE ==========
    if (stage === 'generating') {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
            >
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Preparing your questions...</h2>
                <p className="text-muted-foreground">This will just take a moment</p>
            </motion.div>
        );
    }

    // ========== QUESTIONS STAGE ==========
    if (stage === 'questions') {
        const currentQuestion = questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
            >
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-semibold text-foreground mb-1">Rate Your Options</h1>
                    <p className="text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p>
                </div>

                {/* Progress bar */}
                <Progress value={progress} className="mb-6 h-2" />

                <Card className="p-6">
                    {/* Previous responses */}
                    <div className="max-h-64 overflow-y-auto mb-4 space-y-4">
                        {responses.map((resp, idx) => (
                            <div key={idx} className="opacity-60">
                                <div className="bg-primary/10 px-4 py-3 rounded-xl rounded-bl-sm mb-2">
                                    <span className="font-medium">Q{idx + 1}:</span>{' '}
                                    <span dangerouslySetInnerHTML={{ __html: resp.question }} />
                                </div>
                                <div className="bg-secondary/50 px-4 py-3 rounded-xl rounded-br-sm ml-8">
                                    {resp.numeric_scores && (
                                        <div className="flex gap-3 flex-wrap">
                                            {Object.entries(resp.numeric_scores).map(([opt, score]) => (
                                                <span key={opt} className="flex items-center gap-1.5">
                                                    <span className="font-medium">{opt}:</span>
                                                    <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-xs font-bold">
                                                        {score}/10
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Current Question */}
                        {currentQuestion && !loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <div className="bg-primary/10 border-2 border-primary/30 px-4 py-4 rounded-xl rounded-bl-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1">
                                            <span className="font-semibold">Q{currentQuestionIndex + 1}:</span>{' '}
                                            {currentQuestion.text}

                                            {/* Glossary */}
                                            {currentQuestion.glossary && Object.keys(currentQuestion.glossary).length > 0 && (
                                                <div className="mt-3 text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg border-l-2 border-primary/40">
                                                    {Object.entries(currentQuestion.glossary).map(([term, def]) => (
                                                        <div key={term}>
                                                            <strong>{term}:</strong> {def}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Web Facts Toggle */}
                                        {currentQuestion.webFacts && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowWebFacts(!showWebFacts)}
                                                className={cn(
                                                    "shrink-0 transition-colors",
                                                    showWebFacts ? "text-primary" : "text-muted-foreground"
                                                )}
                                                title={showWebFacts ? "Hide research" : "Show research"}
                                            >
                                                <Info className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Web Facts Expanded */}
                                    <AnimatePresence>
                                        {showWebFacts && currentQuestion.webFacts && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-4 p-4 bg-background border border-border rounded-lg text-sm"
                                            >
                                                <div className="font-semibold text-primary mb-3 flex items-center gap-2">
                                                    <BookOpen className="h-4 w-4" />
                                                    Web Evidence
                                                </div>

                                                {/* Charts */}
                                                {currentQuestion.webFacts.charts && currentQuestion.webFacts.charts.length > 0 && (() => {
                                                    const isValidChartItem = (item) => {
                                                        if (!item || !item.label) return false;
                                                        const val = item.value;
                                                        if (val === null || val === undefined) return false;
                                                        if (typeof val === 'string' && isNaN(parseFloat(val))) return false;
                                                        if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) return false;
                                                        return true;
                                                    };
                                                    
                                                    const validCharts = currentQuestion.webFacts.charts
                                                        .map(chart => ({
                                                            ...chart,
                                                            chart_data: (chart.chart_data || []).filter(isValidChartItem)
                                                        }))
                                                        .filter(chart => chart.chart_data && chart.chart_data.length > 0);
                                                    
                                                    if (validCharts.length === 0) return null;
                                                    
                                                    return (
                                                        <div className="mb-4 space-y-4">
                                                            {validCharts.slice(0, 3).map((chart, chartIdx) => (
                                                                <div key={chartIdx}>
                                                                    {chart.chart_title && (
                                                                        <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                                                                            <BarChart3 className="h-4 w-4" />
                                                                            {chart.chart_title}
                                                                        </div>
                                                                    )}

                                                                    {/* Bar Chart */}
                                                                    {(chart.chart_type === 'bar' || !chart.chart_type) && chart.chart_data.length > 0 && (() => {
                                                                        const numericData = chart.chart_data.map(d => ({ ...d, value: parseFloat(d.value) }));
                                                                        const maxValue = Math.max(...numericData.map(d => d.value));
                                                                        if (maxValue <= 0) return null;
                                                                        
                                                                        return (
                                                                            <div className="bg-secondary/30 p-3 rounded-lg space-y-3">
                                                                                {numericData.map((item, idx) => (
                                                                                    <div key={idx}>
                                                                                        <div className="flex justify-between text-xs mb-1">
                                                                                            <span className="font-medium">{item.label}</span>
                                                                                            <span className="font-semibold text-primary">
                                                                                                {Number.isInteger(item.value) ? item.value : item.value.toLocaleString()}{item.unit || ''}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                                                                            <motion.div
                                                                                                initial={{ width: 0 }}
                                                                                                animate={{ width: `${(item.value / maxValue) * 100}%` }}
                                                                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                                                className="h-full bg-primary rounded-full"
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            ))}

                                                            {currentQuestion.webFacts.takeaway && (
                                                                <div className="p-3 bg-primary/5 border-l-2 border-primary text-sm italic">
                                                                    💡 {currentQuestion.webFacts.takeaway}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Summary */}
                                                <div className="mb-4">
                                                    <div className="font-semibold mb-2 flex items-center gap-1.5">
                                                        <Sparkles className="h-4 w-4" />
                                                        Research Highlights
                                                    </div>
                                                    {currentQuestion.webFacts.summary.includes('\n') || currentQuestion.webFacts.summary.includes('- ') ? (
                                                        <ul className="list-disc pl-5 space-y-1">
                                                            {currentQuestion.webFacts.summary
                                                                .split('\n')
                                                                .filter(line => line.trim())
                                                                .map((line, i) => (
                                                                    <li key={i}>{line.replace(/^-\s*/, '').trim()}</li>
                                                                ))
                                                            }
                                                        </ul>
                                                    ) : (
                                                        <p>{currentQuestion.webFacts.summary}</p>
                                                    )}
                                                </div>

                                                {/* Sources */}
                                                <div className="text-sm">
                                                    <strong>Sources:</strong>
                                                    <ul className="mt-1 pl-5 list-disc space-y-0.5">
                                                        {currentQuestion.webFacts.sources.map((source, idx) => (
                                                            <li key={idx}>
                                                                <a
                                                                    href={source.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                                                >
                                                                    {source.title || source.url}
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                <div className="mt-3 p-2 bg-secondary/50 rounded text-xs italic flex items-center gap-2">
                                                    <Info className="h-3.5 w-3.5 shrink-0" />
                                                    This info is for reference only. Your answer determines the rating.
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Rating Input or Loading */}
                    {loading ? (
                        <div className="text-center py-8 bg-secondary/30 rounded-xl">
                            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                            <h3 className="font-semibold text-foreground mb-1">Analyzing your preferences...</h3>
                            <p className="text-sm text-muted-foreground">
                                Processing your {responses.length + 1} responses.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                            <div className="space-y-4 mb-4">
                                {currentQuestion?.relates_to?.options?.map(option => (
                                    <div key={option} className="bg-card p-4 rounded-lg shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-semibold text-foreground">{option}</span>
                                            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold">
                                                {currentScores[option] || 5}
                                            </span>
                                        </div>
                                        <Slider
                                            value={[currentScores[option] || 5]}
                                            onValueChange={(val) => setCurrentScores(prev => ({ ...prev, [option]: val[0] }))}
                                            min={1}
                                            max={10}
                                            step={1}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between mt-2 text-xs text-muted-foreground uppercase tracking-wide">
                                            <span>Poor</span>
                                            <span>Excellent</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={handleResponseSubmit} size="lg">
                                    {currentQuestionIndex === questions.length - 1 
                                        ? (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Finish & Analyze
                                            </>
                                        ) : (
                                            <>
                                                Next Question
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </>
                                        )
                                    }
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </motion.div>
        );
    }

    // ========== COMPLETE STAGE ==========
    if (stage === 'complete') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Check className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-semibold text-foreground mb-2">
                        Analysis Complete
                    </h1>
                    <p className="text-muted-foreground">
                        Based on your responses, here's what I understood about your preferences
                    </p>
                </div>

                {/* Rating Matrix */}
                <Card className="p-6 mb-6 overflow-x-auto">
                    <h3 className="font-semibold text-foreground mb-4">Rating Matrix</h3>
                    <table className="w-full border-collapse min-w-[500px]">
                        <thead>
                            <tr>
                                <th className="text-left p-3 border-b-2 border-border font-semibold">Option</th>
                                {criteria.map(crit => (
                                    <th key={crit} className="text-center p-3 border-b-2 border-border font-semibold">
                                        {crit}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {options.map(opt => (
                                <tr key={opt} className="hover:bg-secondary/30 transition-colors">
                                    <td className="p-3 font-semibold border-b border-border">{opt}</td>
                                    {criteria.map(crit => {
                                        const rating = inferredRatings?.ratings?.[opt]?.[crit] || 5;
                                        return (
                                            <td key={crit} className="text-center p-3 border-b border-border">
                                                <span className={cn(
                                                    "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                                                    rating >= 8 ? "bg-primary/20 text-primary" :
                                                    rating >= 5 ? "bg-secondary text-foreground" :
                                                    "bg-destructive/10 text-destructive"
                                                )}>
                                                    {rating}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleComplete} size="lg">
                        <Sparkles className="mr-2 h-5 w-5" />
                        Analyze Decision
                    </Button>
                </div>
            </motion.div>
        );
    }

    return null;
}

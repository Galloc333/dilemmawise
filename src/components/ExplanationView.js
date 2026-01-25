"use client";
import { useState, useRef, useEffect, useMemo } from 'react';

export default function ExplanationView({ results, userContext = {}, dilemma, options: optionsProp, criteria: criteriaProp, onReset, onBackToRating, onEditOptions }) {
    const { scores, weights, ranking } = results;
    const criteriaKeys = Object.keys(weights);
    const optionNames = ranking.map(r => r.option);
    
    // Use props if available, otherwise derive from results
    const options = optionsProp || optionNames;
    const criteria = criteriaProp || criteriaKeys;

    // Theoretical max possible score for bar scale
    const sumWeights = criteriaKeys.reduce((sum, c) => sum + weights[c], 0);
    const maxPossibleScore = sumWeights * 10;

    // State for multi-page flow
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = 4;

    // State for LLM explanations
    const [dataAnalysis, setDataAnalysis] = useState('');
    const [whatCouldChange, setWhatCouldChange] = useState('');
    const [personalRecommendation, setPersonalRecommendation] = useState('');
    const [recommendedOption, setRecommendedOption] = useState('');
    const [agreesWithData, setAgreesWithData] = useState(true);
    const [hasUserContext, setHasUserContext] = useState(false);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(true);

    // State for page 2
    const [viewMode, setViewMode] = useState('weighted'); // 'rating' or 'weighted'

    // State for page 4 dynamic suggestions
    const [suggestions, setSuggestions] = useState({
        otherOptions: [],
        missingCriteria: [],
        followUpDilemmas: []
    });
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);

    // Advanced calculations
    const calculations = useMemo(() => {
        const winner = ranking[0];
        const runnerUp = ranking[1] || null;
        
        // Calculate weighted contributions per criterion per option
        const contributions = {};
        options.forEach(opt => {
            contributions[opt] = {};
            criteria.forEach(crit => {
                const rating = scores[opt]?.[crit] || 0;
                const weight = weights[crit] || 0;
                contributions[opt][crit] = rating * weight;
            });
        });

        // Calculate per-criterion deltas (winner vs runner-up)
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

        // Gap strength
        const gap = runnerUp ? winner.score - runnerUp.score : 0;
        const gapPercent = runnerUp ? (gap / runnerUp.score * 100) : 100;

        // Find if there's ONE clearly dominant driver
        // A criterion is a "key driver" if its contribution gap is >= 50% of the total gap
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

    // Fetch explanations
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

    // Fetch dynamic suggestions for page 4
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
                // Keep default empty arrays
            } finally {
                setIsLoadingSuggestions(false);
            }
        };
        fetchSuggestions();
    }, []);

    // Format user context for display
    const contextSummary = useMemo(() => {
        if (!userContext || Object.keys(userContext).length === 0) return null;
        return Object.entries(userContext)
            .filter(([_, v]) => v && v !== 'null' && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0)))
            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .slice(0, 4);
    }, [userContext]);

    // Navigation functions
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

    // Skip to page 4 if no user context (skip LLM page)
    const effectiveTotalPages = hasUserContext ? 4 : 3;
    const shouldShowLLMPage = hasUserContext && !isLoadingExplanation;

    return (
        <div className="animate-in">
            {/* Page Progress Indicator */}
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto 2rem',
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '1rem 0'
            }}>
                {[1, 2, 3, 4].map(page => {
                    // Skip page 3 display if no user context
                    if (page === 3 && !shouldShowLLMPage) return null;
                    
                    return (
                        <div
                            key={page}
                            onClick={() => goToPage(page)}
                            style={{
                                flex: 1,
                                height: '4px',
                                background: page <= currentPage ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.1)',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    );
                })}
            </div>

            {/* Page 1: Weighted Sum Podium */}
            {currentPage === 1 && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <div className="winner-badge" style={{ marginBottom: '1rem' }}>
                            🏆 Weighted Sum Result
                        </div>
                        <h1 style={{ 
                            fontSize: '3.5rem', 
                            marginBottom: '1rem', 
                            background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)', 
                            WebkitBackgroundClip: 'text', 
                            WebkitTextFillColor: 'transparent', 
                            fontWeight: '800' 
                        }}>
                            {calculations.winner.option}
                        </h1>
                        <p style={{ fontSize: '1rem', opacity: 0.6, marginBottom: '2rem' }}>
                            Based on your weights and ratings
                        </p>
                    </div>

                    {/* Podium/Ranked List */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textAlign: 'center', opacity: 0.8 }}>
                            Final Ranking
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {ranking.map((item, idx) => (
                                <div 
                                    key={item.option} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        gap: '1rem',
                                        padding: '1.25rem',
                                        background: idx === 0 ? 'linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(280 60% 50% / 0.08))' : 'hsl(var(--foreground) / 0.02)',
                                        borderRadius: '0.75rem',
                                        border: idx === 0 ? '2px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border))'
                                    }}
                                >
                                    <div style={{ 
                                        fontSize: '2rem',
                                        minWidth: '50px',
                                        textAlign: 'center'
                                    }}>
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ 
                                            fontSize: idx === 0 ? '1.5rem' : '1.2rem', 
                                            fontWeight: idx === 0 ? '700' : '600',
                                            marginBottom: '0.25rem'
                                        }}>
                                            {item.option}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                                            Score: {item.score.toFixed(1)} / {maxPossibleScore}
                                        </div>
                                    </div>
                                    <div style={{ 
                                        height: '8px', 
                                        width: '120px',
                                        background: 'hsl(var(--foreground) / 0.05)', 
                                        borderRadius: '4px', 
                                        overflow: 'hidden' 
                                    }}>
                                        <div style={{
                                            width: `${(item.score / maxPossibleScore) * 100}%`,
                                            height: '100%',
                                            background: idx === 0
                                                ? 'linear-gradient(90deg, hsl(var(--primary)), #a855f7)'
                                                : 'hsl(var(--foreground) / 0.2)',
                                            transition: 'width 1s ease-out'
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Why the Winner Won */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', opacity: 0.8 }}>
                            📊 Why {calculations.winner.option} Won
                        </h3>
                        {isLoadingExplanation ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
                                <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
                                <span style={{ opacity: 0.7 }}>Analyzing your decision data...</span>
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    color: 'hsl(var(--foreground) / 0.85)',
                                    lineHeight: '1.9',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '0.95rem'
                                }}>
                                    {dataAnalysis}
                                </div>

                                {/* Key Driver - Only if ONE criterion creates dominant gap */}
                                {calculations.keyDriver && (
                                    <div style={{
                                        marginTop: '1.5rem',
                                        padding: '1rem 1.25rem',
                                        background: 'hsl(var(--primary) / 0.05)',
                                        borderRadius: '0.5rem',
                                        borderLeft: '3px solid hsl(var(--primary))'
                                    }}>
                                        <strong style={{ color: 'hsl(var(--primary))' }}>🔑 Key Driver:</strong>
                                        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.85 }}>
                                            <strong>{calculations.keyDriver.criterion}</strong> creates the dominant separation. 
                                            {calculations.winner.option} leads by <strong>+{calculations.keyDriver.contribution.toFixed(1)} points</strong> on this criterion alone 
                                            (≈ {((calculations.keyDriver.contribution / calculations.gap) * 100).toFixed(0)}% of the total gap).
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                        <button 
                            onClick={onReset}
                            className="btn btn-secondary"
                        >
                            ← Start New Analysis
                        </button>
                        <button 
                            onClick={nextPage}
                            className="btn btn-primary"
                        >
                            See Details →
                        </button>
                    </div>
                </div>
            )}

            {/* Page 2: Weighted Sum Details (Formula + Charts) */}
            {currentPage === 2 && (
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: '700' }}>
                            📐 Weighted Sum Details
                        </h2>
                        <p style={{ fontSize: '0.95rem', opacity: 0.6 }}>
                            How we calculated the winner
                        </p>
                    </div>

                    {/* Formula */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1rem', opacity: 0.6, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Weighted Sum Model Formula
                        </h3>
                        <div style={{ 
                            fontSize: '1.5rem', 
                            fontFamily: 'serif', 
                            fontStyle: 'italic',
                            marginBottom: '1.5rem',
                            padding: '1.5rem',
                            background: 'hsl(var(--foreground) / 0.03)',
                            borderRadius: '0.5rem'
                        }}>
                            Winner = arg max<sub>j∈{'{1,...,m}'}</sub> Σ<sub>i=1</sub><sup>n</sup> w<sub>i</sub> · r<sub>i,j</sub>
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.8', textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}>
                            <p><strong>Where:</strong></p>
                            <ul style={{ paddingLeft: '1.5rem' }}>
                                <li><strong>Winner</strong> = the option with the highest total score</li>
                                <li><strong>w<sub>i</sub></strong> = weight (priority) of criterion i</li>
                                <li><strong>r<sub>i,j</sub></strong> = rating of option j on criterion i</li>
                                <li><strong>n</strong> = number of criteria ({criteria.length})</li>
                                <li><strong>m</strong> = number of options ({options.length})</li>
                            </ul>
                        </div>
                    </div>

                    {/* Detailed Table with Toggle */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <h3 style={{ fontSize: '1.1rem' }}>Detailed Breakdown</h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setViewMode('rating')}
                                    style={{
                                        padding: '0.4rem 0.9rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid hsl(var(--border))',
                                        background: viewMode === 'rating' ? 'hsl(var(--primary))' : 'white',
                                        color: viewMode === 'rating' ? 'white' : 'inherit',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    View Ratings
                                </button>
                                <button
                                    onClick={() => setViewMode('weighted')}
                                    style={{
                                        padding: '0.4rem 0.9rem',
                                        borderRadius: '0.5rem',
                                        border: '1px solid hsl(var(--border))',
                                        background: viewMode === 'weighted' ? 'hsl(var(--primary))' : 'white',
                                        color: viewMode === 'weighted' ? 'white' : 'inherit',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    View Contributions
                                </button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>Criterion</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>Weight (w<sub>i</sub>)</th>
                                        {options.map(opt => (
                                            <th key={opt} style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>
                                                {opt}
                                                <br/>
                                                <span style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 'normal' }}>
                                                    {viewMode === 'rating' ? '(rating)' : '(w×r)'}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {criteria.map(crit => (
                                        <tr key={crit}>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid hsl(var(--border))', fontWeight: '500' }}>{crit}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '1px solid hsl(var(--border))' }}>{weights[crit]}</td>
                                            {options.map(opt => {
                                                const rating = scores[opt]?.[crit] || 0;
                                                const contribution = calculations.contributions[opt][crit];
                                                return (
                                                    <td key={opt} style={{ 
                                                        textAlign: 'center', 
                                                        padding: '0.75rem', 
                                                        borderBottom: '1px solid hsl(var(--border))', 
                                                        background: opt === ranking[0].option ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                                                        title: `Rating: ${rating}/10`
                                                    }}>
                                                        {viewMode === 'rating' ? rating : (
                                                            <span>
                                                                <strong>{contribution.toFixed(1)}</strong>
                                                                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}> ({weights[crit]}×{rating})</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'hsl(var(--foreground) / 0.05)', fontWeight: 'bold' }}>
                                        <td style={{ padding: '1rem', borderTop: '2px solid hsl(var(--border))' }}>TOTAL SCORE</td>
                                        <td style={{ textAlign: 'center', padding: '1rem', borderTop: '2px solid hsl(var(--border))' }}>-</td>
                                        {ranking.map(r => (
                                            <td key={r.option} style={{ 
                                                textAlign: 'center', 
                                                padding: '1rem', 
                                                borderTop: '2px solid hsl(var(--border))', 
                                                color: r.option === ranking[0].option ? 'hsl(var(--primary))' : 'inherit',
                                                fontSize: '1rem'
                                            }}>
                                                {r.score.toFixed(1)}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Component Comparison Charts */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Component Comparison</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {criteria.map(crit => {
                                const maxValue = viewMode === 'rating' ? 10 : Math.max(...options.map(opt => calculations.contributions[opt][crit]));
                                return (
                                    <div key={crit}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '600' }}>{crit}</span>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Weight: {weights[crit]}/10</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {options.map(opt => {
                                                const rating = scores[opt]?.[crit] || 0;
                                                const contribution = calculations.contributions[opt][crit];
                                                const displayValue = viewMode === 'rating' ? rating : contribution;
                                                return (
                                                    <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ width: '120px', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {opt}
                                                        </div>
                                                        <div style={{ flex: 1, height: '10px', background: 'hsl(var(--border))', borderRadius: '5px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: `${(displayValue / maxValue) * 100}%`,
                                                                height: '100%',
                                                                background: opt === ranking[0].option ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.25)',
                                                                borderRadius: '5px',
                                                                transition: 'width 0.5s ease'
                                                            }} />
                                                        </div>
                                                        <div style={{ width: '80px', fontSize: '0.85rem', textAlign: 'right', fontWeight: '600' }}>
                                                            {viewMode === 'rating' ? (
                                                                <span title={`${rating === 10 ? 'Very satisfied' : rating >= 7 ? 'Satisfied' : rating >= 4 ? 'Neutral' : 'Not satisfied'}`}>
                                                                    {rating}/10
                                                                </span>
                                                            ) : (
                                                                <span>{contribution.toFixed(1)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                        <button 
                            onClick={prevPage}
                            className="btn btn-secondary"
                        >
                            ← Back to Result
                        </button>
                        <button 
                            onClick={nextPage}
                            className="btn btn-primary"
                        >
                            {shouldShowLLMPage ? 'See LLM Recommendation →' : 'See Summary →'}
                        </button>
                    </div>
                </div>
            )}

            {/* Page 3: LLM Recommendation (only if hasUserContext) */}
            {currentPage === 3 && shouldShowLLMPage && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div className="card" style={{ 
                        padding: '3rem 2rem', 
                        marginBottom: '2rem',
                        background: 'linear-gradient(135deg, hsl(280 60% 98%), hsl(var(--card)))',
                        border: '2px solid hsl(280 60% 85%)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                            <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem', fontWeight: '700' }}>
                                Want to see what the LLM thinks?
                            </h2>
                            <p style={{ fontSize: '1rem', opacity: 0.7, lineHeight: '1.6' }}>
                                Based on the personal details you shared in Quick Details and our conversation, 
                                here's an AI-driven recommendation that goes beyond pure numbers.
                            </p>
                        </div>

                        {/* Inputs Used */}
                        {contextSummary && contextSummary.length > 0 && (
                            <div style={{ 
                                marginBottom: '2rem',
                                padding: '1rem 1.25rem',
                                background: 'white',
                                borderRadius: '0.5rem',
                                border: '1px solid hsl(var(--border))'
                            }}>
                                <strong style={{ fontSize: '0.9rem', opacity: 0.8 }}>📝 Context used:</strong>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', lineHeight: '1.7', opacity: 0.7 }}>
                                    {contextSummary.join(' • ')}
                                </div>
                            </div>
                        )}

                        {/* Note if disagrees with data */}
                        {!agreesWithData && (
                            <div style={{
                                marginBottom: '1.5rem',
                                padding: '1rem 1.25rem',
                                background: 'hsl(45 80% 95%)',
                                borderRadius: '0.5rem',
                                borderLeft: '3px solid hsl(45 80% 50%)',
                                fontSize: '0.9rem'
                            }}>
                                <span>💡</span> <strong>Note:</strong> Based on your personal context, the LLM suggests a different option than the weighted-sum result.
                            </div>
                        )}

                        {/* LLM Recommendation Text */}
                        <div style={{
                            color: 'hsl(var(--foreground) / 0.85)',
                            lineHeight: '1.9',
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.95rem',
                            marginBottom: '1.5rem'
                        }}>
                            {personalRecommendation}
                        </div>

                        {/* Recommended Option Badge */}
                        {recommendedOption && (
                            <div style={{
                                padding: '1rem 1.5rem',
                                background: recommendedOption === ranking[0].option ? 'hsl(160 60% 95%)' : 'hsl(280 60% 95%)',
                                borderRadius: '0.5rem',
                                border: `2px solid ${recommendedOption === ranking[0].option ? 'hsl(160 60% 60%)' : 'hsl(280 60% 60%)'}`,
                                textAlign: 'center',
                                fontWeight: '600',
                                fontSize: '1rem'
                            }}>
                                {recommendedOption === ranking[0].option ? '✓' : '🌟'} LLM's pick: <strong style={{ fontSize: '1.2rem' }}>{recommendedOption}</strong>
                            </div>
                        )}

                        {/* Caveat */}
                        <div style={{
                            marginTop: '1.5rem',
                            padding: '0.75rem 1rem',
                            background: 'hsl(0 0% 96%)',
                            borderRadius: '0.5rem',
                            fontSize: '0.85rem',
                            fontStyle: 'italic',
                            opacity: 0.8
                        }}>
                            ⚠️ <strong>Keep in mind:</strong> This is an AI interpretation of your free-form preferences.
                        </div>
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                        <button 
                            onClick={prevPage}
                            className="btn btn-secondary"
                        >
                            ← Back to Details
                        </button>
                        <button 
                            onClick={nextPage}
                            className="btn btn-primary"
                        >
                            See Summary & Next Steps →
                        </button>
                    </div>
                </div>
            )}

            {/* Page 4: Final Wrap-Up */}
            {(currentPage === 4 || (currentPage === 3 && !shouldShowLLMPage)) && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: '700' }}>
                            ✨ Summary & Next Steps
                        </h2>
                        <p style={{ fontSize: '0.95rem', opacity: 0.6 }}>
                            Your decision journey at a glance
                        </p>
                    </div>

                    {/* Compact Summary */}
                    <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1rem', opacity: 0.7, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Quick Summary
                        </h3>
                        
                        {/* Weighted-sum ranking */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <strong style={{ fontSize: '0.9rem', opacity: 0.8 }}>📊 Weighted-Sum Winner:</strong>
                            <div style={{ 
                                marginTop: '0.5rem',
                                padding: '0.75rem 1rem',
                                background: 'hsl(var(--primary) / 0.05)',
                                borderRadius: '0.5rem',
                                borderLeft: '3px solid hsl(var(--primary))'
                            }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>{calculations.winner.option}</span>
                                <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', opacity: 0.6 }}>
                                    ({calculations.winner.score.toFixed(1)} points)
                                </span>
                            </div>
                        </div>

                        {/* LLM pick */}
                        {hasUserContext && recommendedOption && (
                            <div>
                                <strong style={{ fontSize: '0.9rem', opacity: 0.8 }}>🎯 LLM's Personal Pick:</strong>
                                <div style={{ 
                                    marginTop: '0.5rem',
                                    padding: '0.75rem 1rem',
                                    background: 'hsl(280 60% 95%)',
                                    borderRadius: '0.5rem',
                                    borderLeft: '3px solid hsl(280 60% 60%)'
                                }}>
                                    <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>{recommendedOption}</span>
                                    {recommendedOption === ranking[0].option ? (
                                        <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', opacity: 0.6 }}>
                                            (agrees with weighted-sum)
                                        </span>
                                    ) : (
                                        <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', opacity: 0.6 }}>
                                            (different from weighted-sum)
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Three Panels */}
                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', alignItems: 'stretch' }}>
                        {/* Other Options Panel */}
                        <div className="card" style={{ flex: 1, padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🔍</span> Other Options
                            </h4>
                            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
                                Worth considering:
                            </div>
                            {isLoadingSuggestions ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                                    <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Generating suggestions...</span>
                                </div>
                            ) : suggestions.otherOptions.length > 0 ? (
                                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.8', opacity: 0.8 }}>
                                    {suggestions.otherOptions.map((opt, idx) => (
                                        <li key={idx}>{opt}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>No additional options suggested</p>
                            )}
                        </div>

                        {/* Additional Criteria Panel */}
                        <div className="card" style={{ flex: 1, padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>➕</span> Missing Criteria?
                            </h4>
                            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
                                You might also consider:
                            </div>
                            {isLoadingSuggestions ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                                    <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Generating suggestions...</span>
                                </div>
                            ) : suggestions.missingCriteria.length > 0 ? (
                                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.8', opacity: 0.8 }}>
                                    {suggestions.missingCriteria.map((crit, idx) => (
                                        <li key={idx}>{crit}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>No additional criteria suggested</p>
                            )}
                        </div>

                        {/* Follow-up Dilemmas Panel */}
                        <div className="card" style={{ flex: 1, padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🔮</span> What's Next?
                            </h4>
                            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
                                Follow-up decisions:
                            </div>
                            {isLoadingSuggestions ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                                    <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                                    <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Generating suggestions...</span>
                                </div>
                            ) : suggestions.followUpDilemmas.length > 0 ? (
                                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', lineHeight: '1.8', opacity: 0.8 }}>
                                    {suggestions.followUpDilemmas.map((dilemma, idx) => (
                                        <li key={idx}>{dilemma}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>No follow-up suggestions</p>
                            )}
                        </div>
                    </div>

                    {/* Final Action */}
                    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                        <button 
                            onClick={onReset}
                            className="btn btn-primary"
                            style={{ padding: '0.75rem 2.5rem', fontSize: '1rem' }}
                        >
                            🔄 Start New Analysis
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

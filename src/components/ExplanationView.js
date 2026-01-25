"use client";
import { useState, useRef, useEffect } from 'react';

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

    // Part A: Data-driven analysis
    const [dataAnalysis, setDataAnalysis] = useState('');
    const [whatCouldChange, setWhatCouldChange] = useState('');
    
    // Part B: Personal recommendation
    const [personalRecommendation, setPersonalRecommendation] = useState('');
    const [recommendedOption, setRecommendedOption] = useState('');
    const [agreesWithData, setAgreesWithData] = useState(true);
    const [hasUserContext, setHasUserContext] = useState(false);
    
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(true);
    const [showDetails, setShowDetails] = useState(false);

    // Fetch explanations on mount
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
                
                // Part A
                setDataAnalysis(data.dataAnalysis || data.whyItWon || '');
                setWhatCouldChange(data.whatCouldChange || '');
                
                // Part B
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

    return (
        <div className="animate-in">
            {/* 1. Top Section: Winner & Final Scores Bar Chart */}
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <div className="winner-badge" style={{ marginBottom: '1rem' }}>
                    🏆 Winning Recommendation
                </div>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '800' }}>
                    {ranking[0].option}
                </h1>

                <div className="card" style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', opacity: 0.7 }}>Weighted Total Score</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {ranking.map((item, idx) => (
                            <div key={item.option} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: idx === 0 ? '700' : '500' }}>
                                    <span>{idx === 0 ? '🥇 ' : ''}{item.option}</span>
                                    <span>{item.score.toFixed(1)} <span style={{ opacity: 0.4, fontSize: '0.8rem', fontWeight: 'normal' }}>/ {maxPossibleScore}</span></span>
                                </div>
                                <div style={{ height: '12px', background: 'hsl(var(--foreground) / 0.05)', borderRadius: '6px', overflow: 'hidden' }}>
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
            </div>

            {/* 2. Analysis Summary - Part A: Weighted Sum Analysis */}
            <div style={{ maxWidth: '800px', margin: '0 auto 1.5rem' }}>
                <div className="card" style={{ borderLeft: '4px solid hsl(var(--primary))', padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📊</span> Weighted Sum Analysis
                    </h3>
                    <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1.5rem', lineHeight: '1.6' }}>
                        This is a deterministic calculation based on your numeric inputs. You provided importance weights (1-10) for each criterion and rated each option (1-10) through the questionnaire. The weighted-sum algorithm multiplies each rating by its criterion weight and sums the results to produce the final ranked outcome shown above. A detailed breakdown of this calculation is available at the bottom of this page.
                    </p>
                    {isLoadingExplanation ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="spinner" style={{ width: '24px', height: '24px' }}></div>
                            <span style={{ opacity: 0.7 }}>Analyzing your decision data...</span>
                        </div>
                    ) : (
                        <>
                            <div style={{
                                color: 'hsl(var(--foreground) / 0.85)',
                                lineHeight: '1.9',
                                whiteSpace: 'pre-wrap',
                                fontSize: '1rem'
                            }}>
                                {dataAnalysis}
                            </div>
                            {whatCouldChange && (
                                <div style={{
                                    marginTop: '1.5rem',
                                    padding: '1rem 1.25rem',
                                    background: 'hsl(var(--foreground) / 0.03)',
                                    borderRadius: '0.5rem',
                                    borderLeft: '3px solid hsl(45 80% 50%)'
                                }}>
                                    <strong style={{ color: 'hsl(45 80% 40%)' }}>⚖️ What could change the result:</strong>
                                    <p style={{ marginTop: '0.5rem', opacity: 0.85, lineHeight: '1.6' }}>
                                        {whatCouldChange}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 3. Analysis Summary - Part B: LLM Analysis */}
            {!isLoadingExplanation && hasUserContext && personalRecommendation && (
                <div style={{ maxWidth: '800px', margin: '0 auto 2.5rem' }}>
                    <div className="card" style={{ 
                        borderLeft: `4px solid ${agreesWithData ? 'hsl(160 60% 45%)' : 'hsl(280 60% 55%)'}`, 
                        padding: '2rem',
                        background: agreesWithData 
                            ? 'linear-gradient(135deg, hsl(160 60% 98%), hsl(var(--card)))' 
                            : 'linear-gradient(135deg, hsl(280 60% 98%), hsl(var(--card)))'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🎯</span> LLM Analysis (based on your preferences)
                        </h3>
                        <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            This is a high-level interpretation by an AI language model using the free-form personal information you provided through the chat and Quick Details (budget, lifestyle preferences, constraints, and other qualitative factors). Unlike the weighted-sum calculation above, this analysis considers your broader context and may suggest a different option if it believes another choice better fits your specific situation.
                        </p>
                        
                        {!agreesWithData && (
                            <div style={{
                                marginBottom: '1rem',
                                padding: '0.75rem 1rem',
                                background: 'hsl(280 60% 95%)',
                                borderRadius: '0.5rem',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <span>💡</span>
                                <span>
                                    <strong>Note:</strong> Based on your personal context, I have a different recommendation than the pure data suggests.
                                </span>
                            </div>
                        )}
                        
                        <div style={{
                            color: 'hsl(var(--foreground) / 0.85)',
                            lineHeight: '1.9',
                            whiteSpace: 'pre-wrap',
                            fontSize: '1rem'
                        }}>
                            {personalRecommendation}
                        </div>
                        
                        {recommendedOption && recommendedOption !== ranking[0].option && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem 1rem',
                                background: 'hsl(280 60% 55% / 0.1)',
                                borderRadius: '0.5rem',
                                fontWeight: '600',
                                color: 'hsl(280 60% 45%)'
                            }}>
                                🌟 My personal pick for you: <strong>{recommendedOption}</strong>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Divider if no personal context */}
            {!isLoadingExplanation && !hasUserContext && (
                <div style={{ maxWidth: '800px', margin: '0 auto 2.5rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>
                        💡 Tip: Share more personal details in Quick Details to get a personalized recommendation!
                    </p>
                </div>
            )}

            {/* 3. Transparency & Math Details */}
            <div style={{ maxWidth: '800px', margin: '0 auto 3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.9rem', padding: '0.5rem 1.5rem' }}
                    >
                        {showDetails ? 'Hide Calculation Logic' : 'Show Mathematical Breakdown'}
                    </button>
                </div>

                {showDetails && (
                    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Formula Display */}
                        <div style={{ textAlign: 'center', padding: '2rem', background: 'hsl(var(--foreground) / 0.03)', borderRadius: '1rem', border: '1px dashed hsl(var(--border))' }}>
                            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5, marginBottom: '1rem' }}>Calculation Formula: Weighted Sum Model</h4>
                            <div style={{ fontSize: '1.8rem', fontFamily: 'serif', fontStyle: 'italic', fontWeight: '600', marginBottom: '1rem' }}>
                                Total Score = Σ ( Rating<sub>i</sub> × Weight<sub>i</sub> )
                            </div>
                            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                                The final score is the sum of each criterion's rating (1-10) multiplied by its priority weight (1-10).
                            </p>
                        </div>

                        {/* Detailed Table */}
                        <div className="card" style={{ overflowX: 'auto', padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Step-by-Step Breakdown</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>Criterion</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>Weight (W<sub>i</sub>)</th>
                                        {options.map(opt => (
                                            <th key={opt} style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>{opt} Rating (R<sub>ij</sub>)</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {criteria.map(crit => (
                                        <tr key={crit}>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid hsl(var(--border))', fontWeight: '500' }}>{crit}</td>
                                            <td style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '1px solid hsl(var(--border))' }}>{weights[crit]}</td>
                                            {options.map(opt => (
                                                <td key={opt} style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '1px solid hsl(var(--border))', background: opt === ranking[0].option ? 'hsl(var(--primary) / 0.03)' : 'transparent' }}>
                                                    {scores[opt]?.[crit] || 0}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'hsl(var(--foreground) / 0.05)', fontWeight: 'bold' }}>
                                        <td style={{ padding: '1rem', borderTop: '2px solid hsl(var(--border))' }}>FINAL WEIGHTED SUM</td>
                                        <td style={{ textAlign: 'center', padding: '1rem', borderTop: '2px solid hsl(var(--border))' }}>-</td>
                                        {ranking.map(r => (
                                            <td key={r.option} style={{ textAlign: 'center', padding: '1rem', borderTop: '2px solid hsl(var(--border))', color: r.option === ranking[0].option ? 'hsl(var(--primary))' : 'inherit' }}>
                                                {r.score.toFixed(1)}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Criterion-Level Bar Comparison */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Component Comparison</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {criteria.map(crit => (
                                    <div key={crit}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '600' }}>{crit}</span>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Weight: {weights[crit]}/10</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {options.map(opt => (
                                                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ width: '120px', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</div>
                                                    <div style={{ flex: 1, height: '8px', background: 'hsl(var(--border))', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${(scores[opt]?.[crit] || 0) * 10}%`,
                                                            height: '100%',
                                                            background: opt === ranking[0].option ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.2)',
                                                            borderRadius: '4px'
                                                        }} />
                                                    </div>
                                                    <div style={{ width: '25px', fontSize: '0.8rem', textAlign: 'right', fontWeight: '600' }}>{scores[opt]?.[crit] || 0}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ textAlign: 'center', marginTop: '4rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button onClick={onReset} className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
                    🔄 Start New Analysis
                </button>
            </div>
        </div>
    );
}

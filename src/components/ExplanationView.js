"use client";
import { useState, useRef, useEffect } from 'react';

export default function ExplanationView({ results, onReset, onBackToRating, onEditOptions }) {
    const { scores, weights, ranking } = results;
    const criteria = Object.keys(weights);
    const options = ranking.map(r => r.option);

    // Theoretical max possible score for bar scale
    const sumWeights = criteria.reduce((sum, c) => sum + weights[c], 0);
    const maxPossibleScore = sumWeights * 10;

    const [whyItWon, setWhyItWon] = useState('');
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
                        scores
                    })
                });
                const data = await response.json();
                setWhyItWon(data.whyItWon);
            } catch (error) {
                console.error('Explanation error:', error);
                setWhyItWon(`${ranking[0].option} ranked highest based on your weighted criteria priorities.`);
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

            {/* 2. Insight Card */}
            <div style={{ maxWidth: '800px', margin: '0 auto 2.5rem' }}>
                <div className="card" style={{ borderLeft: '4px solid hsl(var(--primary))', padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>💡</span> Analysis Summary
                    </h3>
                    <div style={{
                        color: 'hsl(var(--foreground) / 0.8)',
                        lineHeight: '1.8',
                        whiteSpace: 'pre-wrap',
                        fontSize: '1.05rem'
                    }}>
                        {isLoadingExplanation ? 'Deep analyzing your decision map...' : whyItWon}
                    </div>
                </div>
            </div>

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
                <button onClick={onEditOptions} className="btn btn-secondary">✏️ Edit Decision</button>
                <button onClick={onReset} className="btn btn-secondary">🔄 Start New</button>
            </div>
        </div>
    );
}

"use client";
import { useState } from 'react';

export default function RatingPhase({ options, criteria, weights, onAnalyze, onBack, savedScores }) {
    // Use saved scores if provided, otherwise default to 3 (Good)
    const [scores, setScores] = useState(
        savedScores || options.reduce((acc, opt) => ({
            ...acc,
            [opt]: criteria.reduce((cAcc, c) => ({ ...cAcc, [c]: 3 }), {})
        }), {})
    );

    const handleScoreChange = (option, criterion, value) => {
        setScores(prev => ({
            ...prev,
            [option]: {
                ...prev[option],
                [criterion]: parseInt(value)
            }
        }));
    };

    const getSatisfactionLabel = (value) => {
        const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
        return labels[value - 1] || 'Good';
    };

    return (
        <div className="animate-in">
            <div className="phase-header">
                <h1>Rate Your Options</h1>
                <p>How well does each option satisfy each criterion?</p>
            </div>

            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                {options.map((option) => (
                    <div key={option} className="card" style={{ marginBottom: '1.5rem' }}>
                        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '0.9rem',
                                fontWeight: '700'
                            }}>
                                {options.indexOf(option) + 1}
                            </span>
                            {option}
                        </h2>

                        {criteria.map((criterion) => (
                            <div key={criterion} className="slider-container">
                                <div className="slider-label">
                                    <span>{criterion}</span>
                                    <span className="slider-value">
                                        {getSatisfactionLabel(scores[option][criterion])}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={scores[option][criterion]}
                                    onChange={(e) => handleScoreChange(option, criterion, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
                    <button
                        onClick={onBack}
                        className="btn btn-secondary"
                    >
                        ← Back to Criteria
                    </button>
                    <button
                        onClick={() => onAnalyze({ weights, scores })}
                        className="btn btn-primary btn-lg"
                    >
                        🎯 Analyze Decision
                    </button>
                </div>
            </div>
        </div>
    );
}

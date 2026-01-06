"use client";
import { useState } from 'react';

export default function CriteriaPhase({ criteria, onNext, onBack, savedWeights }) {
    // Use saved weights if provided, otherwise default to 3 (moderate)
    const [weights, setWeights] = useState(
        criteria.reduce((acc, c) => ({ ...acc, [c]: savedWeights?.[c] ?? 3 }), {})
    );

    const handleWeightChange = (criterion, value) => {
        setWeights(prev => ({ ...prev, [criterion]: parseInt(value) }));
    };

    const getImportanceLabel = (value) => {
        const labels = ['Not Important', 'Slightly', 'Moderate', 'Important', 'Critical'];
        return labels[value - 1] || 'Moderate';
    };

    return (
        <div className="animate-in">
            <div className="phase-header">
                <h1>Prioritize Your Criteria</h1>
                <p>How important is each factor in your decision?</p>
            </div>

            <div className="max-w-2xl mx-auto">
                <div className="card" style={{ marginBottom: '2rem' }}>
                    {criteria.map((criterion) => (
                        <div key={criterion} className="slider-container">
                            <div className="slider-label">
                                <span>{criterion}</span>
                                <span className="slider-value">
                                    {getImportanceLabel(weights[criterion])}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={weights[criterion]}
                                onChange={(e) => handleWeightChange(criterion, e.target.value)}
                            />
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <button
                        onClick={onBack}
                        className="btn btn-secondary"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={() => onNext(weights)}
                        className="btn btn-primary btn-lg"
                    >
                        Continue to Rating →
                    </button>
                </div>
            </div>
        </div>
    );
}

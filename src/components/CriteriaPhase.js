"use client";
import { useState } from 'react';

export default function CriteriaPhase({ criteria, onNext, onBack, savedWeights }) {
    // Use saved weights if provided, otherwise default to 3 (Medium)
    const [weights, setWeights] = useState(
        criteria.reduce((acc, c) => ({ ...acc, [c]: savedWeights?.[c] ?? 3 }), {})
    );
    const [explanations, setExplanations] = useState({});
    const [loadingExplanations, setLoadingExplanations] = useState(true);
    const [hoveredCriterion, setHoveredCriterion] = useState(null);

    // Fetch AI explanations on mount
    useState(() => {
        const fetchExplanations = async () => {
            try {
                const res = await fetch('/api/explain-criteria', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ criteria })
                });
                if (res.ok) {
                    const data = await res.json();
                    setExplanations(data);
                }
            } catch (err) {
                console.error("Failed to fetch explanations", err);
            } finally {
                setLoadingExplanations(false);
            }
        };
        fetchExplanations();
    }, [criteria]); // Run only when criteria list changes

    const handleWeightChange = (criterion, value) => {
        setWeights(prev => ({ ...prev, [criterion]: parseInt(value) }));
    };

    const getImportanceLabel = (value) => {
        const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
        return labels[value - 1] || 'Medium';
    };

    return (
        <div className="animate-in">
            <div className="phase-header">
                <h1>Prioritize Your Criteria</h1>
                <p>How important is each factor in your decision?</p>
            </div>

            <div className="max-w-2xl mx-auto relative">
                <div className="card" style={{ marginBottom: '2rem' }}>
                    {criteria.map((criterion) => (
                        <div key={criterion} className="slider-container"
                            onMouseEnter={() => setHoveredCriterion(criterion)}
                            onMouseLeave={() => setHoveredCriterion(null)}>

                            <div className="slider-label">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'help' }}>
                                    {criterion}
                                    <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>ℹ️</span>
                                </span>
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

                            {/* Tooltip */}
                            {hoveredCriterion === criterion && explanations[criterion] && (
                                <div className="tooltip-custom animate-in">
                                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--primary))' }}>
                                        Why weigh this High?
                                    </div>
                                    {explanations[criterion]}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <button onClick={onBack} className="btn btn-secondary">← Back</button>
                    <button onClick={() => onNext(weights)} className="btn btn-primary btn-lg">Continue to Rating →</button>
                </div>
            </div>

            <style jsx>{`
                .tooltip-custom {
                    position: absolute;
                    left: 100%;
                    top: 50%;
                    transform: translateY(-50%);
                    margin-left: 1rem;
                    background: hsl(var(--card));
                    border: 1px solid hsl(var(--primary) / 0.3);
                    padding: 1rem;
                    border-radius: 0.75rem;
                    width: 250px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                    z-index: 10;
                    pointer-events: none;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }
                .tooltip-custom::before {
                    content: '';
                    position: absolute;
                    right: 100%;
                    top: 50%;
                    transform: translateY(-50%);
                    border-width: 8px;
                    border-style: solid;
                    border-color: transparent hsl(var(--primary) / 0.3) transparent transparent;
                }
                .slider-container {
                    position: relative; /* Context for tooltip positioning if needed, though I used fixed width offset */
                }
                @media (max-width: 800px) {
                    .tooltip-custom {
                        left: 0;
                        top: 100%;
                        transform: none;
                        margin-left: 0;
                        margin-top: 0.5rem;
                        width: 100%;
                        position: relative;
                        z-index: 1;
                    }
                    .tooltip-custom::before {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}

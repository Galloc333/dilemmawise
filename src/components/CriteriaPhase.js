"use client";
import { useState } from 'react';

export default function CriteriaPhase({ criteria, onNext, onBack, savedWeights }) {
    // Use saved weights if provided, otherwise default to 3 (Medium)
    const [weights, setWeights] = useState(
        criteria.reduce((acc, c) => ({ ...acc, [c]: savedWeights?.[c] ?? 5 }), {})
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
        if (value <= 2) return 'Very Low';
        if (value <= 4) return 'Low';
        if (value <= 6) return 'Medium';
        if (value <= 8) return 'High';
        return 'Critical';
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
                                <span className="slider-value-label">
                                    {getImportanceLabel(weights[criterion])}
                                </span>
                            </div>

                            {/* Custom slider with value inside thumb */}
                            <div className="custom-slider-wrapper">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={weights[criterion]}
                                    onChange={(e) => handleWeightChange(criterion, e.target.value)}
                                    className="custom-slider"
                                />
                                <div
                                    className="slider-thumb-value"
                                    style={{ left: `calc(${(weights[criterion] - 1) / 9 * 100}% - ${(weights[criterion] - 1) / 9 * 36}px + 18px)` }}
                                >
                                    {weights[criterion]}
                                </div>
                            </div>

                            <div className="slider-scale">
                                <span>1 - Care very little</span>
                                <span>10 - Care a lot</span>
                            </div>

                            {/* Tooltip */}
                            {hoveredCriterion === criterion && explanations[criterion] && (
                                <div className="tooltip-custom animate-in">
                                    <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: 'hsl(var(--primary))' }}>
                                        How important is {criterion}?
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
                .slider-container {
                    position: relative;
                    margin-bottom: 1.5rem;
                    padding-bottom: 0.5rem;
                }
                .slider-label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .slider-value-label {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: hsl(var(--primary));
                }
                .custom-slider-wrapper {
                    position: relative;
                    padding: 10px 0;
                }
                .custom-slider {
                    width: 100%;
                    height: 8px;
                    -webkit-appearance: none;
                    appearance: none;
                    background: hsl(var(--muted));
                    border-radius: 4px;
                    outline: none;
                }
                .custom-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: hsl(var(--primary));
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                .custom-slider::-moz-range-thumb {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: hsl(var(--primary));
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                .slider-thumb-value {
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: white;
                    pointer-events: none;
                    z-index: 5;
                }
                .slider-scale {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.75rem;
                    color: hsl(var(--foreground) / 0.5);
                    margin-top: 0.25rem;
                }
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
                    width: 280px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                    z-index: 10;
                    pointer-events: none;
                    font-size: 0.9rem;
                    line-height: 1.5;
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

"use client";
import { useState } from 'react';
import InputPhase from '@/components/InputPhase';
import CriteriaPhase from '@/components/CriteriaPhase';
import RatingPhase from '@/components/RatingPhase';
import ElicitationPhase from '@/components/ElicitationPhase';
import ExplanationView from '@/components/ExplanationView';

export default function Home() {
    // Phases: input, criteria, rating, explanation, editOptions
    const [phase, setPhase] = useState('input');
    const [data, setData] = useState({
        options: [],
        criteria: []
    });
    const [weights, setWeights] = useState({});
    const [savedScores, setSavedScores] = useState(null);
    const [savedDescription, setSavedDescription] = useState('');
    const [results, setResults] = useState(null);
    const [useElicitation, setUseElicitation] = useState(true); // Toggle for elicitation vs manual rating

    const handleExtraction = (extractedData, description) => {
        setData(extractedData);
        if (description) setSavedDescription(description);
        setPhase('criteria');
    };

    const handleCriteriaComplete = (criteriaWeights) => {
        setWeights(criteriaWeights);
        setPhase('rating');
    };

    const handleAnalyze = ({ weights: w, scores }) => {
        // Deterministic WSM Algorithm
        const calculatedScores = data.options.map(opt => {
            let totalScore = 0;
            let totalWeight = 0;

            data.criteria.forEach(crit => {
                const weight = w[crit];
                const score = scores[opt][crit];
                totalScore += score * weight;
                totalWeight += weight;
            });

            return {
                option: opt,
                score: totalScore
            };
        });

        // Sort by score descending
        calculatedScores.sort((a, b) => b.score - a.score);

        // Save scores for potential re-editing
        setSavedScores(scores);

        setResults({
            ranking: calculatedScores,
            weights: w,
            scores
        });
        setPhase('explanation');
    };

    const handleReset = () => {
        setPhase('input');
        setData({ options: [], criteria: [] });
        setWeights({});
        setSavedScores(null);
        setSavedDescription('');
        setResults(null);
        setUseElicitation(true); // Reset to elicitation mode
    };

    const handleEditOptions = () => {
        setPhase('editOptions');
    };

    const handleEditComplete = (editedData) => {
        setData(editedData);
        // Reset weights for removed criteria
        const newWeights = {};
        editedData.criteria.forEach(crit => {
            if (weights[crit]) {
                newWeights[crit] = weights[crit];
            }
        });
        setWeights(newWeights);
        setPhase('criteria');
    };

    const getPhaseIndex = () => {
        const phases = ['input', 'criteria', 'rating', 'explanation'];
        return phases.indexOf(phase);
    };

    return (
        <main style={{ minHeight: '100vh', padding: '2rem', background: 'hsl(var(--background))' }}>
            <div className="container">
                {/* Progress Indicator */}
                {phase !== 'input' && phase !== 'editOptions' && (
                    <div className="progress-container">
                        {[0, 1, 2, 3].map((idx) => (
                            <div
                                key={idx}
                                className={`progress-step ${idx < getPhaseIndex() ? 'completed' : ''} ${idx === getPhaseIndex() ? 'active' : ''}`}
                            />
                        ))}
                    </div>
                )}

                {/* Header with Logo (except on input page) */}
                {phase !== 'input' && phase !== 'editOptions' && (
                    <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div className="logo" style={{ fontSize: '2rem' }}>DilemmaWise</div>
                    </header>
                )}

                {/* Phase Content */}
                {phase === 'input' && (
                    <InputPhase onNext={handleExtraction} savedDescription={savedDescription} />
                )}

                {phase === 'editOptions' && (
                    <InputPhase
                        onNext={(data) => handleEditComplete(data)}
                        savedDescription={savedDescription}
                        initialOptions={data.options}
                        initialCriteria={data.criteria}
                    />
                )}

                {phase === 'criteria' && (
                    <CriteriaPhase
                        criteria={data.criteria}
                        onNext={handleCriteriaComplete}
                        onBack={() => setPhase('input')}
                        savedWeights={weights}
                    />
                )}

                {phase === 'rating' && (
                    useElicitation ? (
                        <ElicitationPhase
                            options={data.options}
                            criteria={data.criteria}
                            weights={weights}
                            onAnalyze={handleAnalyze}
                            onBack={() => setPhase('criteria')}
                            onFallbackToManual={() => setUseElicitation(false)}
                        />
                    ) : (
                        <RatingPhase
                            options={data.options}
                            criteria={data.criteria}
                            weights={weights}
                            onAnalyze={handleAnalyze}
                            onBack={() => setPhase('criteria')}
                            savedScores={savedScores}
                        />
                    )
                )}

                {phase === 'explanation' && results && (
                    <ExplanationView
                        results={results}
                        onReset={handleReset}
                        onBackToRating={() => setPhase('rating')}
                        onEditOptions={handleEditOptions}
                    />
                )}
            </div>
        </main>
    );
}

"use client";
import { useState } from 'react';
import InputPhase from '@/components/InputPhase';
import CriteriaPhase from '@/components/CriteriaPhase';
import ElicitationPhase from '@/components/ElicitationPhase';
import ExplanationView from '@/components/ExplanationView';

export default function Home() {
    // Phases: input, criteria, rating, explanation, editOptions
    const [phase, setPhase] = useState('input');
    const [data, setData] = useState({
        options: [],
        criteria: [],
        userContext: {}
    });
    const [weights, setWeights] = useState({});
    const [savedScores, setSavedScores] = useState(null);
    const [dilemma, setDilemma] = useState('');
    const [savedDescription, setSavedDescription] = useState('');
    const [results, setResults] = useState(null);

    const handleExtraction = (extractedData, description, coreDilemma) => {
        setData(extractedData);
        if (description) setSavedDescription(description);
        if (coreDilemma) setDilemma(coreDilemma);
        setPhase('criteria');
    };

    const handleCriteriaComplete = (criteriaWeights) => {
        setWeights(criteriaWeights);
        setPhase('rating');
    };

    const handleAnalyze = ({ weights: w, scores, userContext: quickDetailsContext }) => {
        // Merge Quick Details context with existing userContext
        if (quickDetailsContext && Object.keys(quickDetailsContext).length > 0) {
            setData(prevData => ({
                ...prevData,
                userContext: {
                    ...prevData.userContext,
                    ...quickDetailsContext  // Quick Details takes precedence
                }
            }));
        }

        // Deterministic WSM Algorithm (Raw Weighted Sum)
        const calculatedScores = data.options.map(opt => {
            let weightedSum = 0;

            data.criteria.forEach(crit => {
                const weight = w[crit] || 1;
                const score = scores[opt][crit] || 0;
                weightedSum += score * weight;
            });

            return {
                option: opt,
                score: weightedSum
            };
        });

        // Sort by score descending
        calculatedScores.sort((a, b) => b.score - a.score);

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
        setData({ options: [], criteria: [], userContext: {} });
        setWeights({});
        setSavedScores(null);
        setSavedDescription('');
        setResults(null);
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
                    <ElicitationPhase
                        options={data.options}
                        criteria={data.criteria}
                        weights={weights}
                        savedDescription={savedDescription}
                        dilemma={dilemma}
                        userContext={data.userContext || {}}
                        onComplete={handleAnalyze}
                        onBack={() => setPhase('criteria')}
                    />
                )}

                {phase === 'explanation' && results && (
                    <ExplanationView
                        results={results}
                        userContext={data.userContext || {}}
                        dilemma={dilemma}
                        options={data.options}
                        criteria={data.criteria}
                        onReset={handleReset}
                        onBackToRating={() => setPhase('rating')}
                        onEditOptions={handleEditOptions}
                    />
                )}
            </div>
        </main>
    );
}

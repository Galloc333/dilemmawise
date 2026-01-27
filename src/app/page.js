'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import InputPhase from '@/components/InputPhase';
import CriteriaPhase from '@/components/CriteriaPhase';
import ElicitationPhase from '@/components/ElicitationPhase';
import ExplanationView from '@/components/ExplanationView';
import { LandingPage } from '@/components/LandingPage';
import { AppShell } from '@/components/AppShell';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

export default function Home() {
  // Phases: landing, input, criteria, rating, explanation, editOptions
  const [phase, setPhase] = useState('landing');
  const [data, setData] = useState({
    options: [],
    criteria: [],
    userContext: {},
  });
  const [weights, setWeights] = useState({});
  const [savedScores, setSavedScores] = useState(null);
  const [dilemma, setDilemma] = useState('');
  const [savedDescription, setSavedDescription] = useState('');
  const [results, setResults] = useState(null);

  const handleStartDecision = () => {
    setPhase('input');
  };

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
      setData((prevData) => ({
        ...prevData,
        userContext: {
          ...prevData.userContext,
          ...quickDetailsContext, // Quick Details takes precedence
        },
      }));
    }

    // Deterministic WSM Algorithm (Raw Weighted Sum)
    const calculatedScores = data.options.map((opt) => {
      let weightedSum = 0;

      data.criteria.forEach((crit) => {
        const weight = w[crit] || 1;
        const score = scores[opt][crit] || 0;
        weightedSum += score * weight;
      });

      return {
        option: opt,
        score: weightedSum,
      };
    });

    // Sort by score descending
    calculatedScores.sort((a, b) => b.score - a.score);

    setSavedScores(scores);
    setResults({
      ranking: calculatedScores,
      weights: w,
      scores,
    });
    setPhase('explanation');
  };

  const handleReset = () => {
    setPhase('landing');
    setData({ options: [], criteria: [], userContext: {} });
    setWeights({});
    setSavedScores(null);
    setSavedDescription('');
    setDilemma('');
    setResults(null);
  };

  const handleEditOptions = () => {
    setPhase('editOptions');
  };

  const handleEditComplete = (editedData) => {
    setData(editedData);
    // Reset weights for removed criteria
    const newWeights = {};
    editedData.criteria.forEach((crit) => {
      if (weights[crit]) {
        newWeights[crit] = weights[crit];
      }
    });
    setWeights(newWeights);
    setPhase('criteria');
  };

  // Show Landing Page
  if (phase === 'landing') {
    return <LandingPage onStartDecision={handleStartDecision} />;
  }

  // App flow wrapped in AppShell
  return (
    <AppShell currentPhase={phase} onStartOver={handleReset}>
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full"
        >
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
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

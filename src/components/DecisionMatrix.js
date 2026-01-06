"use client";
import { useState } from 'react';

export default function DecisionMatrix({ options, criteria, onAnalyze }) {
  const [weights, setWeights] = useState(
    criteria.reduce((acc, c) => ({ ...acc, [c]: 3 }), {})
  );
  
  const [scores, setScores] = useState(
    options.reduce((acc, opt) => ({
      ...acc,
      [opt]: criteria.reduce((cAcc, c) => ({ ...cAcc, [c]: 3 }), {})
    }), {})
  );

  const handleWeightChange = (criterion, value) => {
    setWeights(prev => ({ ...prev, [criterion]: parseInt(value) }));
  };

  const handleScoreChange = (option, criterion, value) => {
    setScores(prev => ({
      ...prev,
      [option]: { ...prev[option], [criterion]: parseInt(value) }
    }));
  };

  return (
    <div className="animate-in">
      <div className="card mb-8">
        <h2>1. Prioritize Criteria</h2>
        <p className="text-sm text-gray-500 mb-4">How important is each factor to you? (1 = Low, 5 = Critical)</p>
        <div className="grid gap-4">
          {criteria.map(c => (
            <div key={c} className="flex items-center gap-4">
              <label className="w-1/3 font-medium">{c}</label>
              <input 
                type="range" min="1" max="5" 
                value={weights[c]} 
                onChange={(e) => handleWeightChange(c, e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[hsl(var(--primary))]"
              />
              <span className="w-8 text-center font-bold text-[hsl(var(--primary))]">{weights[c]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-8">
        <h2>2. Rate Options</h2>
        <p className="text-sm text-gray-500 mb-4">How satisfied are you with each option? (1 = Poor, 5 = Excellent)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-2 border-b">Criteria</th>
                {options.map(opt => (
                  <th key={opt} className="p-2 border-b text-center">{opt}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map(c => (
                <tr key={c}>
                  <td className="p-2 border-b font-medium">{c}</td>
                  {options.map(opt => (
                    <td key={`${opt}-${c}`} className="p-2 border-b text-center">
                      <div className="flex flex-col items-center">
                        <input 
                          type="number" min="1" max="5" 
                          value={scores[opt][c]}
                          onChange={(e) => handleScoreChange(opt, c, e.target.value)}
                          className="w-16 p-1 border rounded text-center"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => onAnalyze({ weights, scores })}
          className="btn btn-primary text-lg px-8"
        >
          Analyze Decision &rarr;
        </button>
      </div>
    </div>
  );
}

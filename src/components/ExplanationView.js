"use client";
import { useState, useRef, useEffect } from 'react';

export default function ExplanationView({ results, onReset, onBackToRating, onEditOptions }) {
    const { scores, weights, ranking } = results;
    const topScore = ranking[0].score;

    // Detect ties: all options with the same top score
    const tiedWinners = ranking.filter(item => item.score === topScore);
    const hasTie = tiedWinners.length > 1;
    const winner = ranking[0]; // Still use first for API calls
    const maxScore = topScore;

    // Explanation state (from LLM)
    const [whyItWon, setWhyItWon] = useState('');
    const [whatCouldChange, setWhatCouldChange] = useState('');
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(true);

    // Chat state for Q&A
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    // Fetch explanations on mount
    useEffect(() => {
        const fetchExplanations = async () => {
            try {
                const response = await fetch('/api/explain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        winner,
                        ranking,
                        weights,
                        scores,
                        hasTie,
                        tiedWinners
                    })
                });
                const data = await response.json();
                setWhyItWon(data.whyItWon);
                setWhatCouldChange(data.whatCouldChange);
            } catch (error) {
                console.error('Explanation error:', error);
                // Fallback explanations
                if (hasTie) {
                    setWhyItWon(`${tiedWinners.map(w => w.option).join(' and ')} scored equally because they performed similarly on your weighted criteria.`);
                    setWhatCouldChange('To break the tie, consider adjusting your criteria weights or re-rating how well each option satisfies your priorities.');
                } else {
                    setWhyItWon(`${winner.option} ranked highest based on your weighted criteria priorities.`);
                    setWhatCouldChange('Try adjusting your criteria weights to see how results might change.');
                }
            } finally {
                setIsLoadingExplanation(false);
            }
        };
        fetchExplanations();
    }, []);

    const handleChatSubmit = async () => {
        if (!chatInput.trim() || isLoadingChat) return;

        const newMessages = [...chatMessages, { role: 'user', text: chatInput }];
        setChatMessages(newMessages);
        const userQuestion = chatInput;
        setChatInput('');
        setIsLoadingChat(true);

        try {
            const response = await fetch('/api/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: userQuestion,
                    context: { winner, ranking, weights, scores }
                })
            });
            const data = await response.json();
            setChatMessages(prev => [...prev, { role: 'assistant', text: data.answer }]);
        } catch (error) {
            console.error('Q&A error:', error);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                text: "I'm having trouble answering right now. Please try again."
            }]);
        } finally {
            setIsLoadingChat(false);
        }
    };


    return (
        <div className="animate-in">
            {/* Winner/Tie Announcement */}
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                {hasTie ? (
                    <>
                        <div className="winner-badge" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                            🤝 It's a Tie!
                        </div>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                            {tiedWinners.map(w => w.option).join(' & ')}
                        </h1>
                        <p style={{ fontSize: '1.2rem', color: 'hsl(var(--foreground) / 0.6)' }}>
                            These options scored equally at <strong>{topScore.toFixed(1)}</strong> points based on your priorities.
                        </p>
                        <p style={{ fontSize: '1rem', color: 'hsl(var(--foreground) / 0.5)', marginTop: '0.5rem' }}>
                            Consider adjusting your criteria weights or ratings to break the tie.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="winner-badge" style={{ marginBottom: '1rem' }}>
                            🏆 Top Recommendation
                        </div>
                        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{winner.option}</h1>
                        <p style={{ fontSize: '1.2rem', color: 'hsl(var(--foreground) / 0.6)' }}>
                            Based on your priorities, this option scored <strong>{winner.score.toFixed(1)}</strong> points.
                        </p>
                    </>
                )}
            </div>

            {/* Visual Score Comparison */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Score Comparison</h2>
                {ranking.map((item, idx) => {
                    const isTiedWinner = item.score === topScore;
                    const isSecondPlace = !isTiedWinner && idx === tiedWinners.length;
                    return (
                        <div key={item.option} className="score-bar-container">
                            <div className="score-bar-label">
                                {isTiedWinner && <span style={{ marginRight: '0.5rem' }}>{hasTie ? '🤝' : '🥇'}</span>}
                                {isSecondPlace && <span style={{ marginRight: '0.5rem' }}>🥈</span>}
                                {item.option}
                            </div>
                            <div className="score-bar-wrapper">
                                <div
                                    className="score-bar-fill"
                                    style={{
                                        width: `${(item.score / maxScore) * 100}%`,
                                        background: isTiedWinner
                                            ? hasTie
                                                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                                : 'linear-gradient(90deg, hsl(var(--primary)), #a855f7)'
                                            : 'hsl(var(--foreground) / 0.2)'
                                    }}
                                />
                                <span className="score-bar-value">{item.score.toFixed(1)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Insight Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="insight-card blue">
                    <h3>{hasTie ? '🤝 Why they tied' : '💡 Why it won'}</h3>
                    <p style={{ color: 'hsl(var(--foreground) / 0.8)', lineHeight: '1.7' }}>
                        {isLoadingExplanation ? 'Analyzing results...' : whyItWon}
                    </p>
                </div>

                <div className="insight-card purple">
                    <h3>🔄 What could change</h3>
                    <p style={{ color: 'hsl(var(--foreground) / 0.8)', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                        {isLoadingExplanation ? 'Calculating sensitivity...' : whatCouldChange}
                    </p>
                    <button
                        onClick={onBackToRating}
                        className="btn btn-secondary"
                        style={{
                            width: '100%',
                            fontSize: '0.875rem',
                            padding: '0.65rem 1rem',
                            background: 'transparent',
                            border: '1px solid hsl(var(--foreground) / 0.2)',
                            color: 'hsl(var(--foreground) / 0.8)',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'hsl(var(--foreground) / 0.05)';
                            e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.4)';
                            e.currentTarget.style.color = 'hsl(var(--primary))';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'hsl(var(--foreground) / 0.2)';
                            e.currentTarget.style.color = 'hsl(var(--foreground) / 0.8)';
                        }}
                        title="Go back to adjust your ratings"
                    >
                        <span style={{ fontSize: '1.1rem', marginRight: '0.4rem' }}>↻</span> Adjust My Ratings
                    </button>
                </div>
            </div>

            {/* Q&A Chat Section */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>💬 Ask Questions About Results</h3>
                    <button
                        onClick={() => setShowChat(!showChat)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.85rem' }}
                    >
                        {showChat ? 'Hide Chat' : 'Show Chat'}
                    </button>
                </div>

                {showChat && (
                    <div style={{ marginTop: '1rem' }}>
                        {chatMessages.length > 0 && (
                            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', padding: '0.5rem' }}>
                                {chatMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                            marginBottom: '0.75rem'
                                        }}
                                    >
                                        <div style={{
                                            maxWidth: '80%',
                                            padding: '0.75rem',
                                            borderRadius: '0.75rem',
                                            background: msg.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.05)',
                                            color: msg.role === 'user' ? 'white' : 'hsl(var(--foreground))',
                                            fontSize: '0.9rem'
                                        }}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                className="input"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                placeholder="Ask why this option won, or request more details..."
                                style={{ fontSize: '0.9rem' }}
                            />
                            <button
                                onClick={handleChatSubmit}
                                className="btn btn-primary"
                                title="Send question"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                    onClick={onEditOptions}
                    className="btn btn-secondary"
                    title="Review and edit your options and criteria"
                >
                    ✏️ Edit Options/Criteria
                </button>
                <button
                    onClick={onReset}
                    className="btn btn-secondary"
                    title="Start a completely new decision"
                >
                    🔄 Start New Decision
                </button>
            </div>
        </div>
    );
}

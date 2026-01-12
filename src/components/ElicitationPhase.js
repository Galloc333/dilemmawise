"use client";
import { useState, useRef, useEffect } from 'react';

export default function ElicitationPhase({ options, criteria, weights, onAnalyze, onBack, onFallbackToManual }) {
    // Conversation state
    const [conversation, setConversation] = useState([]);
    const [scores, setScores] = useState(() => {
        const initial = {};
        options.forEach(opt => {
            initial[opt] = {};
            criteria.forEach(crit => {
                initial[opt][crit] = 3; // Default neutral
            });
        });
        return initial;
    });
    const [confidence, setConfidence] = useState(() => {
        const initial = {};
        options.forEach(opt => {
            initial[opt] = {};
            criteria.forEach(crit => {
                initial[opt][crit] = "low";
            });
        });
        return initial;
    });
    const [evidence, setEvidence] = useState(() => {
        const initial = {};
        options.forEach(opt => {
            initial[opt] = {};
            criteria.forEach(crit => {
                initial[opt][crit] = "";
            });
        });
        return initial;
    });
    const [isFinished, setIsFinished] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [showDebugScores, setShowDebugScores] = useState(false);
    const messagesEndRef = useRef(null);

    // Calculate progress
    const getProgress = () => {
        let total = 0;
        let highConfidence = 0;
        options.forEach(opt => {
            criteria.forEach(crit => {
                total++;
                if (confidence[opt]?.[crit] === "high" || confidence[opt]?.[crit] === "medium") {
                    highConfidence++;
                }
            });
        });
        return { total, highConfidence, percentage: Math.round((highConfidence / total) * 100) };
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conversation]);

    // Start the conversation
    useEffect(() => {
        if (conversation.length === 0) {
            startConversation();
        }
    }, []);

    const startConversation = async () => {
        setIsTyping(true);
        try {
            const response = await fetch('/api/elicitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    options,
                    criteria,
                    conversation: [],
                    currentScores: scores,
                    currentEvidence: evidence
                })
            });
            const data = await response.json();

            setConversation([{
                role: 'assistant',
                text: data.response || data.next_question
            }]);

            if (data.scores) setScores(data.scores);
            if (data.confidence) setConfidence(data.confidence);
            if (data.evidence) setEvidence(data.evidence);
            if (data.is_finished) setIsFinished(true);
        } catch (error) {
            console.error("Failed to start elicitation:", error);
            setConversation([{
                role: 'assistant',
                text: `Let's talk about your decision. You're comparing ${options.join(" and ")}. What matters most to you right now?`
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim() || isTyping) return;

        const userMessage = { role: 'user', text: chatInput };
        const newConversation = [...conversation, userMessage];
        setConversation(newConversation);
        setChatInput('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/elicitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    options,
                    criteria,
                    conversation: newConversation,
                    currentScores: scores,
                    currentEvidence: evidence
                })
            });
            const data = await response.json();

            setConversation(prev => [...prev, {
                role: 'assistant',
                text: data.response || data.next_question
            }]);

            if (data.scores) setScores(data.scores);
            if (data.confidence) setConfidence(data.confidence);
            if (data.evidence) setEvidence(data.evidence);
            if (data.is_finished) setIsFinished(true);
        } catch (error) {
            console.error("Elicitation error:", error);
            setConversation(prev => [...prev, {
                role: 'assistant',
                text: "I had trouble processing that. Could you rephrase?"
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleFinalize = () => {
        onAnalyze({ weights, scores });
    };

    const progress = getProgress();

    const getConfidenceColor = (level) => {
        switch (level) {
            case 'high': return 'hsl(142 71% 45%)';
            case 'medium': return 'hsl(45 93% 47%)';
            default: return 'hsl(0 0% 60%)';
        }
    };

    return (
        <div className="animate-in" style={{ maxWidth: '1200px', margin: '0 auto', height: 'calc(100vh - 8rem)', minHeight: '500px' }}>
            <div className="phase-header" style={{ marginBottom: '1rem' }}>
                <h1>Let's Understand Your Preferences</h1>
                <p>Tell me about your options in your own words. I'll help extract the key insights.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem', height: 'calc(100% - 100px)' }}>
                {/* Chat Area */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                    {/* Progress Bar */}
                    <div style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--muted))'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Understanding Progress</span>
                            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground) / 0.6)' }}>{progress.percentage}%</span>
                        </div>
                        <div style={{
                            height: '6px',
                            background: 'hsl(var(--border))',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progress.percentage}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, hsl(var(--primary)), #a855f7)',
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {conversation.map((msg, idx) => (
                            <div key={idx} className={`chat-message ${msg.role}`}>
                                <div className="message-bubble">
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="chat-message assistant">
                                <div className="message-bubble typing-indicator">
                                    <span>•</span><span>•</span><span>•</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div style={{ padding: '1rem', borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
                        {isFinished ? (
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ marginBottom: '1rem', color: 'hsl(142 71% 45%)' }}>
                                    ✓ I think I understand your preferences well now!
                                </p>
                                <button onClick={handleFinalize} className="btn btn-primary btn-lg">
                                    🎯 Analyze Decision
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <input
                                    type="text"
                                    className="input"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                    placeholder="Share your thoughts..."
                                    style={{ flex: 1 }}
                                    disabled={isTyping}
                                    autoFocus
                                />
                                <button
                                    onClick={handleChatSubmit}
                                    className="btn btn-primary"
                                    disabled={!chatInput.trim() || isTyping}
                                >
                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>↑</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Score Matrix & Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Criteria Progress */}
                    <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>📊 Criteria Coverage</h3>
                            <button
                                onClick={() => setShowDebugScores(!showDebugScores)}
                                style={{
                                    fontSize: '0.75rem',
                                    background: 'none',
                                    border: 'none',
                                    color: 'hsl(var(--foreground) / 0.5)',
                                    cursor: 'pointer'
                                }}
                            >
                                {showDebugScores ? 'Hide Scores' : 'Show Scores'}
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {criteria.map(crit => {
                                const criterionConfidences = options.map(opt => confidence[opt]?.[crit] || 'low');
                                const hasHigh = criterionConfidences.some(c => c === 'high');
                                const hasMedium = criterionConfidences.some(c => c === 'medium');
                                const status = hasHigh ? 'high' : hasMedium ? 'medium' : 'low';

                                return (
                                    <div key={crit} style={{
                                        padding: '0.75rem',
                                        marginBottom: '0.5rem',
                                        borderRadius: '0.5rem',
                                        background: 'hsl(var(--muted))',
                                        border: `1px solid ${getConfidenceColor(status)}33`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{crit}</span>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '999px',
                                                background: `${getConfidenceColor(status)}22`,
                                                color: getConfidenceColor(status),
                                                fontWeight: '600',
                                                textTransform: 'uppercase'
                                            }}>
                                                {status}
                                            </span>
                                        </div>

                                        {showDebugScores && (
                                            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                {options.map(opt => (
                                                    <div key={opt} style={{
                                                        fontSize: '0.75rem',
                                                        padding: '0.3rem 0.5rem',
                                                        background: 'hsl(var(--background))',
                                                        borderRadius: '0.25rem'
                                                    }}>
                                                        <strong>{opt}:</strong> {scores[opt]?.[crit] ?? '?'}
                                                        {evidence[opt]?.[crit] && (
                                                            <span style={{ opacity: 0.7, marginLeft: '0.5rem', fontStyle: 'italic' }}>
                                                                — {evidence[opt][crit]}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="card" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button onClick={onBack} className="btn btn-secondary" style={{ width: '100%' }}>
                                ← Back to Criteria
                            </button>
                            <button
                                onClick={onFallbackToManual}
                                className="btn"
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: '1px solid hsl(var(--border))',
                                    color: 'hsl(var(--foreground) / 0.7)',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Skip to Manual Rating →
                            </button>
                            {progress.percentage >= 50 && !isFinished && (
                                <button
                                    onClick={handleFinalize}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                >
                                    🎯 Analyze Now ({progress.percentage}% confident)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .chat-message {
                    display: flex;
                    margin-bottom: 0.25rem;
                }
                .chat-message.user {
                    justify-content: flex-end;
                }
                .chat-message.assistant {
                    justify-content: flex-start;
                }
                .message-bubble {
                    max-width: 85%;
                    padding: 0.85rem 1.15rem;
                    border-radius: 1.25rem;
                    font-size: 0.95rem;
                    line-height: 1.5;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    white-space: pre-wrap;
                }
                .user .message-bubble {
                    background: hsl(var(--primary));
                    color: white;
                    border-bottom-right-radius: 0.25rem;
                }
                .assistant .message-bubble {
                    background: hsl(var(--card));
                    border: 1px solid hsl(var(--border));
                    color: hsl(var(--foreground));
                    border-bottom-left-radius: 0.25rem;
                }
                .typing-indicator span {
                    animation: blink 1.4s infinite both;
                    margin: 0 1px;
                    font-size: 1.5rem;
                    line-height: 0.5rem;
                }
                .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes blink {
                    0% { opacity: 0.2; }
                    20% { opacity: 1; }
                    100% { opacity: 0.2; }
                }
            `}</style>
        </div>
    );
}

"use client";
<<<<<<< HEAD
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function ElicitationPhase({ options, criteria, weights, onComplete, onBack, savedDescription }) {
    const [stage, setStage] = useState('intro'); // intro, context, questions, complete
    const [context, setContext] = useState({});
    const [contextAnalysis, setContextAnalysis] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [responses, setResponses] = useState([]);
    const [budget, setBudget] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentResponse, setCurrentResponse] = useState('');
    const [inferredRatings, setInferredRatings] = useState(null);
    const [showWebFacts, setShowWebFacts] = useState(false);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [responses, currentQuestionIndex]);

    const analyzeContextNeeds = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/elicit-ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'analyze_context',
                    options,
                    criteria,
                    description: savedDescription
                })
            });

            const data = await res.json();

            // Auto-fill context that the AI extracted from description
            if (data.already_known_context) {
                setContext(prev => ({ ...prev, ...data.already_known_context }));
            }

            setContextAnalysis(data);
            return data;
        } catch (error) {
            console.error('Failed to analyze context:', error);
        } finally {
            setLoading(false);
        }
    };

    const startElicitation = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/elicit-ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'generate_questions',
                    options,
                    criteria,
                    weights,
                    context
                })
            });

            const data = await res.json();
            setQuestions(data.questions || []);
            setBudget(data.budget || 0);
            setStage('questions');
        } catch (error) {
            console.error('Failed to generate questions:', error);
            alert('Failed to start elicitation. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleIntroNext = async () => {
        const analysis = await analyzeContextNeeds();
        if (analysis && !analysis.needs_more_context) {
            setStage('generating');
            startElicitation();
        } else {
            setStage('context');
        }
    };

    const handleContextSubmit = () => {
        setStage('generating');
        startElicitation();
    };

    const handleResponseSubmit = () => {
        if (!currentResponse.trim()) return;

        const newResponses = [...responses, {
            questionId: questions[currentQuestionIndex].id,
            question: questions[currentQuestionIndex].text,
            answer: currentResponse,
            relates_to: questions[currentQuestionIndex].relates_to
        }];

        setResponses(newResponses);
        setCurrentResponse('');

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            // All questions answered, infer ratings
            inferRatings(newResponses);
        }
    };

    const inferRatings = async (allResponses) => {
        setLoading(true);
        try {
            const res = await fetch('/api/elicit-ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'infer_ratings',
                    options,
                    criteria,
                    responses: allResponses
                })
            });

            const data = await res.json();
            setInferredRatings(data);
            setStage('complete');
        } catch (error) {
            console.error('Failed to infer ratings:', error);
            alert('Failed to process your responses. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = () => {
        onComplete({ weights, scores: inferredRatings.ratings });
    };

    // Helper to render clickable sources in question text if any exist there
    const renderTextWithSources = (text, sources) => {
        if (!sources || sources.length === 0) return text;

        // Replace [source] placeholders with actual links
        let renderedText = text;
        sources.forEach((source, idx) => {
            const placeholder = '[source]';
            if (renderedText.includes(placeholder)) {
                renderedText = renderedText.replace(
                    placeholder,
                    `<a href="${source.url}" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: underline;">[${source.title || 'source'}]</a>`
                );
            }
        });

        return <span dangerouslySetInnerHTML={{ __html: renderedText }} />;
    };

    if (stage === 'intro') {
        return (
            <div className="animate-in">
                <div className="phase-header">
                    <h1>Let's Understand Your Preferences</h1>
                    <p>I'll ask you a few targeted questions to understand how each option meets your needs.</p>
                </div>

                <div style={{ maxWidth: '700px', margin: '2rem auto' }}>
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>How it works</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: '700',
                                    flexShrink: 0
                                }}>1</div>
                                <div>
                                    <strong>Natural conversation</strong>
                                    <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                                        I'll ask conversational questions, not boring forms
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: '700',
                                    flexShrink: 0
                                }}>2</div>
                                <div>
                                    <strong>Just {Math.floor(1.5 * criteria.length * options.length)} questions max</strong>
                                    <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                                        Short and focused - no tedious forms
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'start' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: '700',
                                    flexShrink: 0
                                }}>3</div>
                                <div>
                                    <strong>AI infers your preferences</strong>
                                    <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                                        From your answers, I'll understand how each option meets each criterion
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
                        <button onClick={onBack} className="btn btn-secondary">
                            ← Back to Criteria
                        </button>
                        <button
                            onClick={handleIntroNext}
                            className="btn btn-primary btn-lg"
                            disabled={loading}
                        >
                            {loading ? 'Analyzing...' : "Let's Begin →"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (stage === 'context') {
        const questions = contextAnalysis?.questions || [];

        return (
            <div className="animate-in">
                <div className="phase-header">
                    <h1>Just a Few Quick Details</h1>
                    <p>To give you the best comparison possible, I'd like to understand a bit more about your situation.</p>
                </div>

                <div style={{ maxWidth: '600px', margin: '2rem auto' }}>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {questions.length > 0 ? (
                            questions.map((q, idx) => (
                                <div key={idx}>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '1rem' }}>
                                        {q.question}
                                    </label>
                                    {q.reason && (
                                        <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '0.5rem' }}>
                                            {q.reason}
                                        </p>
                                    )}
                                    <input
                                        type="text"
                                        placeholder="Type your answer..."
                                        value={context[q.field] || ''}
                                        onChange={(e) => setContext({ ...context, [q.field]: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '0.5rem',
                                            fontSize: '1rem',
                                            background: 'hsl(var(--background))'
                                        }}
                                    />
                                </div>
                            ))
                        ) : (
                            <p style={{ textAlign: 'center', opacity: 0.7 }}>No specific details needed! Click continue to start.</p>
                        )}

                        <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem', opacity: 0.8 }}>
                                Anything else I should know? (Optional)
                            </label>
                            <textarea
                                placeholder="e.g., I have a car, I work remotely 2 days/week..."
                                value={context.notes || ''}
                                onChange={(e) => setContext({ ...context, notes: e.target.value })}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.95rem',
                                    resize: 'vertical',
                                    background: 'hsl(var(--background))'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
                        <button onClick={() => setStage('intro')} className="btn btn-secondary">
                            ← Back
                        </button>
                        <button onClick={handleContextSubmit} className="btn btn-primary btn-lg">
                            Continue →
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (stage === 'generating') {
        return (
            <div className="animate-in" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                <h2>Preparing your questions...</h2>
                <p style={{ opacity: 0.7 }}>This will just take a moment</p>
            </div>
        );
    }

    if (stage === 'questions') {
        const currentQuestion = questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

        return (
            <div className="animate-in">
                <div className="phase-header">
                    <h1>Conversation</h1>
                    <p>Question {currentQuestionIndex + 1} of {questions.length}</p>
                </div>

                {/* Progress bar */}
                <div style={{ maxWidth: '800px', margin: '0 auto 2rem' }}>
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'hsl(var(--border))',
                        borderRadius: '3px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, hsl(var(--primary)), #a855f7)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>

                {/* Chat interface */}
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div className="card" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                        {/* Previous Q&A */}
                        <div style={{ flex: 1, marginBottom: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                            {responses.map((resp, idx) => (
                                <div key={idx} style={{ marginBottom: '1.5rem', opacity: 0.6 }}>
                                    <div style={{
                                        background: 'hsl(var(--primary) / 0.1)',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '1rem 1rem 1rem 0.25rem',
                                        marginBottom: '0.5rem'
                                    }}>
                                        <strong>Q{idx + 1}:</strong> <span dangerouslySetInnerHTML={{ __html: resp.question }} />
                                    </div>
                                    <div style={{
                                        background: 'hsl(var(--muted))',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '1rem 1rem 0.25rem 1rem',
                                        marginLeft: '2rem'
                                    }} className="md-content">
                                        <ReactMarkdown components={{
                                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                                        }}>{resp.answer}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}

                            {/* Current Question */}
                            {currentQuestion && (
                                <>
                                    <div style={{
                                        background: 'hsl(var(--primary) / 0.1)',
                                        padding: '1rem 1.25rem',
                                        borderRadius: '1rem 1rem 1rem 0.25rem',
                                        marginBottom: '0.5rem',
                                        border: '2px solid hsl(var(--primary) / 0.3)',
                                        position: 'relative'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <strong>Q{currentQuestionIndex + 1}:</strong> {currentQuestion.text}
                                            </div>
                                            {currentQuestion.webFacts && (
                                                <button
                                                    onClick={() => setShowWebFacts(!showWebFacts)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '1.3rem',
                                                        flexShrink: 0,
                                                        marginTop: '0.1rem',
                                                        padding: 0,
                                                        opacity: showWebFacts ? 1 : 0.7,
                                                        transition: 'opacity 0.2s'
                                                    }}
                                                    title={showWebFacts ? "Hide web facts" : "Show web facts"}
                                                >
                                                    <span style={{ filter: 'grayscale(0%)' }}>ℹ️</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Inline Web Facts Display */}
                                        {showWebFacts && currentQuestion.webFacts && (
                                            <div className="animate-in fade-in slide-in-from-top-2" style={{
                                                marginTop: '1rem',
                                                padding: '1rem',
                                                background: 'hsl(var(--background))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.9rem',
                                                lineHeight: '1.5'
                                            }}>
                                                <div style={{
                                                    fontWeight: '600',
                                                    marginBottom: '0.5rem',
                                                    color: 'hsl(var(--primary))',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    📚 Web Facts
                                                </div>
                                                <div style={{ marginBottom: '0.75rem' }}>
                                                    {currentQuestion.webFacts.summary.includes('\n') || currentQuestion.webFacts.summary.includes('- ') ? (
                                                        <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyleType: 'disc' }}>
                                                            {currentQuestion.webFacts.summary
                                                                .split('\n')
                                                                .filter(line => line.trim())
                                                                .map((line, i) => (
                                                                    <li key={i} style={{ marginBottom: '0.4rem' }}>
                                                                        {line.replace(/^-\s*/, '').trim()}
                                                                    </li>
                                                                ))
                                                            }
                                                        </ul>
                                                    ) : (
                                                        currentQuestion.webFacts.summary
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                                                    <strong>Sources:</strong>
                                                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                                                        {currentQuestion.webFacts.sources.map((source, idx) => (
                                                            <li key={idx} style={{ marginBottom: '0.25rem' }}>
                                                                <a
                                                                    href={source.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}
                                                                >
                                                                    {source.title || source.url}
                                                                </a>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div style={{
                                                    marginTop: '0.75rem',
                                                    padding: '0.5rem',
                                                    background: 'hsl(var(--muted))',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    fontStyle: 'italic',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    <span>💡</span>
                                                    This info is for your reference only. Your answer determines the rating.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input area */}
                        <div>
                            <textarea
                                value={currentResponse}
                                onChange={(e) => setCurrentResponse(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleResponseSubmit();
                                    }
                                }}
                                placeholder="Type your response here... (Press Enter to submit)"
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    resize: 'vertical',
                                    marginBottom: '0.75rem'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={handleResponseSubmit}
                                    disabled={!currentResponse.trim()}
                                    className="btn btn-primary"
                                >
                                    Submit Response →
                                </button>
                            </div>
=======
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
>>>>>>> 75aee426769b51149a9bfef8fb3bc7e2d56af9f9
                        </div>
                    </div>
                </div>
            </div>
<<<<<<< HEAD
        );
    }

    if (stage === 'complete') {
        return (
            <div className="animate-in">
                <div className="phase-header">
                    <h1>✨ Analysis Complete</h1>
                    <p>Based on your responses, here's what I understood about your preferences</p>
                </div>

                <div style={{ maxWidth: '900px', margin: '2rem auto' }}>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Inferred Ratings</h3>
                        <p style={{ opacity: 0.8, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                            {inferredRatings?.reasoning}
                        </p>
                        <div style={{
                            padding: '1rem',
                            background: 'hsl(var(--muted))',
                            borderRadius: '0.5rem',
                            fontSize: '0.9rem'
                        }}>
                            <strong>Confidence:</strong> {Math.round((inferredRatings?.confidence || 0) * 100)}%
                        </div>
                    </div>

                    {/* Rating Matrix Preview */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>Rating Matrix</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>
                                            Option
                                        </th>
                                        {criteria.map(crit => (
                                            <th key={crit} style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '2px solid hsl(var(--border))' }}>
                                                {crit}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {options.map(opt => (
                                        <tr key={opt}>
                                            <td style={{ padding: '0.75rem', fontWeight: '600', borderBottom: '1px solid hsl(var(--border))' }}>
                                                {opt}
                                            </td>
                                            {criteria.map(crit => {
                                                const rating = inferredRatings?.ratings?.[opt]?.[crit] || 3;
                                                const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
                                                return (
                                                    <td key={crit} style={{
                                                        textAlign: 'center',
                                                        padding: '0.75rem',
                                                        borderBottom: '1px solid hsl(var(--border))'
                                                    }}>
                                                        <div style={{
                                                            display: 'inline-block',
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '0.5rem',
                                                            background: `hsl(var(--primary) / ${rating * 0.15})`,
                                                            fontSize: '0.85rem'
                                                        }}>
                                                            {labels[rating - 1]}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <button
                            onClick={handleComplete}
                            className="btn btn-primary btn-lg"
                        >
                            🎯 Analyze Decision
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
=======

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
>>>>>>> 75aee426769b51149a9bfef8fb3bc7e2d56af9f9
}

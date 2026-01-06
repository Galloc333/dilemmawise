"use client";
import { useState, useRef, useEffect } from 'react';

export default function InputPhase({ onNext, savedDescription }) {
    const [description, setDescription] = useState(savedDescription || '');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Smart Elicitation State
    const [chatMode, setChatMode] = useState(false);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [suggestions, setSuggestions] = useState(null);
    const [removedItems, setRemovedItems] = useState({ options: [], criteria: [] });
    const messagesEndRef = useRef(null);

    // Verification Mode State (for happy path)
    const [verificationMode, setVerificationMode] = useState(false);
    const [extractedOptions, setExtractedOptions] = useState([]);
    const [extractedCriteria, setExtractedCriteria] = useState([]);
    const [selectedOptions, setSelectedOptions] = useState({});
    const [selectedCriteria, setSelectedCriteria] = useState({});

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const analyzeInput = async () => {
        setIsAnalyzing(true);

        try {
            const response = await fetch('/api/analyze-input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description })
            });

            const data = await response.json();

            if (data.error || data.isVague || !data.options || data.options.length < 2) {
                // Need more info: Switch to Chat Mode
                setChatMode(true);
                setMessages([
                    { role: 'assistant', text: "I see you're thinking about a decision, but I need a bit more detail to help structure it. What specific options are you considering? For example, are you choosing between 'Option A vs Option B'?" }
                ]);
            } else {
                // Happy Path: Got enough info - show verification
                setExtractedOptions(data.options);
                setExtractedCriteria(data.criteria || []);
                // Initialize all as selected
                setSelectedOptions(data.options.reduce((acc, opt) => ({ ...acc, [opt]: true }), {}));
                setSelectedCriteria((data.criteria || []).reduce((acc, crit) => ({ ...acc, [crit]: true }), {}));
                setVerificationMode(true);
            }
        } catch (error) {
            console.error("Analysis error:", error);
            // Fallback to chat mode on error
            setChatMode(true);
            setMessages([
                { role: 'assistant', text: "I'd like to understand your decision better. What are the main options you're considering?" }
            ]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;

        const newMessages = [...messages, { role: 'user', text: chatInput }];
        setMessages(newMessages);
        const userInput = chatInput;
        setChatInput('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    currentOptions: suggestions?.options || [],
                    currentCriteria: suggestions?.criteria || []
                })
            });

            const data = await response.json();

            // Add assistant response
            setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);

            // If LLM suggested new options/criteria, or if we don't have suggestions yet, try to extract
            if (!suggestions && newMessages.length >= 3) {
                // After a few exchanges, try to extract options/criteria from the conversation
                const extractResponse = await fetch('/api/analyze-input', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: newMessages.map(m => m.text).join(' ')
                    })
                });
                const extractData = await extractResponse.json();

                if (extractData.options?.length >= 2) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        text: "Based on our conversation, here's what I've identified:"
                    }]);
                    setSuggestions({
                        options: extractData.options,
                        criteria: extractData.criteria
                    });
                }
            } else if (suggestions && data.suggestedOptions?.length > 0) {
                // Add any newly suggested options
                setSuggestions(prev => ({
                    ...prev,
                    options: [...new Set([...prev.options, ...data.suggestedOptions])]
                }));
            } else if (suggestions && data.suggestedCriteria?.length > 0) {
                // Add any newly suggested criteria
                setSuggestions(prev => ({
                    ...prev,
                    criteria: [...new Set([...prev.criteria, ...data.suggestedCriteria])]
                }));
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: "I'm having trouble connecting. Could you try again?"
            }]);
        }
    };

    const removeOption = (optionToRemove) => {
        setSuggestions(prev => ({
            ...prev,
            options: prev.options.filter(opt => opt !== optionToRemove)
        }));
        setRemovedItems(prev => ({
            ...prev,
            options: [...prev.options, optionToRemove]
        }));
    };

    const removeCriterion = (criterionToRemove) => {
        setSuggestions(prev => ({
            ...prev,
            criteria: prev.criteria.filter(crit => crit !== criterionToRemove)
        }));
        setRemovedItems(prev => ({
            ...prev,
            criteria: [...prev.criteria, criterionToRemove]
        }));
    };

    const restoreOption = (optionToRestore) => {
        setSuggestions(prev => ({
            ...prev,
            options: [...prev.options, optionToRestore]
        }));
        setRemovedItems(prev => ({
            ...prev,
            options: prev.options.filter(opt => opt !== optionToRestore)
        }));
    };

    const restoreCriterion = (criterionToRestore) => {
        setSuggestions(prev => ({
            ...prev,
            criteria: [...prev.criteria, criterionToRestore]
        }));
        setRemovedItems(prev => ({
            ...prev,
            criteria: prev.criteria.filter(crit => crit !== criterionToRestore)
        }));
    };

    const restartChat = () => {
        const confirmed = window.confirm(
            "Are you sure you want to start over?\n\nThis will clear the entire conversation and all extracted options/criteria. You'll need to describe your dilemma again from scratch."
        );

        if (confirmed) {
            setChatMode(false);
            setMessages([]);
            setSuggestions(null);
            setRemovedItems({ options: [], criteria: [] });
            setDescription('');
        }
    };

    return (
        <div className="animate-in">
            {/* Large Logo */}
            <div className="logo logo-large">DilemmaWise</div>

            {!chatMode && !verificationMode ? (
                <>
                    {/* Welcome Message */}
                    <p className="welcome-message">
                        Feeling stuck on a big decision? DilemmaWise uses AI to help you structure your thoughts,
                        weigh your priorities, and discover which option truly fits you best.
                    </p>

                    {/* Main Input Area */}
                    <div className="max-w-2xl mx-auto">
                        <div className="card">
                            <h2 style={{ marginBottom: '1rem' }}>Describe your dilemma</h2>
                            <textarea
                                className="textarea-premium"
                                placeholder="e.g., I'm trying to decide between two job offers. One is at an exciting startup with equity but lower pay, and the other is a stable corporate role with great benefits but less growth potential..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <button
                                onClick={analyzeInput}
                                disabled={!description.trim() || isAnalyzing}
                                className="btn btn-primary btn-lg"
                                style={{
                                    opacity: (!description.trim() || isAnalyzing) ? 0.5 : 1,
                                    cursor: (!description.trim() || isAnalyzing) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isAnalyzing ? (
                                    <>
                                        <span style={{ marginRight: '0.5rem' }}>✨</span>
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        Let's Structure This
                                        <span style={{ marginLeft: '0.5rem' }}>→</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            ) : verificationMode ? (
                /* Verification Mode - Review Extracted Items */
                <div className="max-w-2xl mx-auto">
                    <p className="welcome-message" style={{ marginBottom: '2rem' }}>
                        I've analyzed your dilemma. Here's what I found — toggle items on or off to customize your decision framework.
                    </p>

                    {/* Options Section */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>🎯</span> Your Options
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {extractedOptions.map((option) => (
                                <div
                                    key={option}
                                    onClick={() => setSelectedOptions(prev => ({ ...prev, [option]: !prev[option] }))}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1rem 1.25rem',
                                        borderRadius: '12px',
                                        background: selectedOptions[option]
                                            ? 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(280 70% 60% / 0.1))'
                                            : 'hsl(var(--foreground) / 0.05)',
                                        border: selectedOptions[option]
                                            ? '2px solid hsl(var(--primary) / 0.5)'
                                            : '2px solid transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        opacity: selectedOptions[option] ? 1 : 0.5
                                    }}
                                >
                                    <span style={{ fontWeight: '500' }}>{option}</span>
                                    <div style={{
                                        width: '44px',
                                        height: '24px',
                                        borderRadius: '12px',
                                        background: selectedOptions[option]
                                            ? 'linear-gradient(90deg, hsl(var(--primary)), #a855f7)'
                                            : 'hsl(var(--foreground) / 0.2)',
                                        position: 'relative',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: 'white',
                                            position: 'absolute',
                                            top: '3px',
                                            left: selectedOptions[option] ? '23px' : '3px',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Criteria Section */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>⚖️</span> Criteria to Consider
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {extractedCriteria.map((criterion) => (
                                <div
                                    key={criterion}
                                    onClick={() => setSelectedCriteria(prev => ({ ...prev, [criterion]: !prev[criterion] }))}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '20px',
                                        background: selectedCriteria[criterion]
                                            ? 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(280 70% 60% / 0.1))'
                                            : 'hsl(var(--foreground) / 0.05)',
                                        border: selectedCriteria[criterion]
                                            ? '2px solid hsl(var(--primary) / 0.5)'
                                            : '2px solid transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        opacity: selectedCriteria[criterion] ? 1 : 0.5
                                    }}
                                >
                                    <span style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: selectedCriteria[criterion]
                                            ? 'linear-gradient(90deg, hsl(var(--primary)), #a855f7)'
                                            : 'hsl(var(--foreground) / 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '0.75rem'
                                    }}>
                                        {selectedCriteria[criterion] && '✓'}
                                    </span>
                                    <span style={{ fontWeight: '500' }}>{criterion}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                        <button
                            onClick={() => {
                                setVerificationMode(false);
                                setExtractedOptions([]);
                                setExtractedCriteria([]);
                            }}
                            className="btn btn-secondary"
                        >
                            ← Edit Description
                        </button>
                        <button
                            onClick={() => {
                                const finalOptions = extractedOptions.filter(opt => selectedOptions[opt]);
                                const finalCriteria = extractedCriteria.filter(crit => selectedCriteria[crit]);
                                onNext({ options: finalOptions, criteria: finalCriteria }, description);
                            }}
                            className="btn btn-primary btn-lg"
                            disabled={Object.values(selectedOptions).filter(Boolean).length < 2 || Object.values(selectedCriteria).filter(Boolean).length < 1}
                            title={Object.values(selectedOptions).filter(Boolean).length < 2
                                ? "Please select at least 2 options"
                                : Object.values(selectedCriteria).filter(Boolean).length < 1
                                    ? "Please select at least 1 criterion"
                                    : "Proceed to prioritization"}
                        >
                            Continue to Prioritization →
                        </button>
                    </div>
                </div>
            ) : (
                /* Chat Interface */
                <div className="max-w-2xl mx-auto">
                    <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        marginBottom: '1rem'
                                    }}
                                >
                                    <div style={{
                                        maxWidth: '80%',
                                        padding: '1rem',
                                        borderRadius: '1rem',
                                        background: msg.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--background))',
                                        color: msg.role === 'user' ? 'white' : 'hsl(var(--foreground))',
                                        borderBottomRightRadius: msg.role === 'user' ? '0.25rem' : '1rem',
                                        borderBottomLeftRadius: msg.role === 'assistant' ? '0.25rem' : '1rem'
                                    }}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}

                            {/* Suggestion Approval UI */}
                            {suggestions && (
                                <div className="fade-in" style={{ marginTop: '1rem', padding: '1.5rem', background: 'hsl(var(--card))', borderRadius: '1rem', border: '1px solid hsl(var(--border))' }}>
                                    <h4 style={{ marginBottom: '1rem', fontWeight: '600', fontSize: '1.1rem' }}>Review and edit these elements:</h4>

                                    {/* Options Chips */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem', color: 'hsl(var(--foreground) / 0.7)' }}>Options:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {suggestions.options.map((option, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        padding: '0.5rem 0.75rem',
                                                        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(270 83% 53% / 0.1))',
                                                        border: '1px solid hsl(var(--primary) / 0.3)',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: '500'
                                                    }}
                                                >
                                                    <span>{option}</span>
                                                    <button
                                                        onClick={() => removeOption(option)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '0',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '50%',
                                                            color: 'hsl(var(--foreground) / 0.6)',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'hsl(var(--foreground) / 0.1)';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground))';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'none';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground) / 0.6)';
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Criteria Chips */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem', color: 'hsl(var(--foreground) / 0.7)' }}>Criteria:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {suggestions.criteria.map((criterion, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        padding: '0.5rem 0.75rem',
                                                        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(270 83% 53% / 0.1))',
                                                        border: '1px solid hsl(var(--primary) / 0.3)',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: '500'
                                                    }}
                                                >
                                                    <span>{criterion}</span>
                                                    <button
                                                        onClick={() => removeCriterion(criterion)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: '0',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '50%',
                                                            color: 'hsl(var(--foreground) / 0.6)',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'hsl(var(--foreground) / 0.1)';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground))';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'none';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground) / 0.6)';
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Removed Items Section */}
                                    {(removedItems.options.length > 0 || removedItems.criteria.length > 0) && (
                                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'hsl(var(--foreground) / 0.03)', borderRadius: '0.5rem', border: '1px dashed hsl(var(--border))' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.75rem', color: 'hsl(var(--foreground) / 0.5)' }}>
                                                🗑️ Removed (click to restore):
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {removedItems.options.map((option, idx) => (
                                                    <button
                                                        key={`removed-opt-${idx}`}
                                                        onClick={() => restoreOption(option)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            padding: '0.4rem 0.65rem',
                                                            background: 'transparent',
                                                            border: '1px dashed hsl(var(--foreground) / 0.3)',
                                                            borderRadius: '9999px',
                                                            fontSize: '0.85rem',
                                                            color: 'hsl(var(--foreground) / 0.5)',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'hsl(var(--foreground) / 0.05)';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground))';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground) / 0.5)';
                                                        }}
                                                    >
                                                        ↺ {option}
                                                    </button>
                                                ))}
                                                {removedItems.criteria.map((criterion, idx) => (
                                                    <button
                                                        key={`removed-crit-${idx}`}
                                                        onClick={() => restoreCriterion(criterion)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            padding: '0.4rem 0.65rem',
                                                            background: 'transparent',
                                                            border: '1px dashed hsl(var(--foreground) / 0.3)',
                                                            borderRadius: '9999px',
                                                            fontSize: '0.85rem',
                                                            color: 'hsl(var(--foreground) / 0.5)',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'hsl(var(--foreground) / 0.05)';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground))';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = 'hsl(var(--foreground) / 0.5)';
                                                        }}
                                                    >
                                                        ↺ {criterion}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => onNext(suggestions, description)}
                                        className="btn btn-primary"
                                        disabled={suggestions.options.length < 2 || suggestions.criteria.length === 0}
                                        title={suggestions.options.length < 2
                                            ? "Add at least 2 options to compare"
                                            : suggestions.criteria.length === 0
                                                ? "Add at least 1 criterion to proceed"
                                                : "Continue to prioritize criteria"}
                                        style={{
                                            width: '100%',
                                            opacity: (suggestions.options.length < 2 || suggestions.criteria.length === 0) ? 0.5 : 1
                                        }}
                                    >
                                        Proceed with these →
                                    </button>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input - ALWAYS visible */}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="input"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                placeholder={suggestions ? "Need changes? Keep chatting..." : "Type your reply..."}
                                autoFocus
                            />
                            <button
                                onClick={handleChatSubmit}
                                className="btn btn-primary"
                                title="Send message"
                            >
                                Send
                            </button>
                            <button
                                onClick={restartChat}
                                className="btn btn-secondary"
                                title="Start over from beginning"
                            >
                                ↺
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

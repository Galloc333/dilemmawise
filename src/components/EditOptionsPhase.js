"use client";
import { useState, useRef, useEffect } from 'react';

export default function EditOptionsPhase({ currentOptions, currentCriteria, onNext, onCancel }) {
    const [options, setOptions] = useState([...currentOptions]);
    const [criteria, setCriteria] = useState([...currentCriteria]);
    const [removedItems, setRemovedItems] = useState({ options: [], criteria: [] });

    // Chat state
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: `I see you'd like to review your decision structure. You're currently comparing **${currentOptions.join(', ')}** based on **${currentCriteria.join(', ')}**.\n\nFeel free to ask me to suggest new options or criteria, or just edit what you have below and proceed when ready!`
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;

        const newMessages = [...messages, { role: 'user', text: chatInput }];
        setMessages(newMessages);
        setChatInput('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    currentOptions: options,
                    currentCriteria: criteria
                })
            });

            const data = await response.json();

            // Add assistant response
            setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);

            // Auto-add any suggested options/criteria
            if (data.suggestedOptions?.length > 0) {
                setOptions(prev => [...new Set([...prev, ...data.suggestedOptions])]);
            }
            if (data.suggestedCriteria?.length > 0) {
                setCriteria(prev => [...new Set([...prev, ...data.suggestedCriteria])]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: "I'm having trouble connecting. Please try again or edit the options/criteria manually below."
            }]);
        }
    };

    const removeOption = (optionToRemove) => {
        setOptions(prev => prev.filter(opt => opt !== optionToRemove));
        setRemovedItems(prev => ({
            ...prev,
            options: [...prev.options, optionToRemove]
        }));
    };

    const removeCriterion = (criterionToRemove) => {
        setCriteria(prev => prev.filter(crit => crit !== criterionToRemove));
        setRemovedItems(prev => ({
            ...prev,
            criteria: [...prev.criteria, criterionToRemove]
        }));
    };

    const restoreOption = (optionToRestore) => {
        setOptions(prev => [...prev, optionToRestore]);
        setRemovedItems(prev => ({
            ...prev,
            options: prev.options.filter(opt => opt !== optionToRestore)
        }));
    };

    const restoreCriterion = (criterionToRestore) => {
        setCriteria(prev => [...prev, criterionToRestore]);
        setRemovedItems(prev => ({
            ...prev,
            criteria: prev.criteria.filter(crit => crit !== criterionToRestore)
        }));
    };

    const handleProceed = () => {
        onNext({ options, criteria });
    };

    return (
        <div className="animate-in">
            {/* Large Logo */}
            <div className="logo logo-large">DilemmaWise</div>

            <div className="max-w-2xl mx-auto">
                {/* Chat Interface */}
                <div className="card" style={{ marginBottom: '2rem', background: 'hsl(var(--card))' }}>
                    <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>💬 Chat with AI Assistant</h3>

                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', padding: '0.5rem' }}>
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
                                    maxWidth: '85%',
                                    padding: '1rem',
                                    borderRadius: '1rem',
                                    background: msg.role === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.05)',
                                    color: msg.role === 'user' ? 'white' : 'hsl(var(--foreground))',
                                    borderBottomRightRadius: msg.role === 'user' ? '0.25rem' : '1rem',
                                    borderBottomLeftRadius: msg.role === 'assistant' ? '0.25rem' : '1rem',
                                    lineHeight: '1.6'
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            className="input"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                            placeholder="Ask for new options, criteria suggestions, or guidance..."
                            autoFocus
                        />
                        <button
                            onClick={handleChatSubmit}
                            className="btn btn-primary"
                            title="Send message"
                        >
                            Send
                        </button>
                    </div>
                </div>

                {/* Editing Interface */}
                <div className="card" style={{ background: 'hsl(var(--card))' }}>
                    <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>✏️ Current Structure</h3>

                    {/* Options Chips */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem', color: 'hsl(var(--foreground) / 0.7)' }}>
                            Options:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {options.map((option, idx) => (
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
                        <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem', color: 'hsl(var(--foreground) / 0.7)' }}>
                            Criteria:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {criteria.map((criterion, idx) => (
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

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button
                            onClick={onCancel}
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                            title="Go back without making changes"
                        >
                            ← Cancel
                        </button>
                        <button
                            onClick={handleProceed}
                            className="btn btn-primary"
                            disabled={options.length < 2 || criteria.length === 0}
                            title={options.length < 2
                                ? "Keep at least 2 options to compare"
                                : criteria.length === 0
                                    ? "Keep at least 1 criterion"
                                    : "Continue with these options and criteria"}
                            style={{
                                flex: 2,
                                opacity: (options.length < 2 || criteria.length === 0) ? 0.5 : 1
                            }}
                        >
                            Proceed with these →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";
import { useState, useRef, useEffect } from 'react';

// Icons
const RobotIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4Z" fill="currentColor" fillOpacity="0.2" />
        <path d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8Z" fill="currentColor" />
    </svg>
);

export default function InputPhase({ onNext, savedDescription, initialOptions = [], initialCriteria = [] }) {
    // Core State
    const [options, setOptions] = useState(initialOptions);
    const [criteria, setCriteria] = useState(initialCriteria);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // Chat State
    const [messages, setMessages] = useState(() => {
        if (initialOptions.length > 0 || initialCriteria.length > 0) {
            return [{
                role: 'assistant',
                text: "I'm ready to help you edit. You can add more options or criteria, or modify the existing ones."
            }];
        }
        return [{
            role: 'assistant',
            text: "Hi! I'm DilemmaWise. Describe the decision you're facing, and I'll help you structure it. \n\nFor example: \"Should I move to New York or stay in London?\""
        }];
    });
    const [chatInput, setChatInput] = useState('');
    const [coreDilemma, setCoreDilemma] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Chat interaction
    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;

        const newMessages = [...messages, { role: 'user', text: chatInput }];
        setMessages(newMessages);
        setChatInput('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    currentOptions: options,
                    currentCriteria: criteria,
                    currentDilemma: coreDilemma
                })
            });
            const data = await response.json();

            // Add assistant response
            setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
            if (data.coreDilemma) setCoreDilemma(data.coreDilemma);

            // Automatic additions disabled - user must click tags inline
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I had trouble connecting. Please try again." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleRemoveOption = (opt) => setOptions(prev => prev.filter(o => o !== opt));
    const handleRemoveCriterion = (crit) => setCriteria(prev => prev.filter(c => c !== crit));

    const canSubmit = options.length >= 2 && criteria.length >= 1;

    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);

    const handleInitialSubmit = async () => {
        setIsValidating(true);
        try {
            const res = await fetch('/api/validate-matrix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options, criteria })
            });
            const data = await res.json();
            setValidationResult(data);
        } catch (e) {
            console.error("Validation failed", e);
            setValidationResult({ isValid: true });
        } finally {
            setIsValidating(false);
            setShowConfirmation(true);
        }
    };

    const confirmAndProceed = () => {
        const description = messages.filter(m => m.role === 'user').map(m => m.text).join('\n');
        onNext({ options, criteria }, description, coreDilemma);
    };

    return (
        <div className="animate-in max-w-6xl mx-auto h-[calc(100vh-8rem)] min-h-[500px]">
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div className="logo logo-large" style={{ fontSize: '1.8rem' }}>DilemmaWise</div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 h-full">

                {/* Left Panel: Decision Structure */}
                <div className="card md:col-span-1" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', borderRight: '1px solid hsl(var(--border))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🧩</span> Structure
                        </h3>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{canSubmit ? 'Ready' : 'Incomplete'}</span>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--foreground) / 0.6)', marginBottom: '0.75rem' }}>
                                Options
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {options.length === 0 && <span style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground) / 0.4)', fontStyle: 'italic' }}>None yet</span>}
                                {options.map((opt, i) => (
                                    <div key={i} className="chip">
                                        {opt}
                                        <button onClick={() => handleRemoveOption(opt)} className="chip-remove">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--foreground) / 0.6)', marginBottom: '0.75rem' }}>
                                Criteria
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {criteria.length === 0 && <span style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground) / 0.4)', fontStyle: 'italic' }}>None yet</span>}
                                {criteria.map((crit, i) => (
                                    <div key={i} className="chip chip-secondary">
                                        {crit}
                                        <button onClick={() => handleRemoveCriterion(crit)} className="chip-remove">×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ paddingTop: '1rem', borderTop: '1px solid hsl(var(--border))' }}>
                        {!canSubmit ? (
                            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground) / 0.6)', marginBottom: '1rem', padding: '0.75rem', background: 'hsl(var(--foreground) / 0.05)', borderRadius: '0.5rem' }}>
                                <strong>Missing info:</strong>
                                <ul style={{ marginLeft: '1.25rem', marginTop: '0.25rem', listStyleType: 'disc' }}>
                                    {options.length < 2 && <li>At least 2 options</li>}
                                    {criteria.length < 1 && <li>At least 1 criterion</li>}
                                </ul>
                            </div>
                        ) : null}

                        <button
                            onClick={handleInitialSubmit}
                            className="btn btn-primary w-full"
                            disabled={!canSubmit}
                            style={{ padding: '0.75rem' }}
                        >
                            Continue →
                        </button>
                    </div>
                </div>

                {/* Right Panel: Chat Interface */}
                <div className="card md:col-span-2" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0, overflow: 'hidden' }}>

                    {/* Chat History */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`chat-message ${msg.role}`}>
                                <div className="message-bubble">
                                    {msg.text.split(/\n\n+/).map((paragraph, pIdx) => (
                                        <p key={pIdx} style={{ marginBottom: pIdx === msg.text.split(/\n\n+/).length - 1 ? 0 : '1.2rem' }}>
                                            {paragraph.split(/(\[[^\]]+\]\([^)]+\)|\[\[Option:[^\]]+\]\]|\[\[Criterion:[^\]]+\]\])/g).map((part, i) => {
                                                const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                                                if (linkMatch) {
                                                    return (
                                                        <a
                                                            key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
                                                            style={{ color: msg.role === 'user' ? 'white' : 'hsl(var(--primary))', textDecoration: 'underline', fontWeight: '600' }}
                                                        >
                                                            {linkMatch[1]}
                                                        </a>
                                                    );
                                                }
                                                const optionMatch = part.match(/^\[\[Option:([^\]]+)\]\]$/);
                                                if (optionMatch) {
                                                    const name = optionMatch[1];
                                                    const exists = options.includes(name);
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => !exists && setOptions(prev => [...new Set([...prev, name])])}
                                                            className={`interactive-tag option ${exists ? 'exists' : ''}`}
                                                        >
                                                            {exists ? '✓' : '＋'} {name}
                                                        </button>
                                                    );
                                                }
                                                const criterionMatch = part.match(/^\[\[Criterion:([^\]]+)\]\]$/);
                                                if (criterionMatch) {
                                                    const name = criterionMatch[1];
                                                    const exists = criteria.includes(name);
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => !exists && setCriteria(prev => [...new Set([...prev, name])])}
                                                            className={`interactive-tag criterion ${exists ? 'exists' : ''}`}
                                                        >
                                                            {exists ? '✓' : '✨'} {name}
                                                        </button>
                                                    );
                                                }
                                                return part;
                                            })}
                                        </p>
                                    ))}
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
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                                type="text"
                                className="input"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                placeholder="Type your message..."
                                style={{ flex: 1 }}
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
                    </div>
                </div>

            </div>

            {/* Confirmation Modal */}
            {showConfirmation && (
                <div className="modal-overlay">
                    <div className="modal-content animate-in">
                        {validationResult?.isValid === false ? (
                            <>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '1rem', color: 'hsl(var(--destructive, 0 84% 60%))' }}>
                                    ⚠️ Logic Check
                                </h2>
                                <p style={{ marginBottom: '1rem', fontSize: '1rem', lineHeight: '1.5' }}>
                                    {validationResult.warning || "Some criteria might be awkward to rate for certain options."}
                                </p>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setShowConfirmation(false)} className="btn btn-primary">Fix in Chat</button>
                                    <button onClick={confirmAndProceed} className="btn btn-secondary" style={{ fontSize: '0.9rem' }}>Ignore & Proceed</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>Ready to prioritize?</h2>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'hsl(var(--foreground) / 0.7)', fontWeight: '500' }}>COMPARING:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                        {options.map((opt, i) => (
                                            <span key={i} className="chip">{opt}</span>
                                        ))}
                                    </div>

                                    <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'hsl(var(--foreground) / 0.7)', fontWeight: '500' }}>BASED ON:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {criteria.map((crit, i) => (
                                            <span key={i} className="chip chip-secondary">{crit}</span>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                    <button onClick={() => setShowConfirmation(false)} className="btn btn-secondary">Back to Chat</button>
                                    <button onClick={confirmAndProceed} className="btn btn-primary">Yes, Let's Go</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .chip { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.75rem; background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); border-radius: 999px; font-size: 0.85rem; font-weight: 500; border: 1px solid hsl(var(--primary) / 0.2); }
                .chip-secondary { background: hsl(280 70% 60% / 0.1); color: hsl(280 70% 60%); border: 1px solid hsl(280 70% 60% / 0.2); }
                .chip-remove { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: 0.5; padding: 0; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; transition: opacity 0.2s; }
                .chip-remove:hover { opacity: 1; }
                .chat-message { display: flex; margin-bottom: 0.5rem; }
                .chat-message.user { justify-content: flex-end; }
                .chat-message.assistant { justify-content: flex-start; }
                .message-bubble { 
                    max-width: 85%; padding: 1rem 1.25rem; border-radius: 1.25rem; font-size: 0.95rem; line-height: 1.6; 
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05); background: hsl(var(--card)); border: 1px solid hsl(var(--border));
                }
                .user .message-bubble { background: hsl(var(--primary)); color: white; border-bottom-right-radius: 0.25rem; border: none; }
                .assistant .message-bubble { border-bottom-left-radius: 0.25rem; }
                .interactive-tag {
                    display: inline-flex; align-items: center; gap: 4px; border-radius: 4px; padding: 2px 8px; margin: 0 2px;
                    font-size: 0.95em; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
                    vertical-align: baseline;
                }
                .interactive-tag.option { background: hsl(var(--primary) / 0.1); color: hsl(var(--primary)); border-color: hsl(var(--primary) / 0.2); }
                .interactive-tag.criterion { background: hsl(var(--secondary) / 0.1); color: hsl(var(--secondary)); border-color: hsl(var(--secondary) / 0.2); }
                .interactive-tag.exists { background: hsl(var(--muted)); color: hsl(var(--foreground) / 0.4); border-color: hsl(var(--border)); cursor: default; }
                .typing-indicator span { animation: blink 1.4s infinite both; margin: 0 1px; font-size: 1.5rem; }
                .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
                .modal-content { background: hsl(var(--card)); padding: 2rem; border-radius: 1rem; max-width: 500px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.1); border: 1px solid hsl(var(--border)); }
                .grid { display: grid; }
                @media (min-width: 768px) { .md\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); } .md\:col-span-1 { grid-column: span 1; } .md\:col-span-2 { grid-column: span 2; } }
            `}</style>
        </div>
    );
}

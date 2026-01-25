"use client";
import { useState, useRef, useEffect } from 'react';

// SCREENS
const SCREENS = {
    DILEMMA: 'DILEMMA',
    OPTIONS: 'OPTIONS',
    CRITERIA: 'CRITERIA'
};

export default function InputPhase({ onNext, savedDescription, initialOptions = [], initialCriteria = [] }) {
    // Helper
    const capitalizeFirst = (str) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Text refinement helper - corrects spelling/typos while preserving meaning
    const refineText = async (type, textOrItems) => {
        try {
            const isArray = Array.isArray(textOrItems);
            const response = await fetch('/api/refine-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isArray
                    ? { type, items: textOrItems }
                    : { type, text: textOrItems }
                )
            });
            const data = await response.json();
            return data.refined || textOrItems;
        } catch (e) {
            console.error('Text refinement failed:', e);
            return textOrItems; // Return original on error
        }
    };

    // Screen State
    const [screen, setScreen] = useState(() => {
        if (initialOptions.length > 0 && initialCriteria.length > 0) return SCREENS.CRITERIA;
        if (initialOptions.length > 0) return SCREENS.OPTIONS;
        return SCREENS.DILEMMA;
    });

    // Core State
    const [coreDilemma, setCoreDilemma] = useState('');
    const [options, setOptions] = useState(initialOptions);
    const [criteria, setCriteria] = useState(initialCriteria);
    const [userContext, setUserContext] = useState({}); // Store extracted personal details

    // Dilemma Input State
    const [dilemmaInput, setDilemmaInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [inputGuidance, setInputGuidance] = useState(''); // Real-time guidance hint
    const guidanceTimeoutRef = useRef(null);

    // Chat State
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Manual Input State
    const [manualInput, setManualInput] = useState('');

    // Confirmation Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null); // 'criteria' or 'finish'

    // Real-time input guidance - detects over-detailed input while typing
    const analyzeInputWhileTyping = (text) => {
        // Clear any pending timeout
        if (guidanceTimeoutRef.current) {
            clearTimeout(guidanceTimeoutRef.current);
        }

        // Debounce: wait 800ms after user stops typing
        guidanceTimeoutRef.current = setTimeout(() => {
            const wordCount = text.trim().split(/\s+/).length;
            const hasOptions = /\b(or|vs\.?|versus|between)\b/i.test(text) && wordCount > 15;
            const hasCriteria = /\b(care about|important|matters?|consider|priority|budget|price|cost)\b/i.test(text);
            const hasNumbers = /\d{3,}/.test(text); // Budget amounts, prices, etc.
            const hasMultipleSentences = (text.match(/[.!?]/g) || []).length > 1;

            if (wordCount > 25 || (hasOptions && hasCriteria) || (hasNumbers && hasCriteria) || hasMultipleSentences) {
                setInputGuidance("💡 You're sharing more than we need right now. Just the core question is enough – we'll ask about the details later.");
            } else if (wordCount > 15 && hasOptions) {
                setInputGuidance("💡 Keep it simple! What's the main question you're trying to answer?");
            } else {
                setInputGuidance('');
            }
        }, 800);
    };

    // Handle dilemma input change with real-time guidance
    const handleDilemmaInputChange = (e) => {
        const value = e.target.value;
        setDilemmaInput(value);
        if (value.length > 20) {
            analyzeInputWhileTyping(value);
        } else {
            setInputGuidance('');
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // SCREEN 1: Submit Dilemma
    const handleDilemmaSubmit = async () => {
        if (!dilemmaInput.trim()) return;

        setIsAnalyzing(true);
        setInputGuidance(''); // Clear any guidance

        let dilemmaQuestion = dilemmaInput.trim();
        dilemmaQuestion = dilemmaQuestion.charAt(0).toUpperCase() + dilemmaQuestion.slice(1);
        if (!dilemmaQuestion.endsWith('?') && !dilemmaQuestion.endsWith('.')) {
            dilemmaQuestion += '?';
        }

        try {
            const response = await fetch('/api/analyze-input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: dilemmaQuestion })
            });
            const data = await response.json();

            // Use summarized dilemma if available, otherwise use the original (refined)
            let finalDilemma = data.summarizedDilemma || dilemmaQuestion;
            finalDilemma = await refineText('dilemma', finalDilemma);
            setCoreDilemma(finalDilemma);

            // Store user context for later use
            if (data.userContext && Object.keys(data.userContext).length > 0) {
                setUserContext(data.userContext);
            }

            // Refine and set extracted options
            let extractedOptions = (data.options || []).map(capitalizeFirst);
            if (extractedOptions.length > 0) {
                extractedOptions = await refineText('options_list', extractedOptions);
                setOptions(extractedOptions);
            }

            // Refine and set extracted criteria (for display on criteria screen)
            let extractedCriteria = (data.criteria || []).map(capitalizeFirst);
            if (extractedCriteria.length > 0) {
                extractedCriteria = await refineText('criteria_list', extractedCriteria);
                setCriteria(extractedCriteria);
            }

            // Move to OPTIONS screen
            setScreen(SCREENS.OPTIONS);

            // Always call LLM for context-aware options suggestions (similar to criteria phase)
            setIsTyping(true);
            try {
                const chatRes = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{ role: 'user', text: `I need help deciding: ${finalDilemma}` }],
                        currentOptions: extractedOptions,
                        currentCriteria: extractedCriteria,
                        currentDilemma: finalDilemma,
                        currentPhase: 'OPTIONS',
                        userContext: data.userContext || {}
                    })
                });
                const chatData = await chatRes.json();
                setMessages([{ role: 'assistant', text: chatData.response }]);

                // Auto-add any extracted options from the response
                const newOpts = (chatData.suggestedOptions || []).map(capitalizeFirst);
                if (newOpts.length > 0) {
                    setOptions(prev => [...new Set([...prev, ...newOpts])]);
                }
            } catch (err) {
                console.error('Chat API error:', err);
                // Fallback message
                const criteriaNote = extractedCriteria.length > 0
                    ? ` I also noticed some factors you care about – we'll review those in the next step.`
                    : '';
                const optionsNote = extractedOptions.length > 0
                    ? `I found some options in your question. Review them in your basket, or add more below.${criteriaNote}\n\n`
                    : '';
                setMessages([{
                    role: 'assistant',
                    text: `${optionsNote}What options are you considering for this decision?`
                }]);
            } finally {
                setIsTyping(false);
            }
        } catch (error) {
            console.error("Analysis error:", error);
            setCoreDilemma(dilemmaQuestion);
            setScreen(SCREENS.OPTIONS);
            setMessages([{
                role: 'assistant',
                text: `What specific options are you considering for this decision?`
            }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Move to Criteria Screen
    const handleConfirmOptions = () => {
        if (options.length < 2) return;
        setConfirmAction('criteria');
        setShowConfirmModal(true);
    };

    const proceedToCriteria = async () => {
        setShowConfirmModal(false);
        setScreen(SCREENS.CRITERIA);
        setMessages([]); // Clear messages, will be populated by API
        setChatInput('');
        setIsTyping(true);
        
        try {
            // Call chat API to get context-aware criteria suggestions
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', text: `I want to compare: ${options.join(', ')}. What factors should I consider?` }],
                    currentOptions: options,
                    currentCriteria: [],
                    currentDilemma: coreDilemma,
                    currentPhase: 'CRITERIA',
                    userContext: userContext
                })
            });
            const data = await response.json();
            
            // Use the AI-generated response with context-aware criteria suggestions
            setMessages([{ role: 'assistant', text: data.response }]);
            
            // Auto-add any extracted criteria from the response
            const newCriteria = (data.suggestedCriteria || []).map(c => 
                c.charAt(0).toUpperCase() + c.slice(1)
            );
            if (newCriteria.length > 0) {
                setCriteria(prev => [...new Set([...prev, ...newCriteria])]);
            }
        } catch (error) {
            console.error('Failed to get criteria suggestions:', error);
            // Fallback to a simple prompt without hardcoded examples
            setMessages([{
                role: 'assistant',
                text: `Great! Now let's figure out what matters to you.\n\nWhat factors are important when comparing ${options.join(' and ')}?`
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    // Final Submit
    const handleFinish = () => {
        if (criteria.length < 1) return;
        setConfirmAction('finish');
        setShowConfirmModal(true);
    };

    const proceedToFinish = () => {
        setShowConfirmModal(false);
        const description = messages.filter(m => m.role === 'user').map(m => m.text).join('\n');
        onNext({ options, criteria, userContext }, description, coreDilemma);
    };

    // Chat Submit
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
                    currentDilemma: coreDilemma,
                    currentPhase: screen,
                    userContext: userContext
                })
            });
            const data = await response.json();

            setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);

            // Auto-add ONLY user-extracted items (not suggestions) - with refinement
            let newOptions = (data.suggestedOptions || []).map(capitalizeFirst);
            let newCriteria = (data.suggestedCriteria || []).map(capitalizeFirst);

            if (newOptions.length > 0) {
                newOptions = await refineText('options_list', newOptions);
                setOptions(prev => [...new Set([...prev, ...newOptions])]);
            }
            if (newCriteria.length > 0) {
                newCriteria = await refineText('criteria_list', newCriteria);
                setCriteria(prev => [...new Set([...prev, ...newCriteria])]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I had trouble connecting. Please try again." }]);
        } finally {
            setIsTyping(false);
        }
    };

    // Manual Add - with text refinement
    const handleManualAdd = async () => {
        let val = capitalizeFirst(manualInput.trim());
        if (!val) return;

        // Refine the manually entered text
        const type = screen === SCREENS.OPTIONS ? 'option' : 'criterion';
        val = await refineText(type, val);

        if (screen === SCREENS.OPTIONS && !options.includes(val)) {
            setOptions(prev => [...prev, val]);
        } else if (screen === SCREENS.CRITERIA && !criteria.includes(val)) {
            setCriteria(prev => [...prev, val]);
        }
        setManualInput('');
    };

    const handleRemoveOption = (opt) => setOptions(prev => prev.filter(o => o !== opt));
    const handleRemoveCriterion = (crit) => setCriteria(prev => prev.filter(c => c !== crit));

    // ========== SCREEN 1: DILEMMA ==========
    if (screen === SCREENS.DILEMMA) {
        return (
            <div className="screen-container dilemma-screen">
                <div className="screen-content">
                    <h1 className="brand">DilemmaWise</h1>
                    <p className="subtitle">AI-powered decision support</p>

                    <div className="dilemma-card">
                        <label>What's the core question you're trying to answer?</label>
                        <p className="helper-text">Keep it simple – just the decision question, not the details yet. We'll ask about options and criteria in the next steps.</p>
                        <textarea
                            value={dilemmaInput}
                            onChange={handleDilemmaInputChange}
                            placeholder='e.g., "Which phone should I buy?" or "Should I change jobs?"'
                            rows={3}
                            autoFocus
                        />
                        {inputGuidance && (
                            <div className="input-guidance">
                                {inputGuidance}
                            </div>
                        )}
                        <button
                            onClick={handleDilemmaSubmit}
                            className="btn btn-primary btn-lg"
                            disabled={!dilemmaInput.trim() || isAnalyzing}
                        >
                            {isAnalyzing ? 'Analyzing...' : 'Continue →'}
                        </button>
                    </div>
                </div>
                <style jsx>{`
                    .screen-container {
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 2rem;
                        background: linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%);
                    }
                    .screen-content {
                        max-width: 600px;
                        width: 100%;
                        text-align: center;
                    }
                    .brand {
                        font-size: 3rem;
                        font-weight: 700;
                        color: hsl(var(--primary));
                        margin-bottom: 0.5rem;
                    }
                    .subtitle {
                        font-size: 1.1rem;
                        color: hsl(var(--foreground) / 0.6);
                        margin-bottom: 3rem;
                    }
                    .dilemma-card {
                        background: hsl(var(--card));
                        padding: 2rem;
                        border-radius: 1rem;
                        border: 1px solid hsl(var(--border));
                        box-shadow: 0 10px 40px rgba(0,0,0,0.08);
                    }
                    .dilemma-card label {
                        display: block;
                        text-align: left;
                        font-weight: 600;
                        margin-bottom: 0.75rem;
                        font-size: 1.1rem;
                    }
                    .dilemma-card textarea {
                        width: 100%;
                        padding: 1rem;
                        border-radius: 0.5rem;
                        border: 1px solid hsl(var(--border));
                        font-size: 1rem;
                        resize: none;
                        margin-bottom: 0.75rem;
                        background: hsl(var(--background));
                        color: hsl(var(--foreground));
                    }
                    .dilemma-card textarea:focus {
                        outline: none;
                        border-color: hsl(var(--primary));
                        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
                    }
                    .helper-text {
                        font-size: 0.85rem;
                        color: hsl(var(--foreground) / 0.6);
                        margin: -0.25rem 0 1rem;
                        line-height: 1.4;
                    }
                    .input-guidance {
                        background: hsl(45 90% 95%);
                        border-left: 3px solid hsl(45 80% 50%);
                        padding: 0.75rem 1rem;
                        margin-bottom: 1rem;
                        border-radius: 0 0.5rem 0.5rem 0;
                        font-size: 0.9rem;
                        color: hsl(30 60% 30%);
                        animation: fadeIn 0.3s ease-out;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .btn-lg {
                        width: 100%;
                        padding: 1rem 2rem;
                        font-size: 1.1rem;
                    }
                `}</style>
            </div>
        );
    }

    // ========== SCREENS 2 & 3: OPTIONS / CRITERIA ==========
    const isOptionsScreen = screen === SCREENS.OPTIONS;
    const currentItems = isOptionsScreen ? options : criteria;
    const itemLabel = isOptionsScreen ? 'option' : 'criterion';
    const canProceed = isOptionsScreen ? options.length >= 2 : criteria.length >= 1;

    return (
        <div className="screen-container split-screen">
            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{confirmAction === 'criteria' ? '✓ Confirm Your Options' : '✓ Ready to Prioritize?'}</h3>

                        {confirmAction === 'criteria' ? (
                            <>
                                <p>You've selected {options.length} options to compare:</p>
                                <div className="modal-items">
                                    {options.map((opt, i) => (
                                        <span key={i} className="modal-chip option">{opt}</span>
                                    ))}
                                </div>
                                <p className="modal-note">You won't be able to change these after proceeding.</p>
                            </>
                        ) : (
                            <>
                                <p>You've defined {criteria.length} criteria:</p>
                                <div className="modal-items">
                                    {criteria.map((crit, i) => (
                                        <span key={i} className="modal-chip criterion">{crit}</span>
                                    ))}
                                </div>
                                <p className="modal-note">Next, you'll rate your options and set priorities.</p>
                            </>
                        )}

                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowConfirmModal(false)}
                            >
                                Go Back
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmAction === 'criteria' ? proceedToCriteria : proceedToFinish}
                            >
                                {confirmAction === 'criteria' ? 'Confirm & Continue' : 'Start Prioritizing'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Left: Chat */}
            <div className="chat-section">
                <div className="chat-header">
                    <span className="step-badge">{isOptionsScreen ? 'Step 2 of 3' : 'Step 3 of 3'}</span>
                    <h2>{isOptionsScreen ? 'Define Your Options' : 'Define Your Criteria'}</h2>
                    <p className="dilemma-display">{coreDilemma}</p>
                </div>

                <div className="chat-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`chat-message ${msg.role}`}>
                            <div className="message-bubble">
                                {msg.text.split(/(\[\[Option:[^\]]+\]\]|\[\[Criterion:[^\]]+\]\]|\[\[[^\]]+\]\])/g).map((part, i) => {
                                    const optionMatch = part.match(/^\[\[Option:([^\]]+)\]\]$/);
                                    if (optionMatch) {
                                        const name = optionMatch[1];
                                        const exists = options.includes(name) || options.includes(capitalizeFirst(name));
                                        
                                        // In CRITERIA phase, if option already exists, show as plain text for natural flow
                                        if (screen === SCREENS.CRITERIA && exists) {
                                            return <span key={i}>{name}</span>;
                                        }
                                        
                                        return (
                                            <button key={i}
                                                onClick={() => !exists && setOptions(prev => [...new Set([...prev, capitalizeFirst(name)])])}
                                                className={`tag-btn option ${exists ? 'added' : ''}`}>
                                                {exists ? '✓' : '+'} {name}
                                            </button>
                                        );
                                    }
                                    const criterionMatch = part.match(/^\[\[Criterion:([^\]]+)\]\]$/);
                                    if (criterionMatch) {
                                        const name = criterionMatch[1];
                                        const exists = criteria.includes(name) || criteria.includes(capitalizeFirst(name));
                                        return (
                                            <button key={i}
                                                onClick={() => !exists && setCriteria(prev => [...new Set([...prev, capitalizeFirst(name)])])}
                                                className={`tag-btn criterion ${exists ? 'added' : ''}`}>
                                                {exists ? '✓' : '✨'} {name}
                                            </button>
                                        );
                                    }
                                    // Handle simple brackets [[Name]] - just remove brackets for plain text display
                                    const simpleBracketMatch = part.match(/^\[\[([^\]]+)\]\]$/);
                                    if (simpleBracketMatch) {
                                        return simpleBracketMatch[1];
                                    }
                                    return part;
                                })}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="chat-message assistant">
                            <div className="message-bubble typing">
                                <span>•</span><span>•</span><span>•</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                        placeholder="Ask for suggestions or tell me more..."
                    />
                    <button onClick={handleChatSubmit} className="btn btn-primary" disabled={!chatInput.trim() || isTyping}>
                        ↑
                    </button>
                </div>
            </div>

            {/* Right: Basket */}
            <div className="basket-section">
                <div className="basket-card">
                    <h3>{isOptionsScreen ? '🎯 Your Options' : '📊 Your Criteria'}</h3>
                    <p className="basket-hint">
                        {isOptionsScreen
                            ? 'Add at least 2 options to compare'
                            : 'Add at least 1 factor that matters to you'}
                    </p>

                    <div className="basket-items">
                        {currentItems.map((item, i) => (
                            <div key={i} className={`chip ${isOptionsScreen ? 'option' : 'criterion'}`}>
                                {item}
                                <button
                                    onClick={() => isOptionsScreen ? handleRemoveOption(item) : handleRemoveCriterion(item)}
                                    className="chip-remove">×</button>
                            </div>
                        ))}
                        {currentItems.length === 0 && (
                            <p className="empty-state">No {itemLabel}s added yet</p>
                        )}
                    </div>

                    <div className="manual-add">
                        <input
                            type="text"
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                            placeholder={`Add ${itemLabel} manually...`}
                        />
                        <button onClick={handleManualAdd} className="btn-add">+</button>
                    </div>
                </div>

                <button
                    onClick={isOptionsScreen ? handleConfirmOptions : handleFinish}
                    className="btn btn-primary btn-proceed"
                    disabled={!canProceed}
                >
                    {isOptionsScreen ? 'Confirm Options & Continue →' : 'Finish & Continue →'}
                </button>
            </div>

            <style jsx>{`
                .split-screen {
                    display: grid;
                    grid-template-columns: 1fr 400px;
                    height: 100vh;
                    background: hsl(var(--background));
                }
                .chat-section {
                    display: flex;
                    flex-direction: column;
                    border-right: 1px solid hsl(var(--border));
                }
                .chat-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid hsl(var(--border));
                    background: hsl(var(--card));
                }
                .step-badge {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: hsl(var(--primary));
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .chat-header h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0.25rem 0;
                }
                .dilemma-display {
                    font-size: 0.95rem;
                    color: hsl(var(--foreground) / 0.7);
                    margin: 0;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .chat-input-area {
                    padding: 1rem;
                    border-top: 1px solid hsl(var(--border));
                    display: flex;
                    gap: 0.5rem;
                    background: hsl(var(--card));
                }
                .chat-input-area input {
                    flex: 1;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    border: 1px solid hsl(var(--border));
                    font-size: 1rem;
                    background: hsl(var(--background));
                    color: hsl(var(--foreground));
                }
                .chat-input-area input:focus {
                    outline: none;
                    border-color: hsl(var(--primary));
                }
                .chat-message { display: flex; }
                .chat-message.user { justify-content: flex-end; }
                .chat-message.assistant { justify-content: flex-start; }
                .message-bubble {
                    max-width: 85%;
                    padding: 1rem 1.25rem;
                    border-radius: 1rem;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    background: hsl(var(--card));
                    border: 1px solid hsl(var(--border));
                }
                .user .message-bubble {
                    background: hsl(var(--primary));
                    color: white;
                    border: none;
                }
                .tag-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    margin: 0 3px;
                    border-radius: 4px;
                    font-size: 0.9em;
                    font-weight: 600;
                    cursor: pointer;
                    border: 1px solid;
                    transition: all 0.15s;
                }
                .tag-btn.option {
                    background: hsl(var(--primary) / 0.1);
                    color: hsl(var(--primary));
                    border-color: hsl(var(--primary) / 0.2);
                }
                .tag-btn.criterion {
                    background: hsl(280 70% 60% / 0.1);
                    color: hsl(280 70% 60%);
                    border-color: hsl(280 70% 60% / 0.2);
                }
                .tag-btn.added {
                    background: hsl(var(--muted));
                    color: hsl(var(--foreground) / 0.4);
                    border-color: hsl(var(--border));
                    cursor: default;
                }
                .tag-btn:not(.added):hover {
                    transform: scale(1.05);
                }
                .typing span {
                    animation: blink 1.4s infinite both;
                    margin: 0 2px;
                    font-size: 1.5rem;
                }
                .typing span:nth-child(2) { animation-delay: 0.2s; }
                .typing span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }

                .basket-section {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    background: hsl(var(--muted) / 0.3);
                }
                .basket-card {
                    flex: 1;
                    background: hsl(var(--card));
                    border-radius: 1rem;
                    padding: 1.5rem;
                    border: 1px solid hsl(var(--border));
                }
                .basket-card h3 {
                    font-size: 1.2rem;
                    margin-bottom: 0.5rem;
                }
                .basket-hint {
                    font-size: 0.85rem;
                    color: hsl(var(--foreground) / 0.6);
                    margin-bottom: 1.5rem;
                }
                .basket-items {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    min-height: 100px;
                    margin-bottom: 1rem;
                }
                .empty-state {
                    font-size: 0.9rem;
                    color: hsl(var(--foreground) / 0.4);
                    font-style: italic;
                }
                .chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.4rem 0.8rem;
                    border-radius: 999px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .chip.option {
                    background: hsl(var(--primary) / 0.1);
                    color: hsl(var(--primary));
                    border: 1px solid hsl(var(--primary) / 0.2);
                }
                .chip.criterion {
                    background: hsl(280 70% 60% / 0.1);
                    color: hsl(280 70% 60%);
                    border: 1px solid hsl(280 70% 60% / 0.2);
                }
                .chip-remove {
                    background: none;
                    border: none;
                    cursor: pointer;
                    opacity: 0.5;
                    font-size: 1rem;
                    line-height: 1;
                }
                .chip-remove:hover { opacity: 1; }
                .manual-add {
                    display: flex;
                    gap: 0.5rem;
                }
                .manual-add input {
                    flex: 1;
                    padding: 0.6rem 0.8rem;
                    border-radius: 0.5rem;
                    border: 1px solid hsl(var(--border));
                    font-size: 0.9rem;
                    background: hsl(var(--background));
                    color: hsl(var(--foreground));
                }
                .btn-add {
                    padding: 0.6rem 1rem;
                    border-radius: 0.5rem;
                    border: 1px solid hsl(var(--border));
                    background: hsl(var(--secondary));
                    cursor: pointer;
                    font-size: 1rem;
                }
                .btn-proceed {
                    margin-top: 1rem;
                    width: 100%;
                    padding: 1rem;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    background: hsl(var(--card));
                    border-radius: 1rem;
                    padding: 2rem;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                    border: 1px solid hsl(var(--border));
                }
                .modal-content h3 {
                    font-size: 1.4rem;
                    margin-bottom: 1rem;
                    color: hsl(var(--foreground));
                }
                .modal-content p {
                    color: hsl(var(--foreground) / 0.8);
                    margin-bottom: 0.75rem;
                }
                .modal-items {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin: 1rem 0;
                }
                .modal-chip {
                    padding: 0.4rem 0.8rem;
                    border-radius: 999px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .modal-chip.option {
                    background: hsl(var(--primary) / 0.15);
                    color: hsl(var(--primary));
                    border: 1px solid hsl(var(--primary) / 0.3);
                }
                .modal-chip.criterion {
                    background: hsl(280 70% 60% / 0.15);
                    color: hsl(280 70% 60%);
                    border: 1px solid hsl(280 70% 60% / 0.3);
                }
                .modal-note {
                    font-size: 0.85rem;
                    color: hsl(var(--foreground) / 0.6);
                    font-style: italic;
                }
                .modal-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1.5rem;
                    justify-content: flex-end;
                }
                .btn-secondary {
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid hsl(var(--border));
                    background: hsl(var(--secondary));
                    color: hsl(var(--foreground));
                    cursor: pointer;
                    font-size: 0.95rem;
                }
                .btn-secondary:hover {
                    background: hsl(var(--muted));
                }

                @media (max-width: 900px) {
                    .split-screen {
                        grid-template-columns: 1fr;
                        grid-template-rows: 1fr auto;
                    }
                    .basket-section {
                        max-height: 40vh;
                        overflow-y: auto;
                    }
                }
            `}</style>
        </div>
    );
}

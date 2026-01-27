'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  X,
  Plus,
  Send,
  Sparkles,
  Target,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { handleApiError } from '@/lib/apiErrors';
import { cn } from '@/lib/utils';

// SCREENS
const SCREENS = {
  DILEMMA: 'DILEMMA',
  OPTIONS: 'OPTIONS',
  CRITERIA: 'CRITERIA',
};

export default function InputPhase({
  onNext,
  savedDescription,
  initialOptions = [],
  initialCriteria = [],
}) {
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
        body: JSON.stringify(isArray ? { type, items: textOrItems } : { type, text: textOrItems }),
      });
      const data = await response.json();
      return data.refined || textOrItems;
    } catch (e) {
      console.error('Text refinement failed:', e);
      return textOrItems;
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
  const [userContext, setUserContext] = useState({});

  // Dilemma Input State
  const [dilemmaInput, setDilemmaInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputGuidance, setInputGuidance] = useState('');
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
  const [confirmAction, setConfirmAction] = useState(null);

  // Real-time input guidance
  const analyzeInputWhileTyping = (text) => {
    if (guidanceTimeoutRef.current) {
      clearTimeout(guidanceTimeoutRef.current);
    }

    guidanceTimeoutRef.current = setTimeout(() => {
      const wordCount = text.trim().split(/\s+/).length;
      const hasOptions = /\b(or|vs\.?|versus|between)\b/i.test(text) && wordCount > 15;
      const hasCriteria =
        /\b(care about|important|matters?|consider|priority|budget|price|cost)\b/i.test(text);
      const hasNumbers = /\d{3,}/.test(text);
      const hasMultipleSentences = (text.match(/[.!?]/g) || []).length > 1;

      if (
        wordCount > 25 ||
        (hasOptions && hasCriteria) ||
        (hasNumbers && hasCriteria) ||
        hasMultipleSentences
      ) {
        setInputGuidance(
          "You're sharing more than we need right now. Just the core question is enough – we'll ask about the details later."
        );
      } else if (wordCount > 15 && hasOptions) {
        setInputGuidance("Keep it simple! What's the main question you're trying to answer?");
      } else {
        setInputGuidance('');
      }
    }, 800);
  };

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // SCREEN 1: Submit Dilemma
  const handleDilemmaSubmit = async () => {
    if (!dilemmaInput.trim()) return;

    setIsAnalyzing(true);
    setInputGuidance('');

    let dilemmaQuestion = dilemmaInput.trim();
    dilemmaQuestion = dilemmaQuestion.charAt(0).toUpperCase() + dilemmaQuestion.slice(1);
    if (!dilemmaQuestion.endsWith('?') && !dilemmaQuestion.endsWith('.')) {
      dilemmaQuestion += '?';
    }

    try {
      const response = await fetch('/api/analyze-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: dilemmaQuestion }),
      });
      const data = await response.json();

      let finalDilemma = data.summarizedDilemma || dilemmaQuestion;
      finalDilemma = await refineText('dilemma', finalDilemma);
      setCoreDilemma(finalDilemma);

      if (data.userContext && Object.keys(data.userContext).length > 0) {
        setUserContext(data.userContext);
      }

      let extractedOptions = (data.options || []).map(capitalizeFirst);
      if (extractedOptions.length > 0) {
        extractedOptions = await refineText('options_list', extractedOptions);
        setOptions(extractedOptions);
      }

      let extractedCriteria = (data.criteria || []).map(capitalizeFirst);
      if (extractedCriteria.length > 0) {
        extractedCriteria = await refineText('criteria_list', extractedCriteria);
        setCriteria(extractedCriteria);
      }

      setScreen(SCREENS.OPTIONS);

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
            userContext: data.userContext || {},
          }),
        });
        const chatData = await chatRes.json();
        setMessages([{ role: 'assistant', text: chatData.response }]);

        const newOpts = (chatData.suggestedOptions || []).map(capitalizeFirst);
        if (newOpts.length > 0) {
          setOptions((prev) => [...new Set([...prev, ...newOpts])]);
        }
      } catch (err) {
        handleApiError(err, 'chat');
        const criteriaNote =
          extractedCriteria.length > 0
            ? ` I also noticed some factors you care about – we'll review those in the next step.`
            : '';
        const optionsNote =
          extractedOptions.length > 0
            ? `I found some options in your question. Review them in your basket, or add more below.${criteriaNote}\n\n`
            : '';
        setMessages([
          {
            role: 'assistant',
            text: `${optionsNote}What options are you considering for this decision?`,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    } catch (error) {
      handleApiError(error, 'analyze-input');
      setCoreDilemma(dilemmaQuestion);
      setScreen(SCREENS.OPTIONS);
      setMessages([
        {
          role: 'assistant',
          text: `What specific options are you considering for this decision?`,
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmOptions = () => {
    if (options.length < 2) return;
    setConfirmAction('criteria');
    setShowConfirmModal(true);
  };

  const proceedToCriteria = async () => {
    setShowConfirmModal(false);
    setScreen(SCREENS.CRITERIA);
    setMessages([]);
    setChatInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              text: `I want to compare: ${options.join(', ')}. What factors should I consider?`,
            },
          ],
          currentOptions: options,
          currentCriteria: [],
          currentDilemma: coreDilemma,
          currentPhase: 'CRITERIA',
          userContext: userContext,
        }),
      });
      const data = await response.json();

      setMessages([{ role: 'assistant', text: data.response }]);

      const newCriteria = (data.suggestedCriteria || []).map(
        (c) => c.charAt(0).toUpperCase() + c.slice(1)
      );
      if (newCriteria.length > 0) {
        setCriteria((prev) => [...new Set([...prev, ...newCriteria])]);
      }
    } catch (error) {
      handleApiError(error, 'criteria-suggestions');
      setMessages([
        {
          role: 'assistant',
          text: `Great! Now let's figure out what matters to you.\n\nWhat factors are important when comparing ${options.join(' and ')}?`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFinish = () => {
    if (criteria.length < 1) return;
    setConfirmAction('finish');
    setShowConfirmModal(true);
  };

  const proceedToFinish = () => {
    setShowConfirmModal(false);
    const description = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.text)
      .join('\n');
    onNext({ options, criteria, userContext }, description, coreDilemma);
  };

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
          userContext: userContext,
        }),
      });
      const data = await response.json();

      setMessages((prev) => [...prev, { role: 'assistant', text: data.response }]);

      let newOptions = (data.suggestedOptions || []).map(capitalizeFirst);
      let newCriteria = (data.suggestedCriteria || []).map(capitalizeFirst);

      if (newOptions.length > 0) {
        newOptions = await refineText('options_list', newOptions);
        setOptions((prev) => [...new Set([...prev, ...newOptions])]);
      }
      if (newCriteria.length > 0) {
        newCriteria = await refineText('criteria_list', newCriteria);
        setCriteria((prev) => [...new Set([...prev, ...newCriteria])]);
      }
    } catch (error) {
      handleApiError(error, 'chat');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry, I had trouble connecting. Please try again.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleManualAdd = async () => {
    let val = capitalizeFirst(manualInput.trim());
    if (!val) return;

    const type = screen === SCREENS.OPTIONS ? 'option' : 'criterion';
    val = await refineText(type, val);

    if (screen === SCREENS.OPTIONS && !options.includes(val)) {
      setOptions((prev) => [...prev, val]);
    } else if (screen === SCREENS.CRITERIA && !criteria.includes(val)) {
      setCriteria((prev) => [...prev, val]);
    }
    setManualInput('');
  };

  const handleRemoveOption = (opt) => setOptions((prev) => prev.filter((o) => o !== opt));
  const handleRemoveCriterion = (crit) => setCriteria((prev) => prev.filter((c) => c !== crit));

  // ========== SCREEN 1: DILEMMA ==========
  if (screen === SCREENS.DILEMMA) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl"
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-semibold text-foreground">
            What decision are you facing?
          </h1>
          <p className="text-muted-foreground">
            Describe your dilemma in a sentence or two. We'll help you break it down.
          </p>
        </div>

        <Card className="p-8">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Your decision question
          </label>
          <p className="mb-4 text-sm text-muted-foreground">
            Keep it simple – just the core question, not the details yet. We'll ask about options
            and criteria next.
          </p>
          <textarea
            value={dilemmaInput}
            onChange={handleDilemmaInputChange}
            placeholder='e.g., "Which phone should I buy?" or "Should I change jobs?"'
            rows={4}
            autoFocus
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <AnimatePresence>
            {inputGuidance && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 rounded-lg border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning-foreground"
              >
                💡 {inputGuidance}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleDilemmaSubmit}
            disabled={!dilemmaInput.trim() || isAnalyzing}
            size="lg"
            className="mt-6 w-full"
          >
            {isAnalyzing ? (
              <>
                <span className="mr-2 animate-spin">⏳</span>
                Analyzing...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </Card>
      </motion.div>
    );
  }

  // ========== SCREENS 2 & 3: OPTIONS / CRITERIA ==========
  const isOptionsScreen = screen === SCREENS.OPTIONS;
  const currentItems = isOptionsScreen ? options : criteria;
  const itemLabel = isOptionsScreen ? 'option' : 'criterion';
  const canProceed = isOptionsScreen ? options.length >= 2 : criteria.length >= 1;

  return (
    <>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-warm-lg"
            >
              <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {confirmAction === 'criteria' ? 'Confirm Your Options' : 'Ready to Prioritize?'}
              </h3>

              {confirmAction === 'criteria' ? (
                <>
                  <p className="mb-3 text-muted-foreground">
                    You've selected {options.length} options to compare:
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {options.map((opt, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm italic text-muted-foreground">
                    You won't be able to change these after proceeding.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-3 text-muted-foreground">
                    You've defined {criteria.length} criteria:
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {criteria.map((crit, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
                      >
                        {crit}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm italic text-muted-foreground">
                    Next, you'll rate your options and set priorities.
                  </p>
                </>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                  Go Back
                </Button>
                <Button
                  onClick={confirmAction === 'criteria' ? proceedToCriteria : proceedToFinish}
                >
                  {confirmAction === 'criteria' ? 'Confirm & Continue' : 'Start Prioritizing'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid h-[calc(100vh-12rem)] gap-6 lg:grid-cols-[1fr,380px]">
        {/* Left: Chat */}
        <Card className="flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="border-b border-border/60 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                {isOptionsScreen ? 'Step 1 of 2' : 'Step 2 of 2'}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {isOptionsScreen ? 'Define Your Options' : 'Define Your Criteria'}
            </h2>
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{coreDilemma}</p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md bg-secondary/50 text-foreground'
                  )}
                >
                  {msg.text
                    .split(/(\[\[Option:[^\]]+\]\]|\[\[Criterion:[^\]]+\]\]|\[\[[^\]]+\]\])/g)
                    .map((part, i) => {
                      const optionMatch = part.match(/^\[\[Option:([^\]]+)\]\]$/);
                      if (optionMatch) {
                        const name = optionMatch[1];
                        const exists =
                          options.includes(name) || options.includes(capitalizeFirst(name));

                        if (screen === SCREENS.CRITERIA && exists) {
                          return <span key={i}>{name}</span>;
                        }

                        return (
                          <button
                            key={i}
                            onClick={() =>
                              !exists &&
                              setOptions((prev) => [...new Set([...prev, capitalizeFirst(name)])])
                            }
                            className={cn(
                              'mx-1 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold transition-all',
                              exists
                                ? 'cursor-default border-border bg-muted text-muted-foreground'
                                : 'cursor-pointer border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
                            )}
                          >
                            {exists ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            {name}
                          </button>
                        );
                      }
                      const criterionMatch = part.match(/^\[\[Criterion:([^\]]+)\]\]$/);
                      if (criterionMatch) {
                        const name = criterionMatch[1];
                        const exists =
                          criteria.includes(name) || criteria.includes(capitalizeFirst(name));
                        return (
                          <button
                            key={i}
                            onClick={() =>
                              !exists &&
                              setCriteria((prev) => [...new Set([...prev, capitalizeFirst(name)])])
                            }
                            className={cn(
                              'mx-1 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold transition-all',
                              exists
                                ? 'cursor-default border-border bg-muted text-muted-foreground'
                                : 'cursor-pointer border-accent/20 bg-accent/10 text-accent hover:bg-accent/20'
                            )}
                          >
                            {exists ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            {name}
                          </button>
                        );
                      }
                      const simpleBracketMatch = part.match(/^\[\[([^\]]+)\]\]$/);
                      if (simpleBracketMatch) {
                        return simpleBracketMatch[1];
                      }
                      return part;
                    })}
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-secondary/50 px-4 py-3">
                  <div className="flex gap-1">
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="border-t border-border/60 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                placeholder="Ask for suggestions or tell me more..."
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                onClick={handleChatSubmit}
                disabled={!chatInput.trim() || isTyping}
                size="icon"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Right: Basket */}
        <div className="flex flex-col gap-4">
          <Card className="flex flex-1 flex-col p-5">
            <div className="mb-1 flex items-center gap-2">
              {isOptionsScreen ? (
                <Target className="h-5 w-5 text-primary" />
              ) : (
                <Sparkles className="h-5 w-5 text-accent" />
              )}
              <h3 className="font-semibold text-foreground">
                {isOptionsScreen ? 'Your Options' : 'Your Criteria'}
              </h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {isOptionsScreen
                ? 'Add at least 2 options to compare'
                : 'Add at least 1 factor that matters to you'}
            </p>

            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {currentItems.map((item, i) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
                        isOptionsScreen
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-accent/20 bg-accent/10 text-accent'
                      )}
                    >
                      {item}
                      <button
                        onClick={() =>
                          isOptionsScreen ? handleRemoveOption(item) : handleRemoveCriterion(item)
                        }
                        className="opacity-60 transition-opacity hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {currentItems.length === 0 && (
                  <p className="text-sm italic text-muted-foreground">No {itemLabel}s added yet</p>
                )}
              </div>
            </div>

            {/* Manual Add */}
            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                  placeholder={`Add ${itemLabel} manually...`}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  onClick={handleManualAdd}
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          <Button
            onClick={isOptionsScreen ? handleConfirmOptions : handleFinish}
            disabled={!canProceed}
            size="lg"
            className="w-full"
          >
            {isOptionsScreen ? 'Confirm Options & Continue' : 'Finish & Continue'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );
}

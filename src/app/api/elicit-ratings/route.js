import { generateWithRetry, parseJsonFromResponse } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CONTEXT_ANALYSIS_PROMPT = `You are a precision logic agent. Your goal is to gather user-specific context to personalize the decision comparison.

## INPUT
- Dilemma: The core decision question
- Description: Any additional context the user provided
- Options: The alternatives being compared
- Criteria: The factors that matter to the user
- Existing User Context: Information already collected (DO NOT re-ask for these!)

## YOUR TASK
1. **Extract Known Facts**: Pull every objective fact from the Description that's relevant to the criteria.
2. **Generate Criteria-Specific Questions**: For each criterion, identify if we need personal context to properly evaluate it:
   - "Price/Cost/Budget" → Ask about budget range, financial constraints
   - "Quality/Performance" → Ask about specific use cases, intensity of use
   - "Career/Job" → Ask about current role, career goals, industry
   - "Location/Commute" → Ask about where they live/work, transportation needs
   - "Lifestyle/Culture" → Ask about hobbies, social preferences, daily routine
   - "Family/Personal" → Ask about dependents, living situation
   
3. **DO NOT ASK** for information already in Existing User Context!
4. **LIMIT**: Maximum 3-4 questions total, only the most impactful ones.

## OUTPUT JSON
{
  "already_known_context": { 
    "budget": "4000 ILS",
    "location": "Tel Aviv"
  },
  "needs_more_context": true,
  "questions": [
    { 
      "field": "primary_use_case", 
      "question": "What do you primarily use your phone for (e.g., gaming, photography, social media, work)?", 
      "reason": "To evaluate Quality and Performance based on your actual usage patterns."
    }
  ],
  "placeholder_hint": "e.g., I prefer brand X, I need good customer support, I'm upgrading from model Y..."
}

The "placeholder_hint" should be contextual examples relevant to the specific dilemma and options.`;

const QUESTION_GENERATION_PROMPT = `You are generating simple, conversational questions to help the user rate their options.

CRITICAL RULES:
1. **ONE QUESTION PER CRITERION**: Generate exactly one question for each provided criterion.
2. **ALL OPTIONS**: Each question must ask the user to consider ALL options listed.
3. **HUMAN-SPEAK**: Use natural, direct language. (e.g., "From 1 to 10, how well does each computer handle gaming in your opinion?") 
4. **NO PREAMBLES**: Jump straight to the question.
5. **CONCISE**: Keep it very short.
6. **FORMAT**: Ensure specifically that "relates_to" includes the single "criterion" and the full list of "options".

Output JSON array:
[
  {
    "id": "q1",
    "text": "How good is the battery life (1-10) for each of these laptops?",
    "relates_to": { "options": ["Option A", "Option B", "Option C"], "criterion": "Battery Life" }
  }
]`;

const INFERENCE_PROMPT = `Based on user responses (which contain 1-10 ratings for each option on a specific criterion), generate the final rating matrix in the SAME 1-10 scale.
User provided 1-10 for each option. Do NOT normalize. Keep it 1-10.

Return JSON structure:
{
  "ratings": {
    "Option A": { "Criterion X": 10, "Criterion Y": 7 },
    "Option B": { "Criterion X": 5, "Criterion Y": 9 }
  },
  "reasoning": "Briefly explain how these ratings reflect the user's specific answers.",
  "confidence": 1.0
}`;

function detectAbstractness(options) {
    return options.every(opt =>
        /^(option|choice|job|alternative|candidate)\s*[a-z0-9]*$/i.test(opt.trim())
    );
}

function calculateQuestionBudget(numCriteria, numOptions) {
    return numCriteria;
}

// Generate fallback questions based on criteria when LLM parsing fails
function generateFallbackQuestions(criteria, existingContext = {}) {
    const criteriaQuestionMap = {
        'price': { field: 'budget', question: 'What is your approximate budget or price range?', reason: 'To evaluate value for money.' },
        'cost': { field: 'budget', question: 'What is your budget constraint?', reason: 'To compare costs within your range.' },
        'budget': { field: 'budget', question: 'What is your maximum budget?', reason: 'To filter options by affordability.' },
        'quality': { field: 'quality_priority', question: 'What aspects of quality matter most to you?', reason: 'To focus on relevant quality factors.' },
        'performance': { field: 'use_case', question: 'What will you primarily use this for?', reason: 'To evaluate performance for your needs.' },
        'career': { field: 'career_goals', question: 'What are your career goals or priorities?', reason: 'To assess career fit.' },
        'job': { field: 'work_preferences', question: 'What aspects of work are most important to you?', reason: 'To match job characteristics.' },
        'location': { field: 'location_needs', question: 'What location factors matter to you (commute, neighborhood, etc.)?', reason: 'To evaluate location fit.' },
        'commute': { field: 'commute_preference', question: 'How do you typically commute and how far is acceptable?', reason: 'To compare commute options.' },
        'lifestyle': { field: 'lifestyle_priorities', question: 'What lifestyle factors are important to you?', reason: 'To match lifestyle preferences.' },
    };
    
    const questions = [];
    const usedFields = new Set(Object.keys(existingContext || {}));
    
    for (const crit of criteria) {
        const critLower = crit.toLowerCase();
        for (const [keyword, question] of Object.entries(criteriaQuestionMap)) {
            if (critLower.includes(keyword) && !usedFields.has(question.field)) {
                questions.push(question);
                usedFields.add(question.field);
                break;
            }
        }
        if (questions.length >= 3) break; // Limit to 3 questions
    }
    
    return questions;
}

function generateSearchQuery(question, options, criteria, context = {}) {
    const { relates_to } = question;
    if (!relates_to) return null;
    const { criterion, options: questionOptions } = relates_to;

    const cleanOptions = (questionOptions || []).map(opt => {
        if (opt.toLowerCase().includes('at ')) return opt.split(/at\s+/i)[1];
        if (opt.toLowerCase().includes('position ')) return opt.split(/position\s+/i)[1];
        if (opt.toLowerCase().includes('stay in ')) return opt.split(/stay in\s+/i)[1];
        if (opt.toLowerCase().includes('move to ')) return opt.split(/move to\s+/i)[1];
        return opt;
    });

    let specializedContext = "";
    const critLower = criterion.toLowerCase();

    if (critLower.includes('family') || critLower.includes('proximity') || critLower.includes('distance') || critLower.includes('travel')) {
        const familyLoc = context.family_location || context.home_location;
        if (familyLoc) specializedContext = `from ${familyLoc}`;
    }
    else if (critLower.includes('salary') || critLower.includes('career') || critLower.includes('job') || critLower.includes('professional')) {
        if (context.current_position) specializedContext = `for a ${context.current_position}`;
    }
    else if (critLower.includes('budget') || critLower.includes('price') || critLower.includes('cost')) {
        if (context.budget) specializedContext = `within budget ${context.budget}`;
    }

    if (cleanOptions.length >= 2 && criterion) {
        return `${cleanOptions.join(' vs ')} ${criterion} ${specializedContext}`.trim();
    } else if (cleanOptions.length === 1 && criterion) {
        return `${cleanOptions[0]} ${criterion} ${specializedContext}`.trim();
    }
    return null;
}

async function enrichQuestionsWithFacts(questions, options, criteria, context = {}, description = "", dilemma = "") {
    const seenQueries = new Set();
    return await Promise.all(questions.map(async (q) => {
        try {
            const searchQuery = generateSearchQuery(q, options, criteria, context);
            
            if (!searchQuery) {
                console.warn('[enrichQuestionsWithFacts] No search query generated for question:', q.text);
                return q;
            }
            
            if (seenQueries.has(searchQuery)) {
                console.log('[enrichQuestionsWithFacts] Skipping duplicate query:', searchQuery);
                return q;
            }
            
            seenQueries.add(searchQuery);
            console.log('[enrichQuestionsWithFacts] Searching:', searchQuery);
            
            const results = await performWebSearch(searchQuery);
            
            if (!results || results.length === 0) {
                console.warn('[enrichQuestionsWithFacts] No search results for:', searchQuery);
                return q;
            }
            
            console.log('[enrichQuestionsWithFacts] Found', results.length, 'results for:', searchQuery);
            
            // At this point, we know results exist and have length > 0
            const ctxSummary = Object.entries(context)
                .map(([k, v]) => `${k}: ${v}`).join(', ');

            const SYNTHESIS_PROMPT = `Analyze search results for criterion: "${q.relates_to.criterion}".

USER CONTEXT:
- Dilemma: ${dilemma}
- User details: ${ctxSummary}
- Options: ${JSON.stringify(options)}

SEARCH RESULTS:
${results.map((r, i) => `[${i+1}] ${r.snippet}`).join('\n\n')}

CRITICAL: You MUST return valid JSON with these REQUIRED fields:
{
  "bullet_points": ["fact 1", "fact 2", "fact 3"],
  "takeaway": "How this criterion affects the user's choice",
  "charts": [{"chart_type": "bar|comparison_table|scale|none", "chart_title": "Title", "chart_data": [{"label": "Option", "value": 123}]}]
}

RULES:
- bullet_points: REQUIRED. Exactly 3 factual insights from search results
- takeaway: REQUIRED. User-specific guidance (use "you/your")
- charts: Include ONLY if you have real numeric data. Use "none" if qualitative
- Use \\n for newlines in strings, NOT actual line breaks
- Keep concise (under 500 chars per field)`;

            const summaryResult = await generateWithRetry(SYNTHESIS_PROMPT);
            
            let data;
            try {
                data = parseJsonFromResponse(summaryResult.response.text());
                
                // Validate the parsed data has expected fields
                if (data && !data.bullet_points && !data.takeaway && !data.charts) {
                    console.warn('[enrichQuestionsWithFacts] LLM returned empty/invalid data structure:', data);
                    data = null; // Force fallback to raw snippets
                }
            } catch (parseError) {
                console.warn('[enrichQuestionsWithFacts] JSON parse failed, using fallback:', parseError.message);
                data = null;
            }

            // Build summary: prefer LLM bullet points, but fall back to raw snippets if missing
            let summary = '';
            if (data?.bullet_points && data.bullet_points.length > 0) {
                summary = data.bullet_points.map(b => `- ${b}`).join('\n');
            } else {
                // Fallback: use top 3 search result snippets as bullet points
                summary = results.slice(0, 3).map(r => `- ${r.snippet}`).join('\n');
            }
            
            return {
                ...q,
                webFacts: {
                    summary: summary || 'No additional information available.',
                    takeaway: data?.takeaway || null,
                    charts: data?.charts || (data?.chart_data ? [{
                        chart_type: 'bar',
                        chart_title: data.chart_title,
                        chart_data: data.chart_data
                    }] : []),
                    sources: results.map(r => ({ title: r.title, url: r.url }))
                }
            };
        } catch (e) { 
            console.error('[enrichQuestionsWithFacts] Error enriching question:', q.text, e.message); 
        }
        return q;
    }));
}

export async function POST(request) {
    try {
        const { mode, options, criteria, weights, context, responses, description, dilemma, userContext } = await request.json();

        if (mode === 'analyze_context') {
            if (detectAbstractness(options)) {
                return NextResponse.json({ 
                    needs_more_context: false,
                    already_known_context: userContext || {},
                    questions: [],
                    placeholder_hint: `e.g., Any preferences about ${options.slice(0, 2).join(' or ')}?`
                });
            }
            
            // Format existing user context for the prompt
            const existingContextStr = userContext && Object.keys(userContext).length > 0
                ? `\nExisting User Context (DO NOT re-ask): ${JSON.stringify(userContext)}`
                : '\nExisting User Context: None yet';
            
            const prompt = `Dilemma Question: "${dilemma || description}"
Initial Description: "${description}"
Options: ${JSON.stringify(options)}
Criteria: ${JSON.stringify(criteria)}${existingContextStr}`;

            const result = await generateWithRetry([{ text: CONTEXT_ANALYSIS_PROMPT }, { text: prompt }]);
            
            let data;
            try {
                data = parseJsonFromResponse(result.response.text());
            } catch (parseError) {
                console.error('[analyze_context] JSON parse failed:', parseError.message);
                console.error('[analyze_context] Raw response:', result.response.text().substring(0, 500));
                // Fallback: generate basic criteria-specific questions
                return NextResponse.json({ 
                    needs_more_context: true, 
                    already_known_context: userContext || {}, 
                    questions: generateFallbackQuestions(criteria, userContext),
                    placeholder_hint: `e.g., Any preferences about ${options.slice(0, 2).join(' or ')}?`
                });
            }

            // Merge already_known_context with existing userContext
            const mergedContext = {
                ...(userContext || {}),
                ...(data?.already_known_context || {})
            };
            
            if (data && data.questions) {
                // Filter out questions for fields we already have
                const knownFields = Object.keys(mergedContext);
                data.questions = data.questions.filter(q => !knownFields.includes(q.field));
                if (data.questions.length === 0) data.needs_more_context = false;
            }
            
            // Ensure placeholder_hint exists
            const placeholderHint = data?.placeholder_hint || 
                `e.g., Any specific preferences about ${options.slice(0, 2).join(' or ')}?`;
            
            return NextResponse.json({
                ...data,
                already_known_context: mergedContext,
                placeholder_hint: placeholderHint,
                needs_more_context: data?.needs_more_context !== false // Default to true
            });
        }

        if (mode === 'generate_questions') {
            const budget = calculateQuestionBudget(criteria.length, options.length);
            const prompt = `Core Dilemma: "${dilemma || description}"\nHistory/Description: "${description}"\nOptions: ${JSON.stringify(options)}\nCriteria: ${JSON.stringify(criteria)}\nContext: ${JSON.stringify(context || {})}`;
            const result = await generateWithRetry([
                { text: QUESTION_GENERATION_PROMPT.replace('{budget}', budget) },
                { text: prompt }
            ]);
            
            let questions;
            try {
                questions = parseJsonFromResponse(result.response.text());
            } catch (parseError) {
                console.error('[generate_questions] JSON parse failed:', parseError.message);
                console.error('[generate_questions] Raw response:', result.response.text().substring(0, 500));
                // Fallback: generate basic questions for each criterion
                questions = criteria.map((crit, idx) => ({
                    id: `q${idx + 1}`,
                    text: `On a scale of 1-10, how would you rate each option on "${crit}"?`,
                    relates_to: { options, criterion: crit }
                }));
            }
            
            const enriched = await enrichQuestionsWithFacts(
                Array.isArray(questions) ? questions : [],
                options,
                criteria,
                context || {},
                description,
                dilemma
            );
            return NextResponse.json({ questions: enriched, budget });
        }

        if (mode === 'infer_ratings') {
            // IMPORTANT: Skip LLM inference entirely - use user's actual ratings directly
            // The user already provided 1-10 ratings for each option on each criterion
            // We just need to extract them from the responses, no conversion needed
            
            const ratings = {};
            
            // Initialize all options with empty ratings
            options.forEach(opt => {
                ratings[opt] = {};
            });
            
            // Extract ratings directly from user responses
            responses.forEach(resp => {
                if (resp.numeric_scores && resp.relates_to?.criterion) {
                    const criterion = resp.relates_to.criterion;
                    Object.entries(resp.numeric_scores).forEach(([opt, score]) => {
                        if (ratings[opt]) {
                            // Keep the exact score the user provided (1-10 scale)
                            ratings[opt][criterion] = parseInt(score) || 5;
                        }
                    });
                }
            });
            
            // Fill in any missing criteria with default value
            options.forEach(opt => {
                criteria.forEach(crit => {
                    if (ratings[opt][crit] === undefined) {
                        ratings[opt][crit] = 5; // Default to midpoint
                    }
                });
            });
            
            return NextResponse.json({ 
                ratings, 
                reasoning: 'Direct extraction from user responses (no LLM transformation)', 
                confidence: 1.0 
            });
        }
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

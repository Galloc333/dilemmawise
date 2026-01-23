import { model, parseJsonFromResponse } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CONTEXT_ANALYSIS_PROMPT = `You are analyzing a decision to determine what specific user context would be helpful for web search and tailored questions.

Your task:
1. Examine the Options, Criteria, and the user's initial Dilemma Description.
2. Identify specific logical questions that would clarify the user's situation (e.g., "What is your current role?", "Where do you live?", "What is your budget?").
3. DO NOT ask questions if the information is already in the description (e.g., if they said "Move from London to NY", don't ask where they live).
4. Only ask questions that are HIGHLY RELEVANT to the criteria provided.

Output JSON:
{
  "already_known_context": { "field_name": "value" } or null,
  "needs_more_context": true/false,
  "questions": [
    {
      "field": "current_position",
      "question": "What is your current position?",
      "reason": "This helps tailor job opportunity comparisons."
    }
  ]
}`;

const QUESTION_GENERATION_PROMPT = `You are generating conversational questions to infer how well each option satisfies each criterion.

CRITICAL RULES:
1. NEVER ask the user to provide a numerical rating (e.g., "On a scale of 1-5...").
2. ALWAYS prioritize COMPARATIVE questions (e.g., "How does Option A compare to your current situation/Option B regarding Criterion X?").
3. Focus ONLY on satisfaction/performance.
4. BE EFFICIENT: Do NOT ask separate questions for different options if they can be compared in one question.
5. Each question must be unique and have a clear purpose.
6. Total budget is strict: generate EXACTLY {budget} questions.

Using web facts:
If you are provided with web facts, create questions that incorporate them naturally.

Output JSON array of questions:
[
  {
    "id": "q1",
    "text": "...",
    "question_type": "comparative",
    "relates_to": { "options": ["Option A", "Option B"], "criterion": "Criterion X" }
  }
]`;

const INFERENCE_PROMPT = `Based on the user's responses to the elicitation questions, infer the rating matrix.

For each option-criterion pair, assign a rating from 1-5:
- 1 = Very Low satisfaction
- 5 = Very High satisfaction

Return JSON format:
{
  "ratings": {
    "Option A": { "Criterion 1": 4, ... },
    "Option B": { "Criterion 1": 2, ... }
  },
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}`;

function detectAbstractness(options) {
    return options.every(opt =>
        /^(option|choice|job|alternative|candidate)\s*[a-z0-9]*$/i.test(opt.trim())
    );
}

function calculateQuestionBudget(numCriteria, numOptions) {
    // Force efficiency: Exactly one comparative question per criterion.
    return numCriteria;
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

    // Smart context selection: Only include specialized context for relevant criteria
    let dynamicContext = "";
    const critLower = criterion.toLowerCase();

    // Proximity/Family logic
    if (critLower.includes('family') || critLower.includes('proximity') || critLower.includes('distance') || critLower.includes('travel')) {
        const familyLoc = context.family_location || context.home_location;
        if (familyLoc) dynamicContext = `from ${familyLoc}`;
    }

    // Position context for work/money
    else if (context.current_position && (critLower.includes('salary') || critLower.includes('career') || critLower.includes('professional') || critLower.includes('job') || critLower.includes('work'))) {
        dynamicContext = `${context.current_position}`;
    }

    if (cleanOptions.length >= 2 && criterion) {
        return `${cleanOptions.join(' vs ')} ${criterion} ${dynamicContext}`.trim();
    } else if (cleanOptions.length === 1 && criterion) {
        return `${cleanOptions[0]} ${criterion} ${dynamicContext}`.trim();
    }
    return null;
}

async function enrichQuestionsWithFacts(questions, options, criteria, context = {}) {
    const seenQueries = new Set();
    return await Promise.all(questions.map(async (q) => {
        try {
            const searchQuery = generateSearchQuery(q, options, criteria, context);
            if (searchQuery && !seenQueries.has(searchQuery)) {
                seenQueries.add(searchQuery);
                const results = await performWebSearch(searchQuery);
                if (results && results.length > 0) {
                    const ctxSummary = Object.entries(context)
                        .map(([k, v]) => `${k}: ${v}`).join(', ');

                    const SYNTHESIS_PROMPT = `Analyze these search results for: "${q.text}".
                    
                    Search Results: ${results.map(r => r.snippet).join(' ')}
                    User Profile: {${ctxSummary}}
                    
                    Provide 3-5 concise bullet points based ONLY on the provided results.
                    
                    CRITICAL TRUTH RULES:
                    1. NO FILLER: Do NOT start with "Here is...", "Based on...". Start immediately with bullets.
                    2. NO HALLUCINATIONS: Do NOT invent numbers, percentages, or indices. Use ONLY factual data from results.
                    3. SOURCE-ONLY: If the results say a city is "#1 most expensive," use that. Do NOT transform it into a confusing index.
                    4. LOGIC CHECK: Ensure travel, time zones, and citizenship logic is 100% accurate based on the User Profile.
                    5. Format with dash (-) for bullets.`;

                    const summaryResult = await model.generateContent(SYNTHESIS_PROMPT);
                    let finalSummary = summaryResult.response.text().trim();

                    // Force removal of conversational filler/intro lines at the code level
                    finalSummary = finalSummary
                        .replace(/^(here's|here is|according|based|sure|okay|l've|based on then search results).*?(:|\n)/i, '')
                        .split('\n')
                        .filter(l => l.trim().length > 5)
                        .map(l => l.trim().startsWith('-') ? l.trim() : `- ${l.trim().replace(/^[\*•]\s*/, '')}`)
                        .join('\n');

                    return {
                        ...q,
                        webFacts: {
                            summary: finalSummary || results[0].snippet,
                            sources: results.map(r => ({ title: r.title, url: r.url }))
                        }
                    };
                }
            }
        } catch (e) { console.error('Enrich error:', e); }
        return q;
    }));
}

export async function POST(request) {
    try {
        const { mode, options, criteria, weights, context, responses, description } = await request.json();

        if (mode === 'analyze_context') {
            if (detectAbstractness(options)) {
                return NextResponse.json({ needs_more_context: false });
            }
            const prompt = `Dilemma: "${description}"\nOptions: ${JSON.stringify(options)}\nCriteria: ${JSON.stringify(criteria)}`;
            const result = await model.generateContent([{ text: CONTEXT_ANALYSIS_PROMPT }, { text: prompt }]);
            return NextResponse.json(parseJsonFromResponse(result.response.text()));
        }

        if (mode === 'generate_questions') {
            const budget = calculateQuestionBudget(criteria.length, options.length);
            const prompt = `Options: ${JSON.stringify(options)}\nCriteria: ${JSON.stringify(criteria)}\nContext: ${JSON.stringify(context || {})}\nDescription: ${description}`;
            const result = await model.generateContent([
                { text: QUESTION_GENERATION_PROMPT.replace('{budget}', budget) },
                { text: prompt }
            ]);
            const questions = parseJsonFromResponse(result.response.text());
            const enriched = await enrichQuestionsWithFacts(Array.isArray(questions) ? questions : [], options, criteria, context || {});
            return NextResponse.json({ questions: enriched, budget });
        }

        if (mode === 'infer_ratings') {
            const prompt = `Options: ${JSON.stringify(options)}\nCriteria: ${JSON.stringify(criteria)}\nResponses: ${JSON.stringify(responses, null, 2)}`;
            const result = await model.generateContent([{ text: INFERENCE_PROMPT }, { text: prompt }]);
            const inference = parseJsonFromResponse(result.response.text());
            const ratings = {};
            options.forEach(opt => {
                ratings[opt] = {};
                criteria.forEach(crit => { ratings[opt][crit] = inference.ratings?.[opt]?.[crit] || 3; });
            });
            return NextResponse.json({ ratings, confidence: inference.confidence || 0.7 });
        }
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

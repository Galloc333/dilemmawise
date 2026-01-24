import { model, parseJsonFromResponse } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CONTEXT_ANALYSIS_PROMPT = `You are a precision logic agent. You need to gather missing objective facts to power a web search.

Your task:
1. Examine the Options, Criteria, and Description.
2. Identify OBJECTIVE facts missing (e.g., "Exact budget in NIS", "Current city", "Specific software used").
3. CRITICAL: NEVER ask about the "importance" of a criterion or "how much you care" about something. The user already weighted their criteria.
4. DO NOT ask subjective preference questions (e.g., "Do you prefer big screens?").
5. Only ask for 1-3 critical data points that will change the web search results.

Output JSON:
{
  "already_known_context": { "field_name": "value" } or null,
  "needs_more_context": true,
  "questions": [
    { "field": "f", "question": "q", "reason": "r" }
  ]
}`;

const QUESTION_GENERATION_PROMPT = `You are generating conversational questions to infer how well each option satisfies each criterion.

CRITICAL RULES:
1. NEVER ask the user to provide a numerical rating (e.g., "On a scale of 1-5...").
2. ALWAYS prioritize COMPARATIVE questions (e.g., "How does Option A compare to Option B regarding Criterion X?").
3. DO NOT repeat user profile details (like budget, location, or intended uses) in the question text. Use them only to make the query relevant.
4. Keep questions concise and natural.
5. Total budget is strict: generate EXACTLY {budget} questions.

Using web facts:
If you are provided with web facts, create questions that incorporate them naturally without repeating known facts.

Output JSON array of questions:
[
  {
    "id": "q1",
    "text": "...",
    "question_type": "comparative",
    "relates_to": { "options": ["Option A", "Option B"], "criterion": "Criterion X" },
    "glossary": { "Term": "Simple explanation of the term" }
  }
]`;

const INFERENCE_PROMPT = `Based on user responses, infer the rating matrix (1-5).
Return JSON structure with "ratings" and "confidence".`;

function detectAbstractness(options) {
    return options.every(opt =>
        /^(option|choice|job|alternative|candidate)\s*[a-z0-9]*$/i.test(opt.trim())
    );
}

function calculateQuestionBudget(numCriteria, numOptions) {
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

                    const SYNTHESIS_PROMPT = `Analyze results for "${q.text}". 
                    Profile: ${ctxSummary}. 
                    Results: ${results.map(r => r.snippet).join(' ')}. 
                    
                    Provide a JSON object ONLY:
                    { 
                      "chart_title": "Comparison of [Metric] (e.g., Performance in Gaming)",
                      "chart_data": [{ "label": "Option Name", "value": number, "unit": "% or ₪ or ms" }], 
                      "takeaway": "1 sentence explanation of the chart. If using percentages, explain what 100% represents (e.g., '100% represents top-tier benchmark performance').",
                      "bullet_points": ["fact 1", ...]
                    }
                    Rules:
                    1. CHART LABELS: Must be the names of the Options being compared (e.g., "IdeaPad", "Victus"). 
                    2. TRUTH: NO HALLUCINATIONS. If you don't find exact numbers, do NOT provide chart_data.
                    3. CONCISE: Avoid filler. Use clear, spaced logic.`;

                    const summaryResult = await model.generateContent(SYNTHESIS_PROMPT);
                    const data = parseJsonFromResponse(summaryResult.response.text());

                    return {
                        ...q,
                        webFacts: data ? {
                            summary: data.bullet_points?.map(b => `- ${b}`).join('\n') || '',
                            takeaway: data.takeaway,
                            chartData: data.chart_data,
                            chartTitle: data.chart_title,
                            sources: results.map(r => ({ title: r.title, url: r.url }))
                        } : {
                            summary: results[0].snippet,
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

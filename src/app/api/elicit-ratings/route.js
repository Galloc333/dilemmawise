import { generateWithRetry, parseJsonFromResponse } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CONTEXT_ANALYSIS_PROMPT = `You are a precision logic agent. Your goal is to gather the exact context needed to power a deep, research-heavy comparison.

Your task:
1. **Fact Extraction**: Analyze the Dilemma Question and Description. Extract every objective fact mentioned or logically certain.
2. **Identify Informative Gaps**: Find missing data points that are CRITICAL to the specific criteria. 
   - If "Career Growth" is a criterion, ask about "Current role/field".
   - If "Cost of Living" is a criterion, ask about "Current salary/budget".
   - If "Lifestyle" or "Culture" is a criterion, ask about "Specific hobbies or personal priorities" (e.g., "What kind of entertainment or social scene do you love?").
3. **Budget**: You can ask up to 3-4 highly relevant questions to ensure the comparison is data-rich.
4. **CRITICAL**: Do NOT ask for facts already extracted.

Output JSON:
{
  "already_known_context": { "current_city": "London" },
  "needs_more_context": true,
  "questions": [
    { "field": "personal_interests", "question": "What kind of lifestyle or social activities are most important to you?", "reason": "To tailored the culture/lifestyle research." }
  ]
}`;

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
            if (searchQuery && !seenQueries.has(searchQuery)) {
                seenQueries.add(searchQuery);
                const results = await performWebSearch(searchQuery);
                if (results && results.length > 0) {
                    const ctxSummary = Object.entries(context)
                        .map(([k, v]) => `${k}: ${v}`).join(', ');

                    const SYNTHESIS_PROMPT = `Analyze search results for the criterion "${q.relates_to.criterion}". 
                    
                    USER INTENT:
                    - Core Dilemma: ${dilemma}
                    - Initial Description: ${description}
                    - User Profile Stats: ${ctxSummary}
                    
                    SEARCH RESULTS:
                    ${results.map(r => r.snippet).join('\n')}
                    
                    OPTIONS TO COMPARE: ${JSON.stringify(options)}
                    
                    Provide a JSON object ONLY:
                    { 
                      "charts": [
                        {
                          "chart_type": "bar" | "comparison_table" | "scale" | "pie" | "none",
                          "chart_title": "Title describing the metric",
                          "chart_data": [{ "label": "Option Name", "value": number, "unit": "..." }]
                        }
                      ],
                      "takeaway": "Direct explanation of how these options perform FOR THIS USER'S SPECIFIC NEEDS. Use 2nd person.",
                      "bullet_points": ["fact 1", "fact 2", "fact 3"]
                    }
                    
                    CHART RULES:
                    1. CHOOSE THE RIGHT CHART TYPE:
                       - "bar": For comparing numeric values (prices, speeds, ratings)
                       - "comparison_table": For comparing 2-3 attributes side by side
                       - "scale": For showing where options fall on a spectrum (e.g., battery life: short to long)
                       - "pie": For showing proportions or percentages
                       - "none": When data is qualitative or doesn't benefit from visualization
                    
                    2. MULTIPLE CHARTS (up to 3): Only include multiple charts if the criterion is broad and different aspects need different visualizations. Most criteria need just 1 chart. Don't overload the user.
                    
                    3. NUMERIC DATA ONLY: Only create charts if you have actual numeric values. Never chart qualitative adjectives.
                    
                    4. BE SPECIFIC to the User Intent.
                    
                    5. STRICT LIMIT: exactly 3 bullet points.
                    
                    6. VOICE: Speak directly to the user.`;

                    const summaryResult = await generateWithRetry(SYNTHESIS_PROMPT);
                    const data = parseJsonFromResponse(summaryResult.response.text());

                    return {
                        ...q,
                        webFacts: data ? {
                            summary: data.bullet_points?.map(b => `- ${b}`).join('\n') || '',
                            takeaway: data.takeaway,
                            charts: data.charts || (data.chart_data ? [{
                                chart_type: 'bar',
                                chart_title: data.chart_title,
                                chart_data: data.chart_data
                            }] : []),
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
        const { mode, options, criteria, weights, context, responses, description, dilemma } = await request.json();

        if (mode === 'analyze_context') {
            if (detectAbstractness(options)) {
                return NextResponse.json({ needs_more_context: false });
            }
            const prompt = `Dilemma Question: "${dilemma || description}"\nInitial Description: "${description}"\nOptions: ${JSON.stringify(options)}\nCriteria: ${JSON.stringify(criteria)}`;
            const result = await generateWithRetry([{ text: CONTEXT_ANALYSIS_PROMPT }, { text: prompt }]);
            const data = parseJsonFromResponse(result.response.text());

            if (data && data.questions && data.already_known_context) {
                const knownFields = Object.keys(data.already_known_context);
                data.questions = data.questions.filter(q => !knownFields.includes(q.field));
                if (data.questions.length === 0) data.needs_more_context = false;
            }
            return NextResponse.json(data);
        }

        if (mode === 'generate_questions') {
            const budget = calculateQuestionBudget(criteria.length, options.length);
            const prompt = `Core Dilemma: "${dilemma || description}"\nHistory/Description: "${description}"\nOptions: ${JSON.stringify(options)}\nCriteria: ${JSON.stringify(criteria)}\nContext: ${JSON.stringify(context || {})}`;
            const result = await generateWithRetry([
                { text: QUESTION_GENERATION_PROMPT.replace('{budget}', budget) },
                { text: prompt }
            ]);
            const questions = parseJsonFromResponse(result.response.text());
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
            const prompt = `Convert these 1-10 user ratings into a final 1-5 rating matrix.
            Options: ${JSON.stringify(options)}
            Criteria: ${JSON.stringify(criteria)}
            User Responses (JSON): ${JSON.stringify(responses, null, 2)}`;

            const result = await generateWithRetry([{ text: INFERENCE_PROMPT }, { text: prompt }]);
            const inference = parseJsonFromResponse(result.response.text());

            const ratings = {};
            options.forEach(opt => {
                ratings[opt] = {};
                criteria.forEach(crit => {
                    ratings[opt][crit] = inference.ratings?.[opt]?.[crit] || 3;
                });
            });
            return NextResponse.json({ ratings, reasoning: inference.reasoning, confidence: inference.confidence || 1.0 });
        }
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

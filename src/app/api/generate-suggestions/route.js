import { generateWithRetry, parseJsonFromResponse } from "@/lib/gemini";
import { NextResponse } from "next/server";

const SUGGESTIONS_PROMPT = `You are a decision analysis expert. Based on the user's completed decision analysis, generate helpful suggestions for three categories:

## DECISION CONTEXT:
- **Dilemma**: {dilemma}
- **Options Evaluated**: {options}
- **Criteria Used**: {criteria}
- **Winner**: {winner}
- **User Context**: {userContext}

## YOUR TASK:
Generate THREE types of suggestions based on this specific decision context:

### 1. OTHER OPTIONS (3-5 alternative options)
Suggest other options the user might not have considered that are relevant to their dilemma.
- Must be SPECIFIC to the dilemma domain (not generic)
- Consider the user's context (budget, preferences, constraints)
- Mix of comparable alternatives (similar category) and creative alternatives (different approach)
- Examples based on dilemma type:
  * Smartphones → specific brands/models not considered
  * Vacation → specific destination types or travel styles
  * Career → specific job roles or career paths

### 2. MISSING CRITERIA (3-5 additional criteria)
Suggest important criteria they didn't evaluate but might matter for this type of decision.
- Must be relevant to the specific options/dilemma
- Don't repeat criteria they already used
- Focus on commonly overlooked but important factors
- Examples: long-term value, ease of use, community/support, environmental impact, learning curve

### 3. FOLLOW-UP DILEMMAS (3-6 next-step questions)
Suggest logical follow-up decisions that come after choosing the winner.
- Must build naturally from the winning option
- Should be concrete and actionable
- Format as questions or decisions
- Examples based on winner:
  * Won: iPhone → "Which storage size?", "Where to buy?", "Which accessories?", "AppleCare or insurance?"
  * Won: Beach vacation → "Which specific beach destination?", "Best time to travel?", "All-inclusive or independent?", "Activities to book?"
  * Won: Job offer → "Negotiate salary?", "Relocation planning?", "When to start?", "Benefits to optimize?"

## OUTPUT FORMAT (MUST BE VALID JSON):
\`\`\`json
{
  "otherOptions": [
    "Specific option 1",
    "Specific option 2",
    "Specific option 3"
  ],
  "missingCriteria": [
    "Criterion 1",
    "Criterion 2",
    "Criterion 3"
  ],
  "followUpDilemmas": [
    "Follow-up question 1?",
    "Follow-up question 2?",
    "Follow-up question 3?"
  ]
}
\`\`\`

## CRITICAL RULES:
1. Be SPECIFIC to the actual dilemma - no generic suggestions
2. Base suggestions on the actual options, criteria, and winner
3. Consider the user's context (budget, preferences, location, etc.)
4. Each suggestion should be concise (max 6-8 words)
5. Output ONLY valid JSON, no additional text
6. All three arrays must have at least 3 items each
`;

export async function POST(request) {
    try {
        const { dilemma, options, criteria, winner, weights, userContext } = await request.json();

        // Format user context for prompt
        const contextStr = userContext && Object.keys(userContext).length > 0
            ? Object.entries(userContext)
                .filter(([_, v]) => v && v !== 'null')
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                .join(', ')
            : 'None provided';

        const prompt = SUGGESTIONS_PROMPT
            .replaceAll('{dilemma}', dilemma || 'Decision analysis')
            .replaceAll('{options}', options?.join(', ') || 'N/A')
            .replaceAll('{criteria}', criteria?.join(', ') || 'N/A')
            .replaceAll('{winner}', winner || 'N/A')
            .replaceAll('{userContext}', contextStr);

        const result = await generateWithRetry(prompt);
        
        // Safely extract text from response
        let text = '';
        try {
            text = result.response.text();
        } catch (textError) {
            console.error('[generate-suggestions] Failed to extract text from response:', textError);
            throw new Error('Failed to extract text from LLM response');
        }

        // Parse JSON with robust error handling
        let parsed = {};
        try {
            parsed = parseJsonFromResponse(text);
        } catch (parseError) {
            console.error('[generate-suggestions] JSON parse failed:', parseError);
            console.error('[generate-suggestions] Raw response text:', text.substring(0, 500));
            // Continue with empty parsed object - will use fallback arrays below
        }

        // Validate structure and ensure arrays
        const otherOptions = Array.isArray(parsed.otherOptions) ? parsed.otherOptions : [];
        const missingCriteria = Array.isArray(parsed.missingCriteria) ? parsed.missingCriteria : [];
        const followUpDilemmas = Array.isArray(parsed.followUpDilemmas) ? parsed.followUpDilemmas : [];

        console.log(`[generate-suggestions] Generated: ${otherOptions.length} options, ${missingCriteria.length} criteria, ${followUpDilemmas.length} dilemmas`);

        // Return validated arrays
        return NextResponse.json({
            otherOptions,
            missingCriteria,
            followUpDilemmas
        });

    } catch (error) {
        console.error('[generate-suggestions] Fatal error:', error);
        
        // Return empty arrays as fallback
        return NextResponse.json({
            otherOptions: [],
            missingCriteria: [],
            followUpDilemmas: []
        });
    }
}

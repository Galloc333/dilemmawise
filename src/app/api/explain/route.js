import { model } from "@/lib/gemini";
import { NextResponse } from "next/server";

const EXPLAIN_PROMPT = `You are an AI that explains decision analysis results in a clear, structured, and human-friendly way.

CRITICAL GUIDELINES:
- Base your explanation ONLY on the provided data below
- Do NOT add external knowledge, assumptions, or opinions
- Do NOT hallucinate or invent facts
- ONLY reference the actual scores, weights, and rankings provided

IMPORTANT - Translate numbers to natural language:
- Weight 1 = "not important to you"
- Weight 2 = "slightly important to you"
- Weight 3 = "moderately important to you"  
- Weight 4 = "quite important to you"
- Weight 5 = "very important to you" / "a top priority"
- Score 1 = "performed poorly"
- Score 2 = "performed below average"
- Score 3 = "performed adequately"
- Score 4 = "performed well"
- Score 5 = "excelled" / "performed excellently"

Given the following decision analysis results:
- Is there a tie? {hasTie}
- Winner/Tied Options: {winner} (total score: {winnerScore})
- Full Ranking: {ranking}
- User's Criteria Weights (1-5 scale): {weights}
- How each option scored on each criterion (1-5 scale): {scores}

Generate two explanations:

{tieInstructions}

Make "whyItWon" around 4-6 sentences with clear structure. Use bullet points (•) for lists within the text.
Make "whatCouldChange" 2-3 sentences.

Respond in JSON format:
{
  "whyItWon": "...",
  "whatCouldChange": "..."
}
`;

const NO_TIE_INSTRUCTIONS = `1. "whyItWon" - A beautifully structured, spaced-out explanation:
   - SUMMARY: One bold sentence.
   - [Double Newline]
   - YOUR TOP PRIORITIES: Explain how it met your top 2-3 weights.
   - [Double Newline]
   - KEY ADVANTAGES: Explain why it beat the others.
   - USE SECOND PERSON (You/Your). Use double newlines for spacing.

2. "whatCouldChange" - One key trade-off that could flip the result.`;

const TIE_INSTRUCTIONS = `1. "whyItWon" - Explain why they tied:
   - SUMMARY: Acknowledge the tie.
   - [Double Newline]
   - BALANCE: Explain how priorities balanced out.
   - [Double Newline]
   - DIFFERENCES: Strength of each.
   - Use double newlines for spacing.

2. "whatCouldChange" - How to break the tie.`;

export async function POST(request) {
    try {
        const { winner, ranking, weights, scores, hasTie, tiedWinners } = await request.json();

        const winnerDisplay = hasTie
            ? tiedWinners.map(w => w.option).join(' and ')
            : winner.option;

        const prompt = EXPLAIN_PROMPT
            .replace("{hasTie}", hasTie ? "Yes - multiple options tied for first place" : "No - there is a clear winner")
            .replace("{winner}", winnerDisplay)
            .replace("{winnerScore}", winner.score.toFixed(1))
            .replace("{ranking}", JSON.stringify(ranking))
            .replace("{tieInstructions}", hasTie ? TIE_INSTRUCTIONS : NO_TIE_INSTRUCTIONS)
            .replace("{weights}", JSON.stringify(weights))
            .replace("{scores}", JSON.stringify(scores));

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            // Try to parse JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return NextResponse.json({
                    whyItWon: parsed.whyItWon || "This option scored highest based on your priorities.",
                    whatCouldChange: parsed.whatCouldChange || "Try adjusting your criteria weights to see how results might change."
                });
            }
        } catch (parseError) {
            console.error("Failed to parse explanation:", parseError);
        }

        // Fallback response
        return NextResponse.json({
            whyItWon: `${winner.option} emerged as your top choice because it best aligns with how you weighted your priorities.`,
            whatCouldChange: "If you valued some of your lower-weighted criteria more, the results might shift. Consider if any trade-offs feel worth reconsidering."
        });
    } catch (error) {
        console.error("Explain API Error:", error);
        return NextResponse.json(
            { error: "Failed to generate explanation" },
            { status: 500 }
        );
    }
}

import { generateWithRetry } from "@/lib/gemini";
import { NextResponse } from "next/server";

const QA_PROMPT = `You are an AI assistant helping a user understand their decision analysis results.

Context about their decision:
- Winner: {winner} (score: {winnerScore})
- Full Ranking: {ranking}
- Their Criteria Weights: {weights}
- How options scored on each criterion: {scores}

The user has a question about these results. Answer it helpfully and concisely (2-4 sentences).
Be conversational and supportive. If they ask about something not in the data, politely explain what you can help with.

User's question: {question}
`;

export async function POST(request) {
    try {
        const { question, context } = await request.json();
        const { winner, ranking, weights, scores } = context;

        const prompt = QA_PROMPT
            .replace("{winner}", winner.option)
            .replace("{winnerScore}", winner.score.toFixed(1))
            .replace("{ranking}", JSON.stringify(ranking))
            .replace("{weights}", JSON.stringify(weights))
            .replace("{scores}", JSON.stringify(scores))
            .replace("{question}", question);

        const result = await generateWithRetry(prompt);
        const responseText = result.response.text();

        return NextResponse.json({
            answer: responseText
        });
    } catch (error) {
        console.error("QA API Error:", error);
        return NextResponse.json(
            { error: "Failed to generate answer" },
            { status: 500 }
        );
    }
}

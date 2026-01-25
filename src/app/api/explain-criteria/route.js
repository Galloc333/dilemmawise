import { generateWithRetry, parseJsonFromResponse } from "@/lib/gemini";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an AI assistant for a decision-making app.
Your task is to provide short, helpful tooltips for decision criteria.

For each criterion, write a 1-2 sentence explanation that:
1. Explains what this criterion means in practical terms
2. Clarifies the 1-10 scale: 10 = "I care a lot about this", 1 = "I care very little about this"
3. Does NOT reference or compare to other criteria

Example:
Input: ["Commute", "Salary", "Risk"]
Output:
{
  "Commute": "How much does travel time matter to you? Rate 10 if you strongly value a short commute, or 1 if distance doesn't concern you much.",
  "Salary": "How important is income? Rate 10 if maximizing pay is crucial, or 1 if you'd happily trade money for other benefits.",
  "Risk": "How much do you value stability and safety? Rate 10 if security is essential, or 1 if you're comfortable with uncertainty."
}

Return ONLY the JSON object.
`;


export async function POST(request) {
    try {
        const { criteria } = await request.json();

        if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
            return NextResponse.json({});
        }

        const prompt = `Criteria to explain: ${JSON.stringify(criteria)}`;

        const result = await generateWithRetry([
            { text: SYSTEM_PROMPT },
            { text: prompt }
        ]);

        const text = result.response.text();
        const explanations = parseJsonFromResponse(text);

        return NextResponse.json(explanations);
    } catch (error) {
        console.error("Explain Criteria Error:", error);
        return NextResponse.json({}, { status: 500 });
    }
}

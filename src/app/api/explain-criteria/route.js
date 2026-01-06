import { model, parseJsonFromResponse } from "@/lib/gemini";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an AI assistant for a decision-making app.
Your task is to provide short, helpful tooltips for decision criteria.
For each criterion provided, write a specific 1-sentence explanation of what it means to weight this criterion "High".
Focus on the *implication* or *value* (e.g., lower cost, faster speed, better quality).

Example:
Input: ["Commute", "Salary", "Risk"]
Output:
{
  "Commute": "Weight this high if a short travel time is very important to you.",
  "Salary": "Weight this high if maximizing your income is a top priority.",
  "Risk": "Weight this high if you strongly prefer a safe and secure option."
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

        const result = await model.generateContent([
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

import { model, parseJsonFromResponse } from "@/lib/gemini";
import { NextResponse } from "next/server";

const EXTRACTION_PROMPT = `You are an AI assistant helping users structure complex decisions.

Analyze the user's dilemma description and extract:
1. OPTIONS: The distinct alternatives/choices they are considering (e.g., "Job A", "Job B")
2. CRITERIA: The factors that matter to them for this decision (e.g., "Salary", "Work-Life Balance")

Rules:
- Extract at least 2 options if the description is clear enough
- Extract at least 1 criteria based on what's mentioned or implied
- If the description is too vague or unclear to extract options, set isVague to true
- Option names should be concise but descriptive
- Criteria should be single words or short phrases

CRITICAL - ANTI-HALLUCINATION:
- ONLY extract options and criteria that are EXPLICITLY mentioned in the text
- Do NOT infer, assume, or add criteria that are implied but not stated
- Do NOT add common criteria that "make sense" for this type of decision
- If the user mentions "salary, work-life balance, growth" extract ONLY those 3 - nothing more
- If the description is too vague or unclear to extract options, set isVague to true
- Option names should be concise but descriptive
- Criteria should be single words or short phrases

Respond ONLY with valid JSON in this exact format:
{
  "options": ["Option A", "Option B"],
  "criteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
  "isVague": false
}

User's dilemma description:
`;

export async function POST(request) {
    try {
        const { description } = await request.json();

        if (!description || description.trim().length < 10) {
            return NextResponse.json({
                options: [],
                criteria: [],
                isVague: true
            });
        }

        const prompt = EXTRACTION_PROMPT + description;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            const parsed = parseJsonFromResponse(responseText);

            // Validate the response structure
            return NextResponse.json({
                options: Array.isArray(parsed.options) ? parsed.options : [],
                criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
                isVague: parsed.isVague === true || parsed.options?.length < 2
            });
        } catch (parseError) {
            console.error("Failed to parse LLM response:", parseError);
            return NextResponse.json({
                options: [],
                criteria: [],
                isVague: true
            });
        }
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: "Failed to analyze input" },
            { status: 500 }
        );
    }
}

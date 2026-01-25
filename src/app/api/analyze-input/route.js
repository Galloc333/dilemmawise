import { generateWithRetry, parseJsonFromResponse } from "@/lib/gemini";
import { NextResponse } from "next/server";

const EXTRACTION_PROMPT = `You are an AI assistant helping users structure complex decisions.

Analyze the user's dilemma description and extract:
1. OPTIONS: The distinct alternatives/choices they are considering (e.g., "iPhone 14 Pro Max", "Samsung Galaxy S23")
2. CRITERIA: The factors that matter to them for this decision (e.g., "Price", "Battery Life", "Camera")
3. USER CONTEXT: Any personal details that might be relevant (budget, location, timeline, constraints, preferences)
4. SUMMARIZED DILEMMA: A concise one-line question capturing the core decision (e.g., "Which phone should I buy?")

Rules:
- Extract options and criteria ONLY if EXPLICITLY mentioned
- Do NOT infer or add criteria that are not stated
- For user context, extract any personal details like budget amounts, locations, timeframes, constraints
- The summarized dilemma should be a simple question without listing options or criteria
- Correct obvious spelling mistakes in extracted items (e.g., "Samsunf" → "Samsung")

Respond ONLY with valid JSON in this exact format:
{
  "options": ["Option A", "Option B"],
  "criteria": ["Criterion 1", "Criterion 2"],
  "userContext": {
    "budget": "extracted budget or null",
    "currency": "ILS/USD/EUR or null",
    "location": "extracted location or null",
    "timeline": "extracted timeline or null",
    "constraints": ["any constraints mentioned"],
    "preferences": ["any preferences mentioned"],
    "otherDetails": "any other relevant personal details"
  },
  "summarizedDilemma": "A simple one-line question like 'Which phone should I buy?'",
  "isVague": false,
  "isOverlyDetailed": true
}

Set isOverlyDetailed to true if the user provided options, criteria, or extensive context in their initial description.

User's dilemma description:
`;

export async function POST(request) {
    try {
        const { description } = await request.json();

        if (!description || description.trim().length < 10) {
            return NextResponse.json({
                options: [],
                criteria: [],
                userContext: {},
                summarizedDilemma: "",
                isVague: true,
                isOverlyDetailed: false
            });
        }

        const prompt = EXTRACTION_PROMPT + description;
        const result = await generateWithRetry(prompt);
        const responseText = result.response.text();

        try {
            const parsed = parseJsonFromResponse(responseText);

            // Clean up and validate user context
            const userContext = parsed.userContext || {};

            // Remove null values from userContext
            Object.keys(userContext).forEach(key => {
                if (userContext[key] === null || userContext[key] === "null" || userContext[key] === "") {
                    delete userContext[key];
                }
            });

            // Validate the response structure
            return NextResponse.json({
                options: Array.isArray(parsed.options) ? parsed.options : [],
                criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
                userContext: userContext,
                summarizedDilemma: parsed.summarizedDilemma || "",
                isVague: parsed.isVague === true || (parsed.options?.length < 2 && !parsed.summarizedDilemma),
                isOverlyDetailed: parsed.isOverlyDetailed === true
            });
        } catch (parseError) {
            console.error("Failed to parse LLM response:", parseError);
            return NextResponse.json({
                options: [],
                criteria: [],
                userContext: {},
                summarizedDilemma: "",
                isVague: true,
                isOverlyDetailed: false
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

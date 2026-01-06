import { model } from "@/lib/gemini";
import { NextResponse } from "next/server";

const CHAT_SYSTEM_PROMPT = `You are an AI decision coach helping users structure their decision-making process.

Current context:
- Options being considered: {options}
- Criteria identified: {criteria}

Your Goal: Help the user define at least 2 distinct options and at least 1 criterion.

Rules:
1. **Validation**: 
   - If the user has < 2 options, you MUST ask them what alternatives they are considering.
   - If the user has < 1 criterion, you MUST ask them what factors are important (e.g., cost, speed, feeling).
   - Do NOT suggest proceeding until these conditions are met.

2. **Extraction**:
   - ACTIVELY look for options and criteria in the user's messages.
   - If the user implies an option (e.g., "I might go to Paris"), extract it.

3. **Tone**:
   - Be warm, concise, and helpful.
   - Don't lecture. Just guide them naturally.

CRITICAL INSTRUCTION:
You MUST end EVERY response with a JSON block containing the specific options and criteria identified in the conversation so far, including any you just found.
The user will NOT see this JSON block, so do not worry about cluttering the chat.

Format:
\`\`\`json
{
  "suggestedOptions": ["Option A", "Option B"],
  "suggestedCriteria": ["Criterion A", "Criterion B"]
}
\`\`\`
If no valid options/criteria are present yet, return empty arrays.
`;

export async function POST(request) {
    try {
        const { messages, currentOptions, currentCriteria } = await request.json();

        // Build the context
        const systemPrompt = CHAT_SYSTEM_PROMPT
            .replace("{options}", currentOptions?.join(", ") || "None yet")
            .replace("{criteria}", currentCriteria?.join(", ") || "None yet");

        // Build conversation history for Gemini
        const conversationParts = [
            { text: systemPrompt },
            ...messages.map(msg => ({
                text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`
            }))
        ];

        const result = await model.generateContent(conversationParts.map(p => p.text).join("\n\n"));
        let responseText = result.response.text();

        // Try to extract any suggested options or criteria from the response
        const suggestedOptions = [];
        const suggestedCriteria = [];

        // 1. Try to extract JSON block
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                if (Array.isArray(data.suggestedOptions)) {
                    suggestedOptions.push(...data.suggestedOptions);
                }
                if (Array.isArray(data.suggestedCriteria)) {
                    suggestedCriteria.push(...data.suggestedCriteria);
                }

                // Remove the JSON block from the text shown to user so it looks clean
                responseText = responseText.replace(jsonMatch[0], '').trim();
            } catch (e) {
                console.error("Failed to parse extracted JSON:", e);
            }
        }

        // 2. Fallback: Simple regex pattern matching in case the LLM ignores JSON instructions
        if (suggestedOptions.length === 0 && suggestedCriteria.length === 0) {
            // Regex to match "adding [X] as an option/alternative"
            // Handles both quoted and unquoted: adding 'Foo'..., adding Foo...
            const optionMatches = [...responseText.matchAll(/adding\s+(?:["']([^"']+)["']|([^"'\s,]+))\s+as an (?:option|alternative)/gi)];
            optionMatches.forEach(match => {
                const val = match[1] || match[2]; // match[1] is quoted group, match[2] is unquoted group
                if (val) suggestedOptions.push(val);
            });

            // Regex to match "consider [X] as a factor/criterion"
            const criteriaMatches = [...responseText.matchAll(/consider\s+(?:["']([^"']+)["']|([^"'\s,]+))\s+as a (?:factor|criterion)/gi)];
            criteriaMatches.forEach(match => {
                const val = match[1] || match[2];
                if (val) suggestedCriteria.push(val);
            });
        }

        return NextResponse.json({
            response: responseText,
            suggestedOptions,
            suggestedCriteria
        });
    } catch (error) {
        console.error("Chat API Error:", error);
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}

import { model } from "@/lib/gemini";
import { NextResponse } from "next/server";

const CHAT_SYSTEM_PROMPT = `You are an AI decision coach helping users structure their decision-making process.

Current context:
- Options being considered: {options}
- Criteria identified: {criteria}

Your role:
1. Help the user clarify their options and criteria
2. Suggest additional options or criteria when asked
3. Guide them through the decision-structuring process
4. Be warm, supportive, and conversational

When suggesting new options or criteria, clearly indicate them like:
- "I'd suggest adding [Option Name] as an alternative..."
- "You might want to consider [Criterion Name] as a factor..."

Keep responses concise (2-4 sentences typically).
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
        const responseText = result.response.text();

        // Try to extract any suggested options or criteria from the response
        const suggestedOptions = [];
        const suggestedCriteria = [];

        // Simple pattern matching for suggestions
        const optionMatch = responseText.match(/adding\s+["']?([^"'\n,]+)["']?\s+as an (option|alternative)/gi);
        const criteriaMatch = responseText.match(/consider\s+["']?([^"'\n,]+)["']?\s+as a (factor|criterion)/gi);

        if (optionMatch) {
            optionMatch.forEach(match => {
                const extracted = match.match(/["']([^"']+)["']/);
                if (extracted) suggestedOptions.push(extracted[1]);
            });
        }

        if (criteriaMatch) {
            criteriaMatch.forEach(match => {
                const extracted = match.match(/["']([^"']+)["']/);
                if (extracted) suggestedCriteria.push(extracted[1]);
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

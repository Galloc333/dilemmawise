import { model, parseJsonFromResponse } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const SEARCH_INTENT_PROMPT = `Analyze the user's latest message in the context of their decision.
Does the user need real-world suggestions, price checks, or specific options they haven't mentioned yet?
(e.g., "What are good laptops under $1000?", "Compare iPhone vs Samsung", "Find me a hiking trail in London").

If YES, output a search query. If NO, output null.

Output JSON:
{
  "needsSearch": true/false,
  "searchQuery": "specific search query" or null
}`;

const CHAT_SYSTEM_PROMPT = `You are an AI decision coach. Help the user structure their decision.

STYLE RULES:
- BE CONCISE: Use minimal filler. Get straight to the point.
- CLEAR STRUCTURE: Use paragraphs and bulleted lists (- or 1.) for readability.
- CLICKABLE LINKS: When sharing links, use markdown format: [Site Name](URL).
- EMOJIS: Use subtle emojis to categorize information.

Goal: Define ≥2 options and ≥1 criterion.
Current context: {options} | {criteria}

Rules:
1. Validation: If <2 options or <1 criterion, ask specifically for the missing parts.
2. Exploration: If search results are provided, present specific options as a bulleted list with [Title](URL) links.
3. Extraction: Always end with the JSON block.
`;

export async function POST(request) {
    try {
        const { messages, currentOptions, currentCriteria } = await request.json();
        const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.text;

        // 1. Analyze if web search is needed
        let searchResults = null;
        if (lastUserMessage) {
            const intentResult = await model.generateContent([
                { text: SEARCH_INTENT_PROMPT },
                { text: `Current Conversation:\n${messages.slice(-3).map(m => `${m.role}: ${m.text}`).join('\n')}` }
            ]);
            const intent = parseJsonFromResponse(intentResult.response.text());

            if (intent.needsSearch && intent.searchQuery) {
                searchResults = await performWebSearch(intent.searchQuery);
            }
        }

        // 2. Build the final prompt
        let systemPrompt = CHAT_SYSTEM_PROMPT
            .replace("{options}", currentOptions?.join(", ") || "None yet")
            .replace("{criteria}", currentCriteria?.join(", ") || "None yet");

        if (searchResults && searchResults.length > 0) {
            systemPrompt += `\n\nWEB SEARCH RESULTS FOR YOUR REFERENCE:\n${JSON.stringify(searchResults, null, 2)}\nUse these to provide specific suggestions with links.`;
        }

        // Build conversation parts
        const conversationParts = [
            { text: systemPrompt },
            ...messages.map(msg => ({
                text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`
            }))
        ];

        const result = await model.generateContent(conversationParts.map(p => p.text).join("\n\n"));
        let responseText = result.response.text();

        // 3. Extract metadata and clean text
        const suggestedOptions = [];
        const suggestedCriteria = [];

        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                if (Array.isArray(data.suggestedOptions)) suggestedOptions.push(...data.suggestedOptions);
                if (Array.isArray(data.suggestedCriteria)) suggestedCriteria.push(...data.suggestedCriteria);
                responseText = responseText.replace(jsonMatch[0], '').trim();
            } catch (e) { console.error("JSON extraction error:", e); }
        }

        // Final fallback for empty response
        if (!responseText.trim()) {
            responseText = suggestedOptions.length > 0
                ? "I've added those options to your list. What should we use to compare them?"
                : "I'm listening. Tell me more about the decision you're making.";
        }

        return NextResponse.json({
            response: responseText,
            suggestedOptions,
            suggestedCriteria
        });
    } catch (error) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }
}

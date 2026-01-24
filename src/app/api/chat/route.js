import { model } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CHAT_SYSTEM_PROMPT = `You are DilemmaWise, an AI decision coach. You help users structure decisions by exploring options and criteria.

Current context:
- Options already in structure: {options}
- Criteria already in structure: {criteria}

Rules:
1. **Interactive Suggestions**: 
   - DO NOT automatically add items to the structure.
   - Instead, suggest new options using this syntax: [[Option:Specific Model/Option Name]]
   - Suggest new criteria using this syntax: [[Criterion:Criterion Name]]
   - The user will be able to click these in your message to add them to their structure.
   
2. **Readability**:
   - Use CLEAR paragraph breaks (double newlines) between sections.
   - Use bold headers for better structure.
   
3. **Web Discovery & Limitations**:
   - Use the provided search results to find the most relevant concrete models/offers.
   - If the results contain specific models (e.g., "HP Victus 15"), present them with its features and the store link [Store Name](URL).
   - **HONESTY RULE**: If you cannot find specific, current inventory for a very local request (e.g., "specific deal in Haifa right now"), provide the best broader matches (e.g., models available in major Israeli chains like Ivory or KSP) and politely explain: "אני יכול למצוא דגמים שקיימים ברשתות גדולות שפעילות בחיפה, אבל אין לי גישה למלאי המדויק של כל חנות ברגע זה" (or similar in English).
   
4. **Language**: Respond in the same language as the user (Hebrew/English).

Web Search Results (if any):
{searchResults}

CRITICAL: Even though items are in your text using [[...]], you MUST still provide a HIDDEN JSON block at the very end of your message so the system knows what items you are CURRENTLY suggesting as *new* possibilities.
Format:
\`\`\`json
{
  "newlySuggestedOptions": ["Model A", "Model B"],
  "newlySuggestedCriteria": ["Price", "Performance"]
}
\`\`\`
`;

async function detectSearchNeed(messages) {
    const lastMessage = messages[messages.length - 1].text.toLowerCase();

    // Multi-language keyword detection (English & Hebrew)
    const keywords = [
        'recommend', 'suggest', 'help me find', 'options for', 'best', 'which should i',
        'laptop', 'computer', 'desktop', 'camera', 'phone', 'budget of', 'looking for',
        'תציע', 'תמליץ', 'איזה כדאי', 'מחשב', 'דגמים', 'אופציות', 'תקציב של', 'מחפש',
        'חנות', 'חיפה', 'תל אביב', 'איפה לקנות', 'הצעות'
    ];

    const hasKeyword = keywords.some(k => lastMessage.includes(k));

    // If the user seems frustrated or keeps asking for specific options, force search
    const isDemandingSpecifics = /תציע|דגמים|models|offers|options|ספציפי/i.test(lastMessage);

    return hasKeyword || isDemandingSpecifics;
}

export async function POST(request) {
    try {
        const { messages, currentOptions, currentCriteria } = await request.json();

        let searchResultsText = "No web search performed.";
        try {
            if (await detectSearchNeed(messages)) {
                const lastMsg = messages[messages.length - 1].text;
                // Use a more structured prompt for query generation to ensure clean output
                const queryRes = await model.generateContent([
                    { text: "Generate a single, precise web search query in English (for better results) to find specific product models and current deals for this user request. Output ONLY the query string, nothing else." },
                    { text: lastMsg }
                ]);

                let query = queryRes.response.text().trim();
                // Clean up any AI chatter from the query
                query = query.split('\n')[0].replace(/["']/g, '').trim();

                console.log(`[Chat API] Generated Search Query: ${query}`);

                const results = await performWebSearch(query);
                if (results && results.length > 0) {
                    searchResultsText = results.map(r => `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join("\n---\n");
                } else {
                    searchResultsText = "Web search returned no results.";
                }
            }
        } catch (searchError) {
            console.error("[Chat API] Search flow error:", searchError);
            searchResultsText = "Search service temporarily unavailable.";
        }

        const systemPrompt = CHAT_SYSTEM_PROMPT
            .replace("{options}", currentOptions?.join(", ") || "None yet")
            .replace("{criteria}", currentCriteria?.join(", ") || "None yet")
            .replace("{searchResults}", searchResultsText);

        const conversationParts = [
            { text: systemPrompt },
            ...messages.map(msg => ({
                text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`
            }))
        ];

        const result = await model.generateContent(conversationParts.map(p => p.text).join("\n\n"));
        let responseText = result.response.text();

        const suggestedOptions = [];
        const suggestedCriteria = [];

        // Parse extracted JSON from response
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                if (Array.isArray(data.newlySuggestedOptions)) suggestedOptions.push(...data.newlySuggestedOptions);
                if (Array.isArray(data.newlySuggestedCriteria)) suggestedCriteria.push(...data.newlySuggestedCriteria);
                responseText = responseText.replace(jsonMatch[0], '').trim();
            } catch (e) {
                console.error("[Chat API] JSON parse error:", e);
            }
        }

        return NextResponse.json({
            response: responseText || "I'm sorry, I'm having trouble processing that right now. Could you please try rephrasing?",
            suggestedOptions,
            suggestedCriteria
        });
    } catch (error) {
        console.error("Chat API Critical Error:", error);
        return NextResponse.json({
            error: "Failed to generate response",
            response: "I apologize, but I encountered a technical issue. Please try your message again."
        }, { status: 500 });
    }
}

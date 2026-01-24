import { model } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CHAT_SYSTEM_PROMPT = `You are DilemmaWise, an AI decision coach. You help users structure decisions by exploring concrete, comparable options.

Current context:
- Core Dilemma: {dilemma}
- Options in structure: {options}
- Criteria in structure: {criteria}

Rules:
1. **CONCRETE OPTIONS ONLY**: 
   - NEVER suggest abstract placeholders like "Other brands", "Various models", "Professional options", or "Competitors".
   - You MUST suggest specific, concrete entities (e.g., "HP Victus 15-fb0007nj", "Asus Vivobook 15").

2. **MANDATORY TAGGING**: 
   - EVERY SINGLE Option or Criterion you mention that is a candidate for the structure MUST be wrapped in tags: [[Option:Name]] or [[Criterion:Name]].
   - **DO NOT USE BOLD TEXT** (e.g., **HP 15**) for suggestions. If you are recommending it, use the tag: [[Option:HP 15]].
   - This makes the item clickable for the user. If you mention it multiple times, tag it every time.

3. **Logical Inference**: Use history to infer facts (e.g., "Stay in London" implies resident in London). DO NOT ask for redundant info.
   
4. **Readability**: Use double newlines and bold headers for section titles ONLY (not for items).

5. **Web Discovery**: Use search results for specific models and links [Store](URL). 

6. **Language**: Match the user's language.

Web Search Results:
{searchResults}

CRITICAL: Always provide a HIDDEN JSON block at the end. 
Reformulate the decision as a single clear question in "coreDilemma".
\`\`\`json
{
  "newlySuggestedOptions": ["Specific Model A", "Specific Model B"],
  "newlySuggestedCriteria": [],
  "coreDilemma": "Clear question"
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
        const { messages, currentOptions, currentCriteria, currentDilemma } = await request.json();

        let searchResultsText = "No web search performed.";
        try {
            if (await detectSearchNeed(messages)) {
                const lastMsg = messages[messages.length - 1].text;
                // Use a more structured prompt for query generation to ensure clean output
                const queryRes = await model.generateContent([
                    { text: "Generate a single, precise web search query in English to find CURRENT specific product models, local prices, and store links in Israel. Focus on finding EXACT models (e.g. 'Laptop models under 4000 NIS Israel KSP Ivory'). Output ONLY the query string." },
                    { text: lastMsg }
                ]);

                let query = queryRes.response.text().trim();
                // Clean up any AI chatter from the query
                query = query.split('\n')[0].replace(/["']/g, '').trim();

                console.log(`[Chat API] Query: ${query}`);

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
            .replace("{dilemma}", currentDilemma || "None yet")
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

        let suggestedOptions = [];
        let suggestedCriteria = [];
        let extractedDilemma = currentDilemma || "";

        // Parse extracted JSON from response
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                suggestedOptions = data.newlySuggestedOptions || [];
                suggestedCriteria = data.newlySuggestedCriteria || [];
                if (data.coreDilemma) extractedDilemma = data.coreDilemma;
                responseText = responseText.replace(jsonMatch[0], '').trim();
            } catch (e) {
                console.error("[Chat API] JSON parse error:", e);
            }
        }

        return NextResponse.json({
            response: responseText || "I'm sorry, I'm having trouble processing that right now.",
            suggestedOptions,
            suggestedCriteria,
            coreDilemma: extractedDilemma
        });
    } catch (error) {
        console.error("Chat API Critical Error:", error);
        return NextResponse.json({
            error: "Failed to generate response",
            response: "I apologize, but I encountered a technical issue."
        }, { status: 500 });
    }
}

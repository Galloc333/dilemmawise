import { model } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CHAT_SYSTEM_PROMPT = `You are DilemmaWise, a precision decision coach. Your job is to help the user structure their decision into a clear list of OPTIONS and CRITERIA.

Current State:
- Core Dilemma: {dilemma}
- Options: {options}
- Criteria: {criteria}

WORKFLOW RULES (Follow strictly):

FAST TRACK / FULL CONTEXT:
- If the user provides a FULL dilemma description (contains BOTH specific Options AND desired Criteria/Concerns), SKIP the phases.
- Extract ALL Options and Criteria immediately into the JSON block.
- In your response, explicitly say: "I see you've already thought through your options and criteria, so I've added them for you. Feel free to tweak them, add more manually, or consult with me to refine the structure."

NORMAL PHASED FLOW (If info is partial):
PHASE 1: DEFINE OPTIONS
- If "Options" are empty or few, your ONLY goal is to elicit concrete options.
- ask the user to list their options or use web search to suggest specific models/choices if they ask for help.
- **CRITICAL**: If the user provides specific options (e.g., "Germany vs Israel"), ACCEPT THEM EXACTLY. Do NOT split them into sub-options (e.g., "Berlin", "Munich") unless explicitly asked.
- **STRICT ADHERENCE**: Never invent options if the user has clearly stated their set.

PHASE 2: VERIFY OPTIONS
- Once options are on the table, ASK the user to confirm: "Are these all the options you want to consider?"
- Do NOT move to Criteria until the user confirms the Option list is complete.

PHASE 3: DEFINE CRITERIA
- Only AFTER options are confirmed, ask about Criteria (factors for comparison).
- Suggest standard criteria (Price, Quality, etc.) but prioritize user's specific concerns.

GENERAL GUIDELINES:
1. **MANDATORY TAGGING**: 
   - Every candidate Option/Criterion must be tagged: [[Option:Name]] or [[Criterion:Name]].
   - Use tags INSTEAD of bold text for suggestions.
2. **NO FLUFF**: Be concise. Clear instructions.
3. **WEB SEARCH**: If providing external suggestions, use specific links [Store](URL).

Web Search Results:
{searchResults}

HIDDEN OUTPUT:
Reformulate the decision as a single clear question in "coreDilemma".
\`\`\`json
{
  "newlySuggestedOptions": [],
  "newlySuggestedCriteria": [],
  "coreDilemma": "..."
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
                const cleanItem = (item) => {
                    return item.replace(/\[\[(Option|Criterion):/i, '').replace(/\]\]/g, '').trim();
                };

                const data = JSON.parse(jsonMatch[1]);
                suggestedOptions = (data.newlySuggestedOptions || []).map(cleanItem);
                suggestedCriteria = (data.newlySuggestedCriteria || []).map(cleanItem);
                if (data.coreDilemma) extractedDilemma = data.coreDilemma;
                responseText = responseText.replace(jsonMatch[0], '').trim();
            } catch (e) {
                console.error("[Chat API] JSON parse error:", e);
            }
        }

        // Final cleanup of any potential prefixes
        responseText = responseText
            .replace(/^(Assistant|DilemmaWise):\s*/i, '')
            .replace(/^User:\s*/i, '')
            .trim();

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

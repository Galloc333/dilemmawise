import { model, generateWithRetry } from "@/lib/gemini";
import { performWebSearch } from "@/lib/webSearch";
import { NextResponse } from "next/server";

const CHAT_SYSTEM_PROMPT = `You are DilemmaWise, a precision decision coach. Your job is to help the user structure their decision into a clear list of OPTIONS and CRITERIA.

Current State:
- Core Dilemma: {dilemma}
- Current Phase: {phase}
- Options: {options}
- Criteria: {criteria}
- User Context: {userContext}

WORKFLOW RULES (Follow strictly):

## PHASE-SPECIFIC BEHAVIOR:
{phaseInstructions}

## STATE AWARENESS:
- **TRUTH SOURCE**: Trust the \`Current State\` variables above as the real-time truth.
- **CONFLICT RESOLUTION**: If \`Current State\` says "None" but the user JUST listed items in their message, TRUST THE USER'S MESSAGE and extract them.

## USER CONTEXT AWARENESS:
- The User Context contains personal details the user has already shared (budget, location, preferences, etc.).
- DO NOT ask for information that's already in User Context.
- USE the context when making suggestions (e.g., if budget is 3500 ILS, suggest options within that range).

## EXTRACTION vs SUGGESTION (CRITICAL):
- **USER-PROVIDED ITEMS**: If the user explicitly states options or criteria in their message, EXTRACT them and put them in the JSON block.
- **YOUR SUGGESTIONS**: If YOU (the AI) are suggesting options or criteria, DO NOT put them in the JSON. Only tag them in the text so the user can click to add them.
- The JSON block is ONLY for items the USER provided, NOT for your suggestions.

## SPELLING CORRECTION (IMPORTANT):
- When extracting user-provided options or criteria, CORRECT any obvious spelling mistakes or typos.
- For brand names, products, or proper nouns, use the CORRECT spelling (e.g., "xiaaomi" → "Xiaomi", "Samsunf" → "Samsung", "iphne" → "iPhone").
- In your visible response, ALWAYS use the CORRECTED version in [[Option:CorrectName]] tags.
- The user should see the properly spelled version, not their typo.

## ANTI-HALLUCINATION:
- **NO SCRIPTING**: Do NOT generate "User:" or "Assistant:" lines. Stop immediately after your response.

GENERAL GUIDELINES:
1. **MANDATORY TAGGING**: Every candidate Option/Criterion must be tagged: [[Option:Name]] or [[Criterion:Name]].
2. **NO FLUFF**: Be concise.
3. **WEB SEARCH**: If providing external suggestions, use specific links [Store](URL).

Web Search Results:
{searchResults}

HIDDEN OUTPUT (JSON for EXTRACTED user items ONLY, with spelling corrected):
\`\`\`json
{
  "newlySuggestedOptions": ["Corrected Option Name"],
  "newlySuggestedCriteria": ["Corrected Criterion Name"],
  "coreDilemma": "..."
}
\`\`\`
`;


const OPTIONS_PHASE_INSTRUCTIONS = `**You are in the OPTIONS phase.**
- The user needs to define CONCRETE options to compare.
- Your ONLY goal is to help them identify options.
- DO NOT ask about criteria yet.
- If they provide options, confirm them: "I've added [[Option:X]] and [[Option:Y]]."
- If they're vague or need help, suggest specific options using CLICKABLE TAGS.

**CRITICAL - ALWAYS USE TAGS FOR SUGGESTIONS:**
When suggesting options, you MUST format them as clickable tags like this:
"Are you considering [[Option:Cow's milk]], [[Option:Almond milk]], or [[Option:Oat milk]]?"

NEVER suggest options in plain text like "cow's milk, almond milk" - ALWAYS use [[Option:Name]] format so users can click to add them.`;

const CRITERIA_PHASE_INSTRUCTIONS = `**You are in the CRITERIA phase.**
- The options are already confirmed (see Options above).
- Your ONLY goal is to help them identify CRITERIA (factors that matter).
- Ask what factors are important to them when comparing these options.
- DO NOT ask for more options unless the user explicitly wants to add some.

**CRITICAL - ALWAYS USE TAGS FOR SUGGESTIONS:**
When suggesting criteria, you MUST format them as clickable tags like this:
"What matters to you? Maybe [[Criterion:Price]], [[Criterion:Quality]], or [[Criterion:Taste]]?"

NEVER suggest criteria in plain text - ALWAYS use [[Criterion:Name]] format so users can click to add them.`;


async function detectSearchNeed(messages, currentDilemma, currentOptions) {
    const lastMessage = messages[messages.length - 1].text.toLowerCase();

    // Generic intent detection: Does the user want external information?
    const searchIntentKeywords = [
        'recommend', 'suggest', 'help me find', 'best', 'compare', 'reviews',
        'pros and cons', 'what are some', 'options for', 'alternatives', 'which is better'
    ];

    const hasSearchIntent = searchIntentKeywords.some(k => lastMessage.includes(k));

    // Only search if the options are concrete (real-world entities) and user asks for help.
    // Avoid searching for abstract options like "Job A", "Option 1", "University X".
    const isAbstract = currentOptions?.some(opt => /^(option|choice|alternative|job|plan|path)\s*[a-z0-9]?$/i.test(opt));

    return hasSearchIntent && !isAbstract;
}

export async function POST(request) {
    try {
        const { messages, currentOptions, currentCriteria, currentDilemma, currentPhase, userContext } = await request.json();

        let searchResultsText = "No web search performed.";
        try {
            if (await detectSearchNeed(messages, currentDilemma, currentOptions)) {
                const lastMsg = messages[messages.length - 1].text;
                const optionsContext = currentOptions?.length > 0 ? `Options: ${currentOptions.join(', ')}.` : '';
                const dilemmaContext = currentDilemma ? `Dilemma: ${currentDilemma}.` : '';

                // Generic search prompt based on actual context
                const queryRes = await generateWithRetry([
                    { text: `Generate a single, precise web search query to find relevant information for a decision. Use the context below. Do NOT add any assumptions about location or domain unless the user specified them. Output ONLY the query string.\n${dilemmaContext}\n${optionsContext}\nUser request: ${lastMsg}` }
                ]);

                let query = queryRes.response.text().trim();
                query = query.split('\n')[0].replace(/["\']/g, '').trim();

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

        // Select phase-specific instructions
        const phaseInstructions = currentPhase === 'CRITERIA' ? CRITERIA_PHASE_INSTRUCTIONS : OPTIONS_PHASE_INSTRUCTIONS;

        // Format user context for the prompt
        const userContextSummary = userContext && Object.keys(userContext).length > 0
            ? Object.entries(userContext)
                .filter(([_, v]) => v && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0)))
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                .join('; ')
            : 'None yet';

        const systemPrompt = CHAT_SYSTEM_PROMPT
            .replace("{dilemma}", currentDilemma || "None yet")
            .replace("{phase}", currentPhase || "OPTIONS")
            .replace("{phaseInstructions}", phaseInstructions)
            .replace("{options}", currentOptions?.join(", ") || "None yet")
            .replace("{criteria}", currentCriteria?.join(", ") || "None yet")
            .replace("{userContext}", userContextSummary)
            .replace("{searchResults}", searchResultsText);

        const conversationParts = [
            { text: systemPrompt },
            ...messages.map(msg => ({
                text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`
            }))
        ];

        const result = await generateWithRetry(conversationParts.map(p => p.text).join("\n\n"));
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

        // Fallback: Extract from visible [[Option:X]] and [[Criterion:X]] tags if JSON didn't capture them
        if (suggestedOptions.length === 0) {
            const optionMatches = responseText.match(/\[\[Option:([^\]]+)\]\]/g) || [];
            const extractedFromText = optionMatches.map(m => m.replace(/\[\[Option:|\]\]/g, '').trim());
            // Only add options that appear in "I've added" context (user-provided, not suggestions)
            if (responseText.toLowerCase().includes("added") && extractedFromText.length > 0) {
                suggestedOptions = extractedFromText.slice(0, 3); // Limit to 3
            }
        }

        if (suggestedCriteria.length === 0) {
            const criteriaMatches = responseText.match(/\[\[Criterion:([^\]]+)\]\]/g) || [];
            const extractedFromText = criteriaMatches.map(m => m.replace(/\[\[Criterion:|\]\]/g, '').trim());
            if (responseText.toLowerCase().includes("added") && extractedFromText.length > 0) {
                suggestedCriteria = extractedFromText.slice(0, 3);
            }
        }

        // Comprehensive cleanup to remove internal prompt leakage and prefixes
        responseText = responseText
            // Remove any leaked "HIDDEN OUTPUT" text and everything after it
            .replace(/HIDDEN OUTPUT.*$/is, '')
            // Remove JSON code blocks that might have leaked
            .replace(/```json[\s\S]*?```/g, '')
            .replace(/```[\s\S]*?```/g, '')
            // Remove any remaining system instruction leakage
            .replace(/\(JSON for EXTRACTED.*?\)/gi, '')
            .replace(/newlySuggested(Options|Criteria)/gi, '')
            .replace(/coreDilemma/gi, '')
            // Remove assistant/user prefixes
            .replace(/^(Assistant|DilemmaWise):\s*/i, '')
            .replace(/^User:\s*/i, '')
            // Clean up any leftover artifacts
            .replace(/\{\s*\}/g, '')
            .replace(/\[\s*\]/g, '')
            .replace(/:\s*$/gm, '')
            .replace(/\*\s*\*\s*$/gm, '')
            // Final trimming and cleanup
            .replace(/\n{3,}/g, '\n\n')
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

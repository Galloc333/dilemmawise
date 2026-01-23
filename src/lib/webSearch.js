import { model, parseJsonFromResponse } from "@/lib/gemini";

/**
 * Performs a web search (or simulation) for valid queries.
 * Priority: Google Custom Search -> Gemini Knowledge Base Fallback
 */
export async function performWebSearch(query) {
    if (!query) return [];

    // 1. Try Real Google Custom Search if keys exist
    const hasSearchAPI = process.env.GOOGLE_SEARCH_API_KEY && process.env.SEARCH_ENGINE_ID;

    if (hasSearchAPI) {
        try {
            console.log(`Performing Google Search for: ${query}`);
            const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=3`;

            const response = await fetch(searchUrl);
            const data = await response.json();

            if (data.items) {
                return data.items.map(item => ({
                    title: item.title,
                    url: item.link,
                    snippet: item.snippet
                }));
            }
        } catch (searchError) {
            console.error("Google Search API failed, falling back to Gemini:", searchError.message);
        }
    }

    // 2. Fallback: Gemini Knowledge Base Simulation
    console.log(`Using Gemini fallback for query: ${query}`);
    const SEARCH_SIMULATION_PROMPT = `You are a factual search engine. 
User Query: "${query}"

Your goal: Provide 3 distinct, highly relevant "search results" that directly address the specific comparison or entity in the query.
CRITICAL RULES:
1. Only provide facts about the SPECIFIC entities mentioned in the query (e.g., if WIX vs Google is mentioned, ONLY talk about WIX and Google).
2. NEVER mention other companies like Amazon, Netflix, or Meta unless they are in the query.
3. Focus on concrete data: salary ranges, specific policies, locations, or ratings relevant to the criterion.
4. If you don't have specific data for a company, provide general but highly relevant industry standards for that specific role and location.

Output JSON Format:
[
  { 
    "title": "Specific title from a real-world domain", 
    "url": "https://www.top-tier-source.com/page", 
    "snippet": "A factual, detailed snippet answering the query..." 
  }
]`;

    try {
        const result = await model.generateContent(SEARCH_SIMULATION_PROMPT);
        const text = result.response.text();
        return parseJsonFromResponse(text) || [];
    } catch (geminiError) {
        console.error("Gemini Search Simulation Error:", geminiError);
        return [];
    }
}

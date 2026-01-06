import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Use Gemini 2.0 Flash for faster, smarter responses
export const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
    }
});

// Helper to parse JSON from LLM response
export function parseJsonFromResponse(text) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
    }
    // Try direct JSON parse
    return JSON.parse(text.trim());
}

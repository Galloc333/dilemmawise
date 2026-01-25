import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Use Gemini 2.0 Flash for faster, smarter responses
export const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
    }
});

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wrapper for model.generateContent with exponential backoff retry on 429 errors.
 * @param {string|Array} prompt - The prompt to send to the model
 * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
 * @returns {Promise} - The model response
 */
export async function generateWithRetry(prompt, maxRetries = 5) {
    let delay = 1000; // Start with 1 second delay

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await model.generateContent(prompt);
        } catch (error) {
            const is429 = error?.status === 429 ||
                error?.message?.includes('429') ||
                error?.message?.includes('Too Many Requests') ||
                error?.message?.includes('RESOURCE_EXHAUSTED');

            if (is429 && attempt < maxRetries - 1) {
                console.log(`[Gemini] Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                delay *= 2; // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                continue;
            }
            throw error;
        }
    }
}

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

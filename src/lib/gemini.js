import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Use Gemini 2.5 Flash for faster, smarter responses
export const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096, // Increased to prevent truncation
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

/**
 * Escape unescaped newlines, tabs, and control characters within JSON string values.
 * This handles LLM responses that put literal newlines instead of \n in strings.
 */
function escapeControlCharsInJsonStrings(jsonStr) {
    let result = '';
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        
        if (escaped) {
            result += char;
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            result += char;
            escaped = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            result += char;
            continue;
        }
        
        if (inString) {
            // Escape control characters within strings
            if (char === '\n') {
                result += '\\n';
            } else if (char === '\r') {
                result += '\\r';
            } else if (char === '\t') {
                result += '\\t';
            } else {
                result += char;
            }
        } else {
            result += char;
        }
    }
    
    return result;
}

/**
 * Try to repair truncated JSON by closing unclosed strings, arrays, and objects.
 */
function repairTruncatedJson(jsonStr) {
    let repaired = jsonStr.trim();
    
    // Count unclosed structures
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            continue;
        }
        
        if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            else if (char === '[') bracketCount++;
            else if (char === ']') bracketCount--;
        }
    }
    
    // If we ended inside a string, close it
    if (inString) {
        repaired += '"';
    }
    
    // Close unclosed arrays and objects
    while (bracketCount > 0) {
        repaired += ']';
        bracketCount--;
    }
    while (braceCount > 0) {
        repaired += '}';
        braceCount--;
    }
    
    return repaired;
}

/**
 * Try multiple parsing strategies with increasing repair attempts.
 */
function tryParseJson(jsonStr) {
    // Attempt 1: Direct parse
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // Continue to repairs
    }
    
    // Attempt 2: Escape control characters
    try {
        const escaped = escapeControlCharsInJsonStrings(jsonStr);
        return JSON.parse(escaped);
    } catch (e) {
        // Continue to repairs
    }
    
    // Attempt 3: Repair truncated + escape
    try {
        const escaped = escapeControlCharsInJsonStrings(jsonStr);
        const repaired = repairTruncatedJson(escaped);
        return JSON.parse(repaired);
    } catch (e) {
        // All attempts failed
        return null;
    }
}

// Helper to parse JSON from LLM response
export function parseJsonFromResponse(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid input: text is required');
    }

    // Clean the text first - remove any leading/trailing whitespace
    let cleanText = text.trim();

    // Strategy 1: Extract from markdown code blocks using split approach
    if (cleanText.includes('```')) {
        const parts = cleanText.split('```');
        if (parts.length >= 3) {
            let jsonContent = parts[1];
            jsonContent = jsonContent.replace(/^(json|JSON)\s*\n?/, '').trim();
            if (jsonContent) {
                const parsed = tryParseJson(jsonContent);
                if (parsed) return parsed;
            }
        }
        
        // Remove all markdown code fences before trying other strategies
        cleanText = cleanText.replace(/```(?:json|JSON)?\s*/g, '').trim();
    }

    // Strategy 2: Find JSON object - match from first { to last }
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = cleanText.substring(firstBrace, lastBrace + 1);
        const parsed = tryParseJson(jsonCandidate);
        if (parsed) return parsed;
    }

    // Strategy 3: Find JSON array - match from first [ to last ]
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
        const jsonCandidate = cleanText.substring(firstBracket, lastBracket + 1);
        const parsed = tryParseJson(jsonCandidate);
        if (parsed) return parsed;
    }

    // Strategy 4: Try to parse anything that looks like JSON (even partial)
    // Find start of JSON and try to repair it
    const jsonStart = cleanText.indexOf('{');
    if (jsonStart !== -1) {
        const possibleJson = cleanText.substring(jsonStart);
        const parsed = tryParseJson(possibleJson);
        if (parsed) return parsed;
    }

    // Strategy 5: Try array from start
    const arrayStart = cleanText.indexOf('[');
    if (arrayStart !== -1) {
        const possibleJson = cleanText.substring(arrayStart);
        const parsed = tryParseJson(possibleJson);
        if (parsed) return parsed;
    }

    // All strategies failed
    throw new Error(`Failed to parse JSON from response. First 200 chars: ${text.substring(0, 200)}`);
}

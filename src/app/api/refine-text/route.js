import { generateWithRetry, parseJsonFromResponse } from '@/lib/gemini';
import { NextResponse } from 'next/server';

const REFINE_TEXT_PROMPT = `You are a text refinement assistant. Your task is to correct spelling and typing errors in user-provided text while preserving the original meaning and intent.

RULES:
1. Fix obvious spelling mistakes (e.g., "Samsunf" → "Samsung", "iphne" → "iPhone")
2. Fix common typos (e.g., "teh" → "the", "adn" → "and")
3. Correct capitalization for proper nouns and brand names (e.g., "iphone" → "iPhone", "google" → "Google")
4. Preserve the user's intended meaning - do NOT change the substance
5. Keep the same language/style - don't make it more formal or verbose
6. If the text is already correct, return it unchanged
7. For single words (like option or criteria names), just fix spelling/capitalization

Input format:
{
  "type": "dilemma" | "option" | "criterion" | "options_list" | "criteria_list",
  "text": "text to refine" OR "items": ["item1", "item2"]
}

Output format (JSON only):
{
  "refined": "corrected text" OR ["corrected item1", "corrected item2"],
  "changes_made": true/false
}

Examples:
- "Samsunf Galaxy S23" → "Samsung Galaxy S23"
- "iphne 14 pro" → "iPhone 14 Pro"
- "Cost of livign" → "Cost of living"
- "career grwoth" → "Career growth"
`;

export async function POST(request) {
  try {
    const { type, text, items } = await request.json();

    if (!type || (!text && !items)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const inputData = items ? { type, items } : { type, text };

    const prompt = `Refine this input:\n${JSON.stringify(inputData)}`;

    const result = await generateWithRetry([{ text: REFINE_TEXT_PROMPT }, { text: prompt }]);

    const responseText = result.response.text();
    const parsed = parseJsonFromResponse(responseText);

    if (parsed) {
      return NextResponse.json(parsed);
    }

    // Fallback: return original if parsing fails
    return NextResponse.json({
      refined: text || items,
      changes_made: false,
    });
  } catch (error) {
    console.error('Refine Text Error:', error);
    // On error, return original text unchanged
    return NextResponse.json(
      {
        refined: request.body?.text || request.body?.items,
        changes_made: false,
      },
      { status: 200 }
    ); // Return 200 to not break the flow
  }
}

import { generateWithRetry, parseJsonFromResponse } from '@/lib/gemini';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a Logic Validator for decision matrices.
Your goal is to ensure that the user's Options and Criteria form a coherent matrix where EVERY Option can be reasonably rated against EVERY Criterion.

The user is concerned about "Category Errors" where a criterion applies to one option but is nonsensical for another.
Example of Issue:
- Options: ["Stay together", "Break up"]
- Criterion: "Relationship Growth"
- Problem: "Relationship Growth" assumes a relationship exists. It is awkward to rate "Break up" on "Relationship Growth".
- Fix: Rename to "Personal Growth" or "Long-term Fulfillment" (which applies to both scenarios).

Task:
1. Analyze the options and criteria.
2. Check if any criterion is semantically tied to only ONE option (making it awkward to rate the others).
3. If reasonably valid, return true. If awkward/illogical, return false and suggest fixes.

Output JSON:
{
  "isValid": boolean,
  "warning": "Brief, friendly explanation of why X is awkward to rate for Y.",
  "suggestions": ["Better Name for Criterion X"]
}
`;

export async function POST(request) {
  try {
    const { options, criteria } = await request.json();

    if (!options?.length || !criteria?.length) {
      return NextResponse.json({ isValid: true });
    }

    const prompt = `Options: ${JSON.stringify(options)}\nCriteria: ${JSON.stringify(criteria)}`;

    const result = await generateWithRetry([{ text: SYSTEM_PROMPT }, { text: prompt }]);

    const text = result.response.text();
    const analysis = parseJsonFromResponse(text);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Validation Error:', error);
    // Default to valid if error, so we don't block user
    return NextResponse.json({ isValid: true });
  }
}

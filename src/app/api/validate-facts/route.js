import { generateWithRetry } from '@/lib/gemini';
import { NextResponse } from 'next/server';

const FACT_VALIDATION_PROMPT = `You are a fact-checking assistant for a decision-making app.

Your task: Given a query about factual information (e.g., commute times, salary ranges, locations), search your knowledge and provide:
1. The factual answer (if you're confident)
2. A confidence score (0-1)
3. Whether this should be verified with web search
4. Important caveats or uncertainties

Be conservative - if you're not confident or the information could be outdated, recommend web verification.

Output JSON format:
{
  "fact": "The claimed fact or answer",
  "confidence": 0.8,
  "needs_web_verification": true,
  "caveats": "May vary based on traffic, time of day, etc.",
  "reliable": false
}

If you cannot answer the query confidently, set confidence to 0 and needs_web_verification to true.`;

export async function POST(request) {
  try {
    const { query, options, criteria } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    // Use LLM to attempt fact validation
    // Note: For real web search, you'd integrate with Google Search API or similar
    // For now, we'll use LLM's knowledge with appropriate caveats

    const prompt = `
Query: ${query}

Context:
- This is for a decision between: ${JSON.stringify(options)}
- Related to criteria: ${JSON.stringify(criteria)}

Provide factual information if you have reliable knowledge, or indicate if web verification is needed.`;

    const result = await generateWithRetry([{ text: FACT_VALIDATION_PROMPT }, { text: prompt }]);

    const text = result.response.text();
    let factInfo;

    try {
      // Try to parse JSON from response
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        factInfo = JSON.parse(jsonMatch[1].trim());
      } else {
        factInfo = JSON.parse(text.trim());
      }
    } catch (e) {
      // If parsing fails, return conservative response
      factInfo = {
        fact: 'Unable to verify',
        confidence: 0,
        needs_web_verification: true,
        caveats: 'Could not validate this information',
        reliable: false,
      };
    }

    // For concrete facts with high confidence, mark as validated
    // In a production system, this would actually do web searches
    if (factInfo.confidence > 0.7 && !factInfo.needs_web_verification) {
      factInfo.validated = true;
      factInfo.sources = ['LLM knowledge base'];
    } else {
      factInfo.validated = false;
      factInfo.sources = [];
    }

    return NextResponse.json(factInfo);
  } catch (error) {
    console.error('Validate Facts Error:', error);
    return NextResponse.json(
      {
        error: error.message,
        validated: false,
        reliable: false,
      },
      { status: 500 }
    );
  }
}

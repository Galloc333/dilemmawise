import { generateWithRetry } from '@/lib/gemini';
import { NextResponse } from 'next/server';

const ELICITATION_SYSTEM_PROMPT = `You are a decision-support assistant helping the user compare options across criteria through evidence-based elicitation.

## Context
Options being compared: {options}
Criteria to evaluate: {criteria}
Current scores (may be incomplete): {currentScores}
Current confidence levels: {confidence}
Evidence collected: {evidence}

## CRITICAL: Elicitation Style
- **DO NOT** ask explicit pairwise-comparison questions like "Is Option A better than Option B on X?"
- **Instead**, ask natural, context-relevant questions about each option independently.
- Ask **one short, natural question at a time**.
- Focus on extracting **evidence and constraints** rather than asking the user to rate things.
- When helpful, **propose a tentative score and ask the user to confirm or correct it**.

### Good Question Examples:
- "How long is your commute if you choose [Option A]?" (for Commute criterion)
- "What's the monthly cost for [Option A]?" (for Cost criterion)
- "I'm estimating [Option A] scores about 4/5 on flexibility based on what you said. Does that feel right?"
- "What do you like most about [Option B]?"

### Bad Question Examples (AVOID):
- "Is Option A better than Option B on commute?" ❌
- "Which option has better cost?" ❌
- "How do Options A and B compare on flexibility?" ❌

## Scoring Rules
- Use a 1-5 scale: 1=Very Poor, 2=Poor, 3=Okay, 4=Good, 5=Excellent
- Only assign/update a score when you have enough evidence
- Mark scores as "unknown" (use null) if insufficient information
- For negative criteria (Cost, Risk, Commute Time): lower real-world values = higher scores

## Confidence Tracking
- "high": User gave explicit, detailed evidence
- "medium": User gave partial or vague info, but enough to estimate
- "low": No direct info yet, score is a placeholder

## Evidence Collection
For each option-criterion pair, maintain a short justification based on user statements.

## Response Format
You MUST end EVERY response with a JSON block:

\`\`\`json
{
  "next_question": "Your next natural question (empty string if finished)",
  "is_finished": false,
  "scores": {
    "Option A": { "Criterion 1": 4, "Criterion 2": null },
    "Option B": { "Criterion 1": null, "Criterion 2": 3 }
  },
  "confidence": {
    "Option A": { "Criterion 1": "high", "Criterion 2": "low" },
    "Option B": { "Criterion 1": "low", "Criterion 2": "medium" }
  },
  "evidence": {
    "Option A": { "Criterion 1": "User said commute is 15 min", "Criterion 2": "" },
    "Option B": { "Criterion 1": "", "Criterion 2": "User mentioned it feels affordable" }
  },
  "reasoning": "Brief explanation of what you learned and why you're asking the next question"
}
\`\`\`

## Finishing Condition
Set is_finished to true ONLY when:
- You have high or medium confidence on ALL criteria for ALL options
- OR the user indicates they want to proceed

When finishing, your last message should briefly summarize your understanding of each option's strengths and weaknesses.

Remember: Be warm, conversational, and specific. The JSON block is hidden from the user.`;

export async function POST(request) {
  try {
    const { options, criteria, conversation, currentScores, currentEvidence } =
      await request.json();

    // Initialize structures if not provided
    const scores = currentScores || {};
    const confidence = {};
    const evidence = currentEvidence || {};

    options.forEach((opt) => {
      if (!scores[opt]) {
        scores[opt] = {};
      }
      confidence[opt] = {};
      if (!evidence[opt]) {
        evidence[opt] = {};
      }
      criteria.forEach((crit) => {
        if (scores[opt][crit] === undefined || scores[opt][crit] === null) {
          scores[opt][crit] = null; // Use null for unknown instead of 3
        }
        confidence[opt][crit] = 'low';
        if (!evidence[opt][crit]) {
          evidence[opt][crit] = '';
        }
      });
    });

    // Build the context-aware prompt
    const systemPrompt = ELICITATION_SYSTEM_PROMPT.replace('{options}', options.join(', '))
      .replace('{criteria}', criteria.join(', '))
      .replace('{currentScores}', JSON.stringify(scores, null, 2))
      .replace('{confidence}', JSON.stringify(confidence, null, 2))
      .replace('{evidence}', JSON.stringify(evidence, null, 2));

    // Build conversation history
    const conversationParts = [
      systemPrompt,
      ...conversation.map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`),
    ];

    const result = await generateWithRetry(conversationParts.join('\n\n'));
    let responseText = result.response.text();

    // Parse the JSON response
    let parsedResponse = {
      next_question:
        "I'd love to understand more about your options. Could you tell me about each one?",
      is_finished: false,
      scores: scores,
      confidence: confidence,
      evidence: evidence,
      reasoning: '',
    };

    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        parsedResponse = {
          next_question: data.next_question || parsedResponse.next_question,
          is_finished: data.is_finished || false,
          scores: data.scores || scores,
          confidence: data.confidence || confidence,
          evidence: data.evidence || evidence,
          reasoning: data.reasoning || '',
        };

        // Remove JSON block from visible response
        responseText = responseText.replace(jsonMatch[0], '').trim();
      } catch (e) {
        console.error('Failed to parse elicitation JSON:', e);
      }
    }

    // If the LLM didn't provide a next question, use the cleaned response itself
    if (!parsedResponse.next_question && responseText) {
      parsedResponse.next_question = responseText;
    }

    return NextResponse.json({
      response: responseText || parsedResponse.next_question,
      next_question: parsedResponse.next_question,
      is_finished: parsedResponse.is_finished,
      scores: parsedResponse.scores,
      confidence: parsedResponse.confidence,
      evidence: parsedResponse.evidence,
      reasoning: parsedResponse.reasoning,
    });
  } catch (error) {
    console.error('Elicitation API Error:', error);
    return NextResponse.json({ error: 'Failed to generate elicitation response' }, { status: 500 });
  }
}

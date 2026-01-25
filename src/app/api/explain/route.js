import { generateWithRetry, parseJsonFromResponse } from "@/lib/gemini";
import { NextResponse } from "next/server";

// Part A: Data-driven analysis based on weights and ratings
const DATA_ANALYSIS_PROMPT = `You are an AI that explains decision analysis results based ONLY on the mathematical data provided.

DATA PROVIDED:
- Winner: {winner} (total weighted score: {winnerScore})
- Runner-up: {runnerUp} (score: {runnerUpScore})
- Score Gap: {scoreGap} points
- Full Ranking: {ranking}
- User's Criteria Weights (1-10 scale): {weights}
- Option Scores (1-10 scale): {scores}

YOUR TASK: Generate a concise, data-driven explanation covering:
1. Which option won and by how much
2. The 2-3 highest-weighted criteria and how the winner performed on them
3. What could change the result

CRITICAL JSON RULES:
- Return ONLY valid JSON, nothing else
- Use \\n for newlines inside strings, NOT actual line breaks
- Keep text concise (under 500 characters per field)

Return this exact JSON structure:
{"dataAnalysis": "Winner summary and key criteria analysis here", "whatCouldChange": "What would flip the ranking"}`;

// Part B: Personal recommendation based on user context
const PERSONAL_ANALYSIS_PROMPT = `You are a thoughtful advisor recommending options based on user's personal situation.

DECISION INFO:
- Dilemma: {dilemma}
- Options: {options}
- Data Winner: {winner}
- Runner-up: {runnerUp}

USER'S PERSONAL CONTEXT:
{userContext}

YOUR TASK: Based on their personal context (not scores), recommend the best fit option. You may agree or disagree with the data winner.

CRITICAL JSON RULES:
- Return ONLY valid JSON, nothing else
- Use \\n for newlines inside strings, NOT actual line breaks
- Keep recommendation under 400 characters

Return this exact JSON structure:
{"personalRecommendation": "Your personalized recommendation here", "recommendedOption": "Option name", "agreesWithData": true}`;

export async function POST(request) {
    try {
        const { winner, ranking, weights, scores, hasTie, tiedWinners, userContext, dilemma, options } = await request.json();

        const winnerDisplay = hasTie
            ? tiedWinners.map(w => w.option).join(' and ')
            : winner.option;
        
        const runnerUp = ranking.length > 1 ? ranking[1] : null;
        const scoreGap = runnerUp ? (winner.score - runnerUp.score).toFixed(1) : 0;

        // Generate Part A: Data Analysis
        const dataPrompt = DATA_ANALYSIS_PROMPT
            .replace("{winner}", winnerDisplay)
            .replace("{winnerScore}", winner.score.toFixed(1))
            .replace("{runnerUp}", runnerUp?.option || "N/A")
            .replace("{runnerUpScore}", runnerUp?.score?.toFixed(1) || "N/A")
            .replace("{scoreGap}", scoreGap)
            .replace("{ranking}", JSON.stringify(ranking))
            .replace("{weights}", JSON.stringify(weights))
            .replace("{scores}", JSON.stringify(scores));

        let dataAnalysis = "";
        let whatCouldChange = "";

        try {
            const dataResult = await generateWithRetry(dataPrompt);
            const dataParsed = parseJsonFromResponse(dataResult.response.text());
            dataAnalysis = dataParsed.dataAnalysis || "";
            whatCouldChange = dataParsed.whatCouldChange || "";
        } catch (e) {
            console.error("Data analysis generation failed:", e);
            // Provide a more detailed fallback based on available data
            const topCriteria = Object.entries(weights)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([crit]) => crit);
            
            dataAnalysis = `${winnerDisplay} achieved the highest weighted score of ${winner.score.toFixed(1)} based on your priorities.\n\nYour top priorities were ${topCriteria.join(' and ')}, which significantly influenced this result.`;
            whatCouldChange = `If you increased the weight of lower-priority criteria, the ranking could shift. The runner-up ${runnerUp?.option || 'option'} is ${scoreGap} points behind.`;
        }

        // Generate Part B: Personal Recommendation (only if we have user context)
        let personalRecommendation = "";
        let recommendedOption = winnerDisplay;
        let agreesWithData = true;

        const hasUserContext = userContext && Object.keys(userContext).length > 0;
        
        if (hasUserContext) {
            // Format user context for the prompt
            const contextStr = Object.entries(userContext)
                .filter(([_, v]) => v && v !== 'null' && (typeof v !== 'object' || (Array.isArray(v) && v.length > 0)))
                .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : v}`)
                .join('\n');

            const personalPrompt = PERSONAL_ANALYSIS_PROMPT
                .replace("{dilemma}", dilemma || "Making a decision")
                .replace("{options}", JSON.stringify(options || ranking.map(r => r.option)))
                .replace("{winner}", winnerDisplay)
                .replace("{runnerUp}", runnerUp?.option || "other options")
                .replace("{userContext}", contextStr || "No specific personal details provided.");

            try {
                const personalResult = await generateWithRetry(personalPrompt);
                const personalParsed = parseJsonFromResponse(personalResult.response.text());
                personalRecommendation = personalParsed.personalRecommendation || "";
                recommendedOption = personalParsed.recommendedOption || winnerDisplay;
                agreesWithData = personalParsed.agreesWithData !== false;
            } catch (e) {
                console.error("Personal analysis generation failed:", e);
                // If parsing fails but we have context, provide a basic personal note
                if (contextStr && contextStr.length > 0) {
                    personalRecommendation = `Based on your specific situation (${contextStr.split('\n').slice(0, 2).join('; ')}), ${winnerDisplay} appears to be a strong match. Consider how well it fits your stated preferences and constraints.`;
                    recommendedOption = winnerDisplay;
                } else {
                    personalRecommendation = "";
                }
            }
        }

        return NextResponse.json({
            // Part A: Data-driven analysis
            dataAnalysis,
            whatCouldChange,
            // Part B: Personal recommendation
            personalRecommendation,
            recommendedOption,
            agreesWithData,
            hasUserContext,
            // Legacy field for backwards compatibility
            whyItWon: dataAnalysis
        });

    } catch (error) {
        console.error("Explain API Error:", error);
        return NextResponse.json(
            { error: "Failed to generate explanation" },
            { status: 500 }
        );
    }
}

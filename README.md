ר# DilemmaWise

AI-powered decision support for complex choices. Uses Gemini 2.0 Flash for intelligent conversational guidance and explainable results.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Add Your API np
Create a `.env.local` file in the project root:
```
GOOGLE_AI_API_KEY=your_google_ai_studio_key_here
```
Get your free API key at: https://aistudio.google.com/apikey

### 3. Run the App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Features

- **Smart Elicitation**: AI-guided conversation to structure your decision
- **Verification Step**: Review and toggle extracted options/criteria before proceeding
- **Weighted Scoring**: Prioritize criteria that matter most to you
- **Conversational Rating**: Natural dialogue to infer preferences (no tedious forms!)
- **Context-Aware Questions**: System asks targeted questions based on your specific dilemma
- **Contrastive Explanations**: Understand why one option won (or tied!) and what could change
- **Tie Detection**: Special handling when options score equally
- **Q&A Chat**: Ask follow-up questions about your results
- **State Preservation**: Your choices are saved when navigating back


## User Flow

1. **Describe Dilemma** → Enter your decision in natural language
2. **Verification** → Review extracted options/criteria with toggles
3. **Prioritize Criteria** → Set importance weights (1-5)
4. **Conversational Elicitation** → Answer natural questions to help infer your preferences (≤ 1.5 × criteria × options questions)
5. **View Results** → See winner/tie with LLM-powered explanations


## Tech Stack

- Next.js 16 (App Router)
- React 19
- Google Generative AI (Gemini 2.0 Flash)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze-input/      # Extract options/criteria from description
│   │   ├── chat/               # Smart Elicitation conversation
│   │   ├── elicit-ratings/     # Conversational rating elicitation (NEW)
│   │   ├── validate-facts/     # Fact validation for context-aware questions (NEW)
│   │   ├── explain/            # Contrastive explanations (with tie support)
│   │   └── qa/                 # Q&A about results
│   ├── page.js                 # Main app with phase management
│   └── globals.css             # Styling
├── components/
│   ├── InputPhase.js           # Welcome + Smart Elicitation + Verification
│   ├── CriteriaPhase.js        # Priority weighting
│   ├── ElicitationPhase.js     # Conversational rating elicitation (NEW)
│   ├── ExplanationView.js      # Results + explanations + tie handling
│   └── EditOptionsPhase.js     # Review/edit options mid-flow
└── lib/
    └── gemini.js               # Shared Gemini AI client
```


## Key Design Decisions

- **Anti-hallucination prompts**: LLM only extracts explicitly mentioned items
- **Natural language explanations**: Weights/scores translated (e.g., 5 → "very important")
- **Tie handling**: Special UI and explanations when options score equally
- **State preservation**: Weights, scores, and descriptions persist when navigating back
- **Conversational elicitation**: Natural questions instead of explicit scoring forms
- **Question budget**: Maximum 1.5 × (#criteria × #options) questions to avoid tedium
- **Context-aware**: System adapts questions based on dilemma concreteness


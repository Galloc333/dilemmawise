# DilemmaWise

AI-powered decision support for complex choices. Uses Gemini 2.0 Flash for intelligent conversational guidance and explainable results.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Add Your API Key
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
- **Weighted Scoring**: Prioritize criteria that matter most to you
- **Contrastive Explanations**: Understand why one option won and what could change
- **Q&A Chat**: Ask follow-up questions about your results

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Google Generative AI (Gemini 2.0 Flash)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze-input/   # Extract options/criteria from description
│   │   ├── chat/            # Smart Elicitation conversation
│   │   ├── explain/         # Contrastive explanations
│   │   └── qa/              # Q&A about results
│   ├── page.js              # Main app with phase management
│   └── globals.css          # Styling
├── components/
│   ├── InputPhase.js        # Welcome + Smart Elicitation
│   ├── CriteriaPhase.js     # Priority weighting
│   ├── RatingPhase.js       # Score each option
│   ├── ExplanationView.js   # Results + explanations
│   └── EditOptionsPhase.js  # Review/edit options mid-flow
└── lib/
    └── gemini.js            # Shared Gemini AI client
```

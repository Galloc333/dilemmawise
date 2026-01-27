# Architecture Guide

This document describes the high-level architecture of DilemmaWise.

## Overview

DilemmaWise is a Next.js application that uses Google's Gemini AI to help users make complex decisions. The app follows a phased approach where users progressively refine their decision through conversation and structured input.

## Core Concepts

### Decision Framework

The app implements the **Weighted Sum Model (WSM)**, a multi-criteria decision analysis method:

```
Score(option) = Σ (weight[criterion] × rating[option][criterion])
```

Where:

- **Options** are the alternatives being compared (e.g., "iPhone", "Samsung")
- **Criteria** are factors that matter (e.g., "Price", "Camera Quality")
- **Weights** (1-10) indicate how important each criterion is
- **Ratings** (1-10) indicate how well each option satisfies each criterion

### Application Phases

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Landing   │ ──► │    Input     │ ──► │  Criteria   │ ──► │   Rating    │ ──► │   Results   │
│             │     │              │     │             │     │             │     │             │
│ Welcome +   │     │ Dilemma +    │     │ Set weights │     │ AI-guided   │     │ Winner +    │
│ Features    │     │ Options +    │     │ (1-10)      │     │ questions   │     │ Explanation │
│             │     │ Criteria     │     │             │     │             │     │             │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
```

## Component Architecture

### State Management

State is managed in `src/app/page.js` using React's `useState`. The main state includes:

```javascript
{
  phase: 'landing' | 'input' | 'criteria' | 'rating' | 'explanation' | 'editOptions',
  data: {
    options: string[],
    criteria: string[],
    userContext: Record<string, any>
  },
  weights: Record<string, number>,      // criterion -> weight (1-10)
  savedScores: Record<string, Record<string, number>>,  // option -> criterion -> score
  dilemma: string,
  results: {
    ranking: Array<{ option: string, score: number }>,
    weights: Record<string, number>,
    scores: Record<string, Record<string, number>>
  }
}
```

### Component Hierarchy

```
App (page.js)
├── LandingPage           # Hero + feature showcase
└── AppShell              # Header + navigation wrapper
    ├── InputPhase        # Multi-screen input flow
    │   ├── DILEMMA screen
    │   ├── OPTIONS screen (with chat)
    │   └── CRITERIA screen (with chat)
    ├── CriteriaPhase     # Weight sliders
    ├── ElicitationPhase  # AI-guided rating questions
    │   ├── intro stage
    │   ├── context stage
    │   ├── questions stage
    │   └── complete stage
    └── ExplanationView   # Multi-page results
        ├── Page 1: Winner announcement
        ├── Page 2: Detailed breakdown
        ├── Page 3: LLM recommendation (if context)
        └── Page 4: Suggestions
```

## API Architecture

All API routes are in `src/app/api/` and run server-side only.

### API Endpoints

| Endpoint                    | Method | Purpose                                                      |
| --------------------------- | ------ | ------------------------------------------------------------ |
| `/api/analyze-input`        | POST   | Extract options, criteria, and context from natural language |
| `/api/chat`                 | POST   | Conversational assistant for refining options/criteria       |
| `/api/elicit-ratings`       | POST   | Generate rating questions and infer scores                   |
| `/api/explain`              | POST   | Generate winner explanation and recommendations              |
| `/api/explain-criteria`     | POST   | Generate criteria importance explanations                    |
| `/api/generate-suggestions` | POST   | Generate follow-up options, criteria, dilemmas               |
| `/api/qa`                   | POST   | Answer questions about results                               |
| `/api/refine-text`          | POST   | Fix spelling/grammar in user input                           |
| `/api/web-search`           | POST   | Search for factual information                               |

### AI Integration

The Gemini AI client (`src/lib/gemini.js`) provides:

- **`generateWithRetry(prompt)`** — LLM call with exponential backoff for rate limits
- **`parseJsonFromResponse(text)`** — Robust JSON extraction from LLM responses

Key design decisions:

- All AI prompts use structured JSON output for reliability
- JSON parsing includes multiple fallback strategies for malformed responses
- Rate limit handling with automatic retry (up to 5 attempts with exponential backoff)

## Styling Architecture

### Theme System

The app uses a CSS custom properties-based theme system defined in `globals.css`:

```css
:root {
  --background: 30 25% 97%; /* Warm cream */
  --foreground: 30 10% 15%; /* Near black */
  --primary: 25 70% 45%; /* Terracotta/copper */
  --accent: 30 50% 30%; /* Warm brown */
  /* ... */
}

.dark {
  --background: 30 15% 8%;
  /* Dark mode overrides */
}
```

### CSS Strategy

1. **Tailwind CSS** — Utility classes for layout and spacing
2. **CSS Variables** — Theme colors and design tokens
3. **Radix UI** — Accessible primitive components
4. **Framer Motion** — Animations and transitions

### Component Styling Pattern

```jsx
// UI components use shadcn/ui pattern
import { cn } from '@/lib/utils';

function Button({ className, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl',
        'bg-primary text-primary-foreground',
        className
      )}
      {...props}
    />
  );
}
```

## Data Flow

### Input → Analysis

```
User types dilemma
       │
       ▼
/api/analyze-input
       │
       ├── Extract options (explicit mentions only)
       ├── Extract criteria (explicit mentions only)
       ├── Extract user context (budget, location, etc.)
       └── Generate summarized dilemma
       │
       ▼
InputPhase receives extracted data
       │
       ▼
User refines via chat (/api/chat)
```

### Rating → Results

```
User completes weights (CriteriaPhase)
       │
       ▼
/api/elicit-ratings (mode: 'analyze_context')
       │
       ▼
/api/elicit-ratings (mode: 'generate_questions')
       │
       ├── Generate context-aware questions
       └── Optional: Enrich with web search facts
       │
       ▼
User rates options via sliders (1-10)
       │
       ▼
/api/elicit-ratings (mode: 'infer_ratings')
       │
       ▼
Client-side WSM calculation (page.js)
       │
       ▼
ExplanationView displays results
       │
       ├── /api/explain (winner explanation)
       └── /api/generate-suggestions (follow-ups)
```

## Performance Considerations

### API Optimization

- Questions are enriched with web search **in parallel** (Promise.all)
- Rate limiting handled with exponential backoff
- Large responses use streaming where possible

### Client Optimization

- Phase components lazy-loaded via dynamic imports
- Animations use GPU-accelerated transforms
- Images use Next.js Image optimization

## Security

- All API keys are server-side only (never in client bundle)
- User input is sanitized before rendering (React handles XSS)
- No database = no SQL injection vectors
- Environment variables validated at startup

## Future Considerations

- **State Persistence**: Consider localStorage or database for resume functionality
- **API Caching**: Cache common LLM responses to reduce latency
- **Streaming**: Implement streaming responses for long explanations
- **Testing**: Add integration tests for critical user flows

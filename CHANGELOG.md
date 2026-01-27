# Changelog

All notable changes to DilemmaWise will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-26

### Added

- **Premium UI Redesign**
  - Warm, elegant theme with terracotta/copper accents
  - Dark mode support via `next-themes`
  - Smooth animations with Framer Motion
  - Responsive design for mobile and desktop

- **Landing Page**
  - Feature showcase with icons
  - "How it works" section with step-by-step guide
  - Animated call-to-action buttons

- **Input Phase**
  - Natural language dilemma input
  - AI-powered option and criteria extraction
  - Conversational chat interface for refinement
  - Multi-screen flow (Dilemma → Options → Criteria)

- **Criteria Phase**
  - Visual weight sliders (1-10 scale)
  - Circular progress indicators
  - AI-generated criteria explanations on hover
  - Summary of top priorities

- **Rating Phase (Elicitation)**
  - AI-generated context-aware questions
  - 1-10 slider ratings per option
  - Optional web search enrichment with facts
  - Progressive disclosure of web evidence

- **Results Phase**
  - Winner announcement with confetti celebration
  - Animated score counter
  - Detailed breakdown with criterion contributions
  - LLM-powered recommendations (context-aware)
  - Dynamic suggestions (other options, missing criteria, follow-up dilemmas)

- **Technical Features**
  - Google Gemini 2.5 Flash integration
  - Robust JSON parsing with multiple fallback strategies
  - Rate limit handling with exponential backoff
  - Optional Google Custom Search integration

- **UI Components**
  - shadcn/ui-style component library
  - Button, Card, Slider, Progress, Tooltip, Switch
  - Skeleton loaders for async content
  - Toast notifications (Sonner)

- **Developer Experience**
  - TypeScript support (mixed JS/TS)
  - ESLint configuration
  - Tailwind CSS with custom theme
  - Comprehensive documentation

### Security

- All API keys are server-side only
- Environment variable validation
- XSS protection via React's built-in sanitization

---

## [Unreleased]

### Planned

- User authentication and saved decisions
- Share results via unique links
- Export to PDF
- Multi-language support
- Automated testing

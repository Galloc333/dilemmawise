# DilemmaWise

**AI-powered decision support for complex choices.**

DilemmaWise helps you make better decisions through structured analysis and AI-guided conversation. Describe your dilemma in natural language, and the app will guide you through a proven decision-making framework.

## Features

- **Conversational Input** — Describe your decision naturally; AI extracts options and criteria automatically
- **Smart Elicitation** — Answer targeted questions to rate options (no tedious forms)
- **Weighted Scoring** — Prioritize what matters most with intuitive sliders
- **Explainable Results** — Understand _why_ an option won with detailed breakdowns
- **Web-Enhanced Facts** — Optional web search enriches questions with real-world data
- **Beautiful UI** — Premium warm theme with smooth animations and dark mode support

## Tech Stack

| Category  | Technology                                      |
| --------- | ----------------------------------------------- |
| Framework | Next.js 16 (App Router)                         |
| Language  | TypeScript + JavaScript (mixed)                 |
| UI        | React 19, Tailwind CSS, Radix UI, Framer Motion |
| AI        | Google Gemini 2.5 Flash                         |
| Styling   | Tailwind CSS + CSS Variables                    |

## Requirements

**Option A: Docker (Recommended)**
- **Docker Desktop** (easiest way to run in any environment)
- **Google AI API Key** (free tier available)

**Option B: Manual Setup**
- **Node.js** 18.17 or later (20.x recommended)
- **npm** 9+ or **pnpm** 8+
- **Google AI API Key** (free tier available)

## Quick Start

### Option A: Run with Docker (Recommended)

Docker provides the easiest way to run DilemmaWise in any environment without installing Node.js or managing dependencies.

#### 1. Install Docker Desktop

Download and install Docker Desktop for your operating system:
- **Windows/Mac**: https://www.docker.com/products/docker-desktop
- **Linux**: `sudo apt-get install docker.io docker-compose`

After installation, **open Docker Desktop** and wait for it to start (check the system tray for the whale icon 🐋).

#### 2. Clone the repository

```bash
git clone https://github.com/maximbudnev/dilemmawise.git
cd dilemmawise
```

#### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
GOOGLE_AI_API_KEY=your_api_key_here
```

Get your free API key at: https://aistudio.google.com/apikey

#### 4. Start the application

```bash
docker-compose up --build
```

The first build takes 3-5 minutes. Subsequent starts are much faster.

#### 5. Access the application

Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Docker Commands

| Command | Description |
| ------- | ----------- |
| `docker-compose up` | Start the application |
| `docker-compose up -d` | Start in background (detached) |
| `docker-compose down` | Stop and remove containers |
| `docker-compose logs -f` | View real-time logs |
| `Ctrl + C` | Stop the application |

---

### Option B: Run with Node.js (Development)

For local development with hot reload and debugging.

#### 1. Clone the repository

```bash
git clone https://github.com/maximbudnev/dilemmawise.git
cd dilemmawise
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```env
GOOGLE_AI_API_KEY=your_api_key_here
```

Get your free API key at: https://aistudio.google.com/apikey

#### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable                | Required | Description                                            |
| ----------------------- | -------- | ------------------------------------------------------ |
| `GOOGLE_AI_API_KEY`     | **Yes**  | Google AI Studio API key for Gemini                    |
| `GOOGLE_SEARCH_API_KEY` | No       | Google Custom Search API key (enables real web search) |
| `SEARCH_ENGINE_ID`      | No       | Google Custom Search Engine ID                         |

All environment variables are **server-side only** and never exposed to the client bundle.

### Where to get API keys

- **GOOGLE_AI_API_KEY**: [Google AI Studio](https://aistudio.google.com/apikey) (free tier: 15 RPM)
- **GOOGLE_SEARCH_API_KEY**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (optional)
- **SEARCH_ENGINE_ID**: [Programmable Search Engine](https://programmablesearchengine.google.com/) (optional)

## Scripts

### Docker Commands

| Command                     | Description                       |
| --------------------------- | --------------------------------- |
| `docker-compose up --build` | Build and start the application   |
| `docker-compose up`         | Start the application             |
| `docker-compose up -d`      | Start in background               |
| `docker-compose down`       | Stop and remove containers        |
| `docker-compose logs -f`    | View logs in real-time            |

### Node.js Commands

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Start development server with hot reload |
| `npm run build`        | Create production build                  |
| `npm start`            | Start production server                  |
| `npm run lint`         | Run ESLint                               |
| `npm run typecheck`    | Run TypeScript type checking             |
| `npm run format`       | Format code with Prettier                |
| `npm run format:check` | Check code formatting                    |

## Project Structure

```
src/
├── app/
│   ├── api/                    # Backend API routes (server-side only)
│   │   ├── analyze-input/      # Extract options/criteria from text
│   │   ├── chat/               # Conversational AI assistant
│   │   ├── elicit-ratings/     # Generate rating questions
│   │   ├── explain/            # Generate result explanations
│   │   ├── explain-criteria/   # Explain criteria importance
│   │   ├── generate-suggestions/ # Generate follow-up suggestions
│   │   ├── qa/                 # Q&A about results
│   │   ├── refine-text/        # Text refinement/spelling
│   │   ├── validate-facts/     # Fact validation
│   │   ├── validate-matrix/    # Matrix validation
│   │   └── web-search/         # Web search endpoint
│   ├── globals.css             # Global styles + Tailwind + theme
│   ├── layout.tsx              # Root layout with providers
│   └── page.js                 # Main app with phase management
├── components/
│   ├── ui/                     # Reusable UI components (shadcn-style)
│   ├── AppShell.tsx            # App layout wrapper
│   ├── LandingPage.tsx         # Landing/hero page
│   ├── InputPhase.js           # Dilemma input + options + criteria
│   ├── CriteriaPhase.js        # Criteria weight setting
│   ├── ElicitationPhase.js     # AI-guided rating questions
│   ├── ExplanationView.js      # Results + explanations + suggestions
│   └── ...
├── hooks/
│   ├── useConfetti.js          # Confetti animation hook
│   └── useCountUp.js           # Number animation hook
└── lib/
    ├── gemini.js               # Gemini AI client + utilities
    ├── webSearch.js            # Web search logic
    └── utils.ts                # General utilities (cn, etc.)
```

## User Flow

1. **Landing** → Welcome page with feature overview
2. **Input** → Describe your dilemma; AI extracts options and criteria
3. **Criteria** → Set importance weights (1-10) for each criterion
4. **Rating** → Answer AI-generated questions to rate each option
5. **Results** → View winner, detailed breakdown, and AI recommendations

## Troubleshooting

### Docker Issues

#### "Docker is not running" or "cannot connect to Docker daemon"

- Make sure Docker Desktop is **running** (check system tray for whale icon)
- On Windows, ensure WSL2 is installed: `wsl --install`
- Restart Docker Desktop or your computer

#### Port 3000 already in use

Change the port in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Use port 8080 instead
```

Then access the app at http://localhost:8080

#### Need to rebuild after code changes

```bash
docker-compose down
docker-compose up --build
```

### Node.js Issues

#### "Missing API Key" or API errors

- Ensure `.env.local` exists with `GOOGLE_AI_API_KEY=your_key`
- Restart the dev server after changing env vars
- Check that your API key is valid at [AI Studio](https://aistudio.google.com/)

#### Styles not applying / Tailwind not working

```bash
# Clear Next.js cache and restart
rm -rf .next
npm run dev
```

#### Node version mismatch

This project requires Node.js 18.17+. Check your version:

```bash
node --version
```

If using nvm:

```bash
nvm use
```

#### Build errors

```bash
# Clean install
rm -rf node_modules .next
npm install
npm run build
```

## Deployment

DilemmaWise can be deployed to any platform that supports Docker or Node.js.

### Deploy with Docker

The included `Dockerfile` and `docker-compose.yml` work with any Docker-compatible platform:

- **Render.com** — Easiest, auto-detects Dockerfile
- **Railway.app** — Simple GitHub integration
- **Google Cloud Run** — Serverless containers
- **AWS ECS** — Elastic Container Service
- **Azure Container Instances** — Managed containers
- **DigitalOcean App Platform** — Simple Docker deployment

Make sure to set the `GOOGLE_AI_API_KEY` environment variable in your platform's settings.

### Deploy with Vercel/Netlify

For traditional Next.js deployment without Docker:

```bash
npm run build
npm start
```

Or connect your repository to [Vercel](https://vercel.com) for automatic deployments.

## Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md) — How the app works
- [Contributing Guide](./docs/CONTRIBUTING.md) — How to contribute
- [Changelog](./CHANGELOG.md) — Version history
- [Security Policy](./SECURITY.md) — Report vulnerabilities

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

Built with Next.js and Google Gemini AI.

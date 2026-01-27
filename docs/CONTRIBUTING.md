# Contributing Guide

Thank you for your interest in contributing to DilemmaWise! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 18.17+ (20.x recommended)
- npm 9+ or pnpm 8+
- Git
- A Google AI Studio API key (free)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/dilemmawise.git
   cd dilemmawise
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment:
   ```bash
   cp .env.example .env.local
   # Add your GOOGLE_AI_API_KEY
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Strategy

- `main` — Production-ready code
- `feature/*` — New features
- `fix/*` — Bug fixes
- `docs/*` — Documentation updates

### Making Changes

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run checks:

   ```bash
   npm run lint          # Check for lint errors
   npm run typecheck     # Check TypeScript types
   npm run format:check  # Check formatting
   npm run build         # Ensure it builds
   ```

4. Commit with a descriptive message:

   ```bash
   git commit -m "feat: Add new feature description"
   ```

5. Push and open a Pull Request

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `style:` — Code style (formatting, no logic change)
- `refactor:` — Code refactoring
- `test:` — Adding tests
- `chore:` — Maintenance tasks

Examples:

```
feat: Add dark mode toggle
fix: Resolve rating slider not updating
docs: Update API documentation
refactor: Extract useCountUp hook
```

## Code Style

### General Guidelines

- Use TypeScript for new components (`.tsx`)
- Use JavaScript for existing components (don't convert unless necessary)
- Follow existing patterns in the codebase
- Keep components focused and single-purpose
- Add comments for complex logic

### Formatting

We use Prettier for code formatting. Run before committing:

```bash
npm run format
```

Or check without modifying:

```bash
npm run format:check
```

### Linting

ESLint is configured with Next.js recommended rules:

```bash
npm run lint
```

### TypeScript

Type check without building:

```bash
npm run typecheck
```

### File Organization

```
src/
├── app/
│   ├── api/         # API routes only (server-side)
│   └── ...          # Pages and layouts
├── components/
│   ├── ui/          # Reusable UI primitives
│   └── ...          # Feature components
├── hooks/           # Custom React hooks
└── lib/             # Utilities and shared logic
```

### Component Pattern

```tsx
// Use functional components with TypeScript
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return <div className="...">{/* Component content */}</div>;
}
```

### Styling Pattern

Use Tailwind CSS utility classes:

```tsx
// Good
<div className="flex items-center gap-4 p-4 rounded-xl bg-card">

// Avoid inline styles unless necessary
<div style={{ display: 'flex' }}>  // Only when dynamic values needed
```

## Testing

### Manual Testing Checklist

Before submitting a PR, verify these flows work:

1. **Input Flow**
   - [ ] Can enter a dilemma
   - [ ] AI extracts options and criteria
   - [ ] Can add/remove options via chat
   - [ ] Can add/remove criteria via chat

2. **Criteria Phase**
   - [ ] Sliders work correctly
   - [ ] Tooltips show explanations
   - [ ] Can navigate back

3. **Rating Phase**
   - [ ] Questions generate correctly
   - [ ] Sliders update scores
   - [ ] Web facts display (if enabled)
   - [ ] Can complete and proceed

4. **Results Phase**
   - [ ] Winner displays correctly
   - [ ] Confetti animation plays
   - [ ] Breakdown is accurate
   - [ ] Suggestions load
   - [ ] Can start new analysis

5. **General**
   - [ ] Dark mode works
   - [ ] Mobile responsive
   - [ ] No console errors

### Automated Tests

Currently, the project does not have automated tests. Contributions to add testing infrastructure are welcome!

## Pull Request Process

1. Ensure all checks pass (`lint`, `typecheck`, `build`)
2. Update documentation if needed
3. Fill out the PR template
4. Request review from maintainers
5. Address review feedback
6. Squash and merge when approved

### PR Title Format

Follow the commit convention:

```
feat: Add new feature
fix: Resolve bug description
docs: Update README
```

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Security**: See [SECURITY.md](../SECURITY.md)

## Code of Conduct

Be respectful and constructive in all interactions. We're all here to build something great together.

---

Thank you for contributing!

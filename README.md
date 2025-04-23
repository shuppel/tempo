# Tempo

> Formerly known as **Torodoro**

![Tempo Logo](public/assets/logo/tempo_logo.png)

**Tempo** is a local-first, AI-powered productivity app that transforms your daily task dump into optimized, focused work sessions using Pomodoro-inspired timeboxing. Designed for knowledge workers, students, and anyone who wants to plan smarter, Tempo helps you prioritize, schedule, and complete your most important work—one session at a time. Tempo leverages micro AI throughout the app for fast, contextual, and privacy-respecting task management.

---

## Features

- **Local-First**: Your data stays on your device by default, with real-time sync and offline support.
- **Micro AI**: Contextual, lightweight AI is used throughout the app for parsing, prioritizing, and optimizing tasks—without heavy cloud dependencies.
- **AI Task Parsing & Prioritization**: Paste or type your tasks, and Tempo uses AI to split, categorize, and prioritize them (including 🐸 "Frog" tasks for your most critical work).
- **Session Planning**: Automatically organizes tasks into Pomodoro-style work blocks with optimal breaks and debriefs.
- **Task Board**: Visualize, drag-and-drop, edit, and manage your tasks and sessions.
- **Progress Metrics**: Get real-time feedback on your productivity, including time estimates, focus stories, and frog count.
- **Customizable Durations**: Adjust work and break times to fit your workflow.
- **Modern UI**: Responsive, accessible, and beautiful—supports dark/light mode.
- **Integrations**: (Planned) Connect with tools like Linear, Vercel, and more.

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repo
 git clone https://github.com/your-org/tempo.git
 cd tempo

# Install dependencies
 npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to use Tempo.

---

## Usage

1. **Brain Dump**: Enter your tasks in the input area. Use clear verbs, estimate times (e.g., `30m design review`), and mark priority tasks with 🐸.
2. **Analyze**: Click "Analyze" to let AI split and optimize your tasks into sessions.
3. **Review & Edit**: Adjust durations, categories, and priorities as needed.
4. **Session Planning**: Tempo creates a Pomodoro-style plan with work blocks, breaks, and debriefs.
5. **Task Board**: Drag, drop, edit, or delete tasks. Visualize your workflow and progress.
6. **Start Working**: Use the built-in timer and progress metrics to stay on track.

---

## Tech Stack

- **Next.js** (App Router)
- **React** (with hooks)
- **TypeScript**
- **TailwindCSS** (custom themes, dark/light mode)
- **Replicache** (sync engine)
- **Radix UI** (accessible components)
- **AI SDKs** (OpenAI, Anthropic)
- **Framer Motion** (animations)
- **TanStack React Query** (data fetching/caching)
- **Million.js** (performance)
- **Lucide React** (icons)
- **date-fns** (date utilities)
- **nanoid** (ID generation)
- **lodash.debounce** (debouncing)
- **class-variance-authority**, **clsx** (utility classes)
- **react-icons** (icon packs)
- **tailwind-merge**, **tailwindcss-animate** (utility helpers)
- **ESLint**, **Prettier** (linting/formatting)
- **Husky**, **lint-staged** (git hooks)
- **TypeScript ESLint** (type linting)
- **PostCSS**, **Autoprefixer** (CSS tooling)
- **decode** (Planned: for data validation/decoding)

---

## CI/CD

Tempo uses GitHub Actions for continuous integration and deployment:

- **Lint & Type Check**: Runs ESLint and TypeScript checks on every push and pull request.
- **Build**: Builds the app and uploads build artifacts.
- **(Optional) Test**: Ready for test integration (just uncomment in workflow).
- **Deploy Preview**: Deploys a preview build for pull requests (customizable for your deployment provider).

---

## Contributing

We welcome contributions! Please:

- Run `npm run lint` and `npm run type-check` before submitting PRs.
- Use `npm run format` to auto-format code.
- Check the [FEATURES](FEATURES) and [CHANGELOG.md](CHANGELOG.md) for current work and ideas.
- Open issues for bugs, suggestions, or questions.

---

## License

[MIT](LICENSE) © Toro/Tempo Team

---

## Credits & Acknowledgements

- Inspired by Pomodoro, "Eat That Frog", and modern productivity research.
- Built with love by the Toro/Tempo team.
- Thanks to the open-source community and all contributors!

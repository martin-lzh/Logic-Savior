# Logic Saver

A mobile-first web app that transforms raw, chaotic social media text into clean, structured Markdown using LLMs. Bring Your Own Key — no server stores any user data or API credentials.

## Features

- **Dual provider support** — choose between OpenRouter (Claude 3.5 Haiku) and OpenAI (GPT-4o Mini) at runtime
- **BYOK model** — API keys stay in your browser's `localStorage` and are never persisted server-side
- **Real-time streaming** — SSE-based token streaming with live Markdown preview
- **Dark mode** — system-respecting toggle with Anthropic-style editorial design
- **Mobile-first** — fixed action bar, auto-resizing textarea, 44px touch targets

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, Tailwind CSS 3, Lucide Icons, Pinia |
| Backend | Vercel Edge Function (TypeScript) |
| LLM | OpenRouter or OpenAI (user-selected) |

## Local Development

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Vercel CLI** (optional, for testing the Edge Function locally)

### Setup

```bash
# Clone the repo
git clone https://github.com/<your-username>/Logic-Saver.git
cd Logic-Saver

# Install dependencies
npm install
```

### Run the dev server

```bash
npm run dev
```

Opens at `http://localhost:5173`. The Edge Function at `/api/text-inference` runs locally via a Vite dev middleware — no Vercel CLI needed for development.

### Type check

```bash
npx vue-tsc --noEmit
```

### Production build

```bash
npm run build
```

Output lands in `dist/`.

### Preview the production build

```bash
npm run preview
```

## Deployment

### Vercel (recommended)

The project includes a GitHub Actions workflow that deploys automatically on push.

#### First-time setup

1. **Import the repo** on [vercel.com/new](https://vercel.com/new) or run `npx vercel link` locally.
2. In your Vercel project settings, set the **Framework Preset** to `Vite`.
3. Generate a Vercel token at [vercel.com/account/tokens](https://vercel.com/account/tokens).
4. Add these **GitHub repository secrets** (`Settings → Secrets and variables → Actions`):

   | Secret | Value |
   |--------|-------|
   | `VERCEL_TOKEN` | Your Vercel personal access token |
   | `VERCEL_ORG_ID` | From `.vercel/project.json` after `npx vercel link` |
   | `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `npx vercel link` |

#### How it works

- **Push to `main`** → production deploy
- **Push to any other branch / PR** → preview deploy

The workflow runs type checking and build verification before deploying.

## Project Structure

```
├── api/
│   └── text-inference.ts   # Vercel Edge Function (LLM proxy)
├── src/
│   ├── composables/
│   │   └── useChat.ts      # Streaming composable (SSE, abort, errors)
│   ├── App.vue             # Main SPA shell
│   ├── main.ts             # Vue entry point
│   ├── style.css           # Tailwind directives + base styles
│   └── env.d.ts            # TypeScript declarations
├── tailwind.config.js      # Design tokens + typography plugin
├── vercel.json             # Rewrites for SPA + Edge Functions
└── package.json
```

## License

See [LICENSE](LICENSE).

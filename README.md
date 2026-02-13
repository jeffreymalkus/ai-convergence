# AI Convergence Runner

**One input → Collaborative multi-model refinement → Build-ready output**

## What This Does

Automates the back-and-forth you've been doing manually between ChatGPT, Gemini, and Claude. You input an idea once, and two models iteratively refine it until both agree it's complete.

## Architecture

- **Frontend**: Next.js + React + TypeScript + Tailwind
- **Backend**: API routes (server-side orchestration)
- **Auth**: BYOK (Bring Your Own API Keys)
- **Storage**: Local (OS keychain recommended for desktop build)

## Key Concepts

### Artifact Templates
Defines what you're building (Email, Proposal, Spec, Script, etc.) with:
- Required input fields
- Output section schema
- Completeness rubric
- Convergence policy

### Provider Adapters
Unified interface for OpenAI, Anthropic (Claude), Google (Gemini):
- testConnection()
- generate()
- validateJson()

### Convergence Loop
1. Writer (Model A) creates initial draft
2. Collaborator (Model B) refines with structured JSON feedback
3. Writer integrates improvements
4. Collaborator validates
5. Repeat until: `ready==true AND score>=9` OR maxRounds

## Project Structure

```
ai-convergence/
├── src/
│   ├── app/
│   │   ├── api/converge/     # API orchestration endpoint
│   │   ├── components/       # React components
│   │   └── page.tsx          # Main UI
│   └── lib/
│       ├── providers/        # OpenAI, Anthropic, Google adapters
│       ├── templates/        # Artifact type definitions
│       ├── types/            # TypeScript interfaces
│       └── utils/            # Convergence engine core
├── config/                    # Environment and settings
├── docs/                      # Architecture and design docs
└── README.md
```

## Setup

### Prerequisites
- Node.js 18+
- API keys for:
  - OpenAI (https://platform.openai.com/api-keys)
  - Anthropic Claude (https://console.anthropic.com/settings/keys)
  - Google Gemini (https://aistudio.google.com/app/apikey)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env.local`
2. Add your API keys:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

### Run

```bash
npm run dev
```

Open http://localhost:3000

## Usage

1. **Select artifact type** (Email, Proposal, Spec, Script, etc.)
2. **Fill inputs** (goal, audience, constraints)
3. **Click "Converge"**
4. **Review final output** (with optional round log)
5. **Export** (copy, download markdown)

## Estimated Costs

Per convergence run (3-5 rounds):
- GPT-4 mini + Gemini Pro: ~$0.04
- GPT-4 + Claude Sonnet: ~$0.15
- GPT-4 + Gemini Pro: ~$0.08

## Next Steps

- [ ] Implement core convergence engine
- [ ] Build provider adapters
- [ ] Create 3 starter templates (Email, Spec, Script)
- [ ] Build UI components
- [ ] Add export functionality
- [ ] Optional: Desktop app (Electron/Tauri) for keychain storage

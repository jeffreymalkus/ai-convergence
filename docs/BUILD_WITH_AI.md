# Building AI Convergence with Claude Code or Antigravity

This guide shows how to use AI builders to implement the Convergence Runner.

## Overview

You have:
- ✅ Complete folder structure
- ✅ Type definitions
- ✅ Architecture docs
- ✅ Two example templates
- ✅ Implementation roadmap (NEXT_STEPS.md)

What's left to build:
- Provider adapters (OpenAI, Anthropic, Google)
- Convergence engine
- API route
- Frontend UI

## Option 1: Claude Code (Recommended)

### Setup

1. Install Claude Code if you haven't:
```bash
npm install -g claude-code
```

2. Navigate to project:
```bash
cd /path/to/ai-convergence
```

3. Start Claude Code:
```bash
claude-code
```

### Build Commands

Give Claude Code these instructions in order:

#### Phase 1: Core Engine

```
Read the architecture in docs/ARCHITECTURE.md and types in src/lib/types/index.ts.

Then implement the three provider adapters:
- src/lib/providers/openai-adapter.ts
- src/lib/providers/anthropic-adapter.ts
- src/lib/providers/google-adapter.ts
- src/lib/providers/index.ts (factory)

Each adapter should:
- Implement the ProviderAdapter interface
- Read API keys from environment variables
- Support testConnection(), generate(), and generateJson()
- Handle errors and retries
- Use the official SDK for each provider

After adapters, implement the convergence engine at src/lib/utils/convergence-engine.ts following the loop logic in ARCHITECTURE.md.

Test each piece as you go.
```

#### Phase 2: API Layer

```
Create the API route at src/app/api/converge/route.ts.

It should:
- Accept POST with ConvergeRequest body
- Validate input with Zod
- Load template, create providers, call runConvergence()
- Return ConvergeResponse
- Handle errors and rate limiting

Use Next.js 14 App Router conventions.
```

#### Phase 3: Frontend

```
Build the main UI page at src/app/page.tsx.

Include:
1. Template selector dropdown
2. Dynamic form (renders fields from selected template)
3. Provider/model selectors for Writer and Collaborator
4. Advanced settings (collapsed): maxRounds, scoreThreshold, showLog
5. "Run Convergence" button
6. Results panel with final output, round log, and export buttons

Use Tailwind CSS. Keep it clean and functional.
Handle loading/error states properly.
```

### Testing

```
Help me test the full flow:
1. Start the dev server
2. Test connection to all three providers
3. Run a convergence with Email template
4. Run a convergence with Software Spec template
5. Verify the output quality and stop conditions
```

---

## Option 2: Antigravity

### Preparation

Antigravity works best with a single comprehensive prompt. Combine the build instructions into one spec.

### Build Prompt for Antigravity

```
I have a Next.js project scaffolded for an AI Convergence Runner.

Architecture:
- Multi-model collaboration system
- Two AI models (Writer + Collaborator) iteratively refine an artifact
- Stops when both agree it's complete (score >= 9 and ready==true)
- Uses OpenAI, Anthropic, and Google APIs

Existing files:
- Complete type definitions in src/lib/types/index.ts
- Two artifact templates: email-reply.ts and software-spec.ts
- Architecture doc in docs/ARCHITECTURE.md
- Package.json with dependencies

Build these components:

1. Provider Adapters (src/lib/providers/):
   - openai-adapter.ts: Implement ProviderAdapter for OpenAI (gpt-4, gpt-4-mini)
   - anthropic-adapter.ts: Implement ProviderAdapter for Anthropic (claude-sonnet-4, claude-opus-4)
   - google-adapter.ts: Implement ProviderAdapter for Google (gemini-pro, gemini-flash)
   - index.ts: Factory function to create adapters by type
   Each adapter: testConnection(), generate(), generateJson() with JSON schema validation

2. Convergence Engine (src/lib/utils/convergence-engine.ts):
   - Main function: async runConvergence(config: ConvergenceConfig): Promise<ConvergenceResult>
   - Loop: Writer drafts → Collaborator refines (JSON) → Writer integrates → check stop condition
   - Stop when: ready==true && score>=threshold OR noMaterialImprovements OR maxRounds
   - Compress context after round 3 (summarize old rounds to save tokens)
   - Track tokens, cost, time per round

3. API Route (src/app/api/converge/route.ts):
   - Next.js 14 App Router API endpoint
   - POST accepts ConvergeRequest, returns ConvergeResponse
   - Validate with Zod, load template, create providers, call runConvergence()
   - Add rate limiting and error handling

4. Frontend (src/app/page.tsx):
   - Template selector (dropdown)
   - Dynamic form (renders fields from selected template.inputs)
   - Provider/model selectors for Writer and Collaborator
   - Advanced settings (collapsed): maxRounds, scoreThreshold, showLog toggle
   - Run button that calls /api/converge
   - Results panel: final output, stop reason, cost, expandable round log
   - Export: Copy and Download Markdown buttons
   - Use Tailwind CSS, handle loading/error states

5. Configuration:
   - next.config.js (if needed)
   - tailwind.config.ts with sensible defaults
   - src/app/globals.css for base styles

Make sure all TypeScript types are correctly used from src/lib/types/index.ts.
API keys should come from environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY).

Implement error handling, retries for API calls, and graceful degradation throughout.
```

---

## Option 3: Manual Build

If you prefer to code manually:

1. **Start with provider adapters** - easiest to test in isolation
2. **Build convergence engine** - test with mock adapters first
3. **Add API route** - test with curl/Postman
4. **Build UI** - start with template selector and form, add results panel last

---

## Environment Setup

Before running, create `.env.local`:

```bash
cp .env.example .env.local
```

Add your API keys:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

Get keys from:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Google: https://aistudio.google.com/app/apikey

---

## Install Dependencies

```bash
npm install
```

This will install:
- next, react, react-dom
- openai, @anthropic-ai/sdk, @google/generative-ai
- zod (for validation)
- TypeScript, Tailwind CSS

---

## Run Dev Server

```bash
npm run dev
```

Open http://localhost:3000

---

## Verification

Test the full flow:

1. Select "Email Reply" template
2. Fill in: recipient, context, goal
3. Choose Writer (e.g., GPT-4 mini) and Collaborator (e.g., Gemini Pro)
4. Click "Run Convergence"
5. Verify:
   - Loading state shows
   - Final output appears
   - Stop reason is shown
   - Round log is visible (if enabled)
   - Copy and Download work

Then test "Software Spec" template with a more complex feature.

---

## Cost Monitoring

After each run, check the results panel for:
- Total tokens used
- Estimated cost
- Rounds completed

Typical costs:
- Email (3 rounds): $0.02 - $0.05
- Software Spec (5 rounds): $0.10 - $0.20

---

## Troubleshooting

**"API key not found"**
- Check `.env.local` exists and has correct keys
- Restart dev server after adding keys

**"JSON parsing error from collaborator"**
- The collaborator returned invalid JSON
- Engine should retry once with schema reminder
- If still fails, check the model supports JSON mode

**"Max rounds reached but not complete"**
- Score threshold might be too high (try 8 instead of 9)
- Or the task is genuinely ambiguous (add more context)

**High costs**
- Use cheaper models (gpt-4-mini, gemini-flash)
- Lower maxRounds
- Check token counts per round

---

## Next: Add More Templates

Once the MVP works, add more templates:
- Video script
- Proposal
- Business idea
- Custom (user-defined sections)

Follow the pattern in `src/lib/templates/email-reply.ts`.

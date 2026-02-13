# Implementation Roadmap

This document outlines the build order for the AI Convergence Runner.

## Phase 1: Core Engine (Foundation)

**Goal**: Get the convergence loop working server-side

### 1.1 Provider Adapters
**Priority**: CRITICAL
**Files to create**:
- `src/lib/providers/openai-adapter.ts`
- `src/lib/providers/anthropic-adapter.ts`
- `src/lib/providers/google-adapter.ts`
- `src/lib/providers/index.ts`

**Requirements**:
- Implement `ProviderAdapter` interface for each
- Add connection testing
- Handle API errors gracefully
- Support both text generation and JSON-schema-constrained generation

**Prompt for Claude Code/Antigravity**:
```
Implement the three provider adapters (OpenAI, Anthropic, Google) that conform to the ProviderAdapter interface in src/lib/types/index.ts.

Each adapter should:
- Read API key from environment variables
- Implement testConnection() to verify the key works
- Implement generate() for text completion
- Implement generateJson() with JSON schema validation/repair
- Handle rate limits and network errors with retries
- Support model selection (e.g., gpt-4, gpt-4-mini, claude-sonnet-4, gemini-pro)

Use official SDKs:
- OpenAI: openai package
- Anthropic: @anthropic-ai/sdk
- Google: @google/generative-ai

Export a factory function that creates adapters by provider type.
```

### 1.2 Convergence Engine
**Priority**: CRITICAL
**File to create**: `src/lib/utils/convergence-engine.ts`

**Requirements**:
- Orchestrate Writer ↔ Collaborator loop
- Apply patches from collaborator feedback
- Enforce stop conditions
- Compress context after round 3 (summarize old rounds)
- Track tokens and costs
- Return full ConvergenceResult

**Prompt for Claude Code/Antigravity**:
```
Implement the convergence engine that runs the Writer ↔ Collaborator loop.

Core function signature:
async function runConvergence(config: ConvergenceConfig): Promise<ConvergenceResult>

Loop logic:
1. Writer generates initial draft using template.writerSystemPrompt + user inputs
2. For each round (up to maxRounds):
   a. Collaborator analyzes draft, returns structured JSON (CollaboratorResponse)
   b. If JSON is invalid, retry once with schema reminder
   c. Check stop conditions:
      - ready==true AND score>=threshold → STOP (THRESHOLD_MET)
      - noMaterialImprovements==true (2 consecutive) → STOP (NO_IMPROVEMENTS)
      - round >= maxRounds → STOP (MAX_ROUNDS)
   d. Writer integrates collaborator feedback:
      - Apply patches
      - Address mustFix items
      - Resolve questions
   e. Log round data (draft, feedback, tokens, time)
3. After round 3, compress old rounds into summary to save tokens
4. Return final draft + full round log

Include robust error handling. If any call fails, return best-known draft with stopReason="ERROR_FALLBACK".
```

---

## Phase 2: API Layer

**Goal**: Expose convergence via HTTP endpoint

### 2.1 API Route
**Priority**: CRITICAL
**File to create**: `src/app/api/converge/route.ts`

**Requirements**:
- POST endpoint accepting ConvergeRequest
- Load template by ID
- Create provider adapters with API keys from env
- Call convergence engine
- Return ConvergeResponse
- Add input validation (Zod schemas)
- Add rate limiting
- Add request timeout (max 5 minutes)

**Prompt for Claude Code/Antigravity**:
```
Create a Next.js API route at src/app/api/converge/route.ts that:
- Accepts POST requests with ConvergeRequest body
- Validates input using Zod
- Loads the artifact template
- Creates provider adapters (reads keys from env)
- Calls runConvergence()
- Returns ConvergeResponse JSON
- Handles errors gracefully with clear messages
- Includes basic rate limiting (max 10 req/min per client)
- Times out after 5 minutes

Use Next.js 14 App Router patterns.
```

---

## Phase 3: Frontend UI

**Goal**: Build the user interface

### 3.1 Main Page
**Priority**: HIGH
**File to create**: `src/app/page.tsx`

**Requirements**:
- Template selector dropdown
- Dynamic input form (based on selected template)
- Provider/model selectors for Writer and Collaborator
- Advanced settings (collapsed): maxRounds, scoreThreshold
- "Run Convergence" button
- Results display area
- Export buttons (Copy, Download Markdown)

**Prompt for Claude Code/Antigravity**:
```
Create the main UI page at src/app/page.tsx with:

1. Template selector (dropdown showing all templates)
2. Dynamic form that renders input fields based on selected template
3. Provider selectors:
   - Writer: OpenAI (gpt-4, gpt-4-mini) | Anthropic (claude-sonnet-4) | Google (gemini-pro)
   - Collaborator: Same options
4. Advanced settings (accordion):
   - Max rounds (1-10, default from template)
   - Score threshold (1-10, default from template)
   - Show log toggle
5. "Run Convergence" button
6. Results panel:
   - Final output (markdown rendered)
   - Stop reason badge
   - Cost/token info
   - Expandable round log (if showLog enabled)
   - Copy and Download buttons

Use Tailwind for styling. Keep it clean and functional.
Handle loading states, errors, and empty states properly.
```

### 3.2 Components
**Priority**: MEDIUM
**Files to create**:
- `src/app/components/TemplateSelector.tsx`
- `src/app/components/DynamicForm.tsx`
- `src/app/components/ProviderSelector.tsx`
- `src/app/components/ResultsPanel.tsx`
- `src/app/components/RoundLog.tsx`

(These can be extracted from page.tsx if it gets too large)

---

## Phase 4: Polish & UX

### 4.1 Tailwind Config
**Priority**: MEDIUM
**Files**: `tailwind.config.ts`, `src/app/globals.css`

Set up Tailwind with sensible defaults.

### 4.2 Error Boundaries
**Priority**: MEDIUM

Add React error boundaries for graceful degradation.

### 4.3 Loading States
**Priority**: MEDIUM

Show current round number and animated progress during run.

---

## Phase 5: Additional Templates

**Priority**: LOW (after MVP works)

Add these templates following the same pattern:
- `video-script.ts` (YouTube/TikTok scripts)
- `proposal.ts` (SOW, project proposals)
- `business-idea.ts` (one-pager startup pitch)
- `custom.ts` (user defines their own sections)

---

## Phase 6: Enhancements (Future)

- [ ] Run history (save to localStorage or database)
- [ ] Template marketplace (import community templates)
- [ ] Multi-collaborator mode (3+ models)
- [ ] Streaming responses (real-time updates)
- [ ] Desktop app (Electron/Tauri) with OS keychain
- [ ] Cost analytics dashboard
- [ ] Export to Google Docs/Notion

---

## Testing Checklist

Before considering MVP complete:

- [ ] All three provider adapters connect successfully
- [ ] Convergence loop reaches THRESHOLD_MET stop condition
- [ ] Convergence loop handles MAX_ROUNDS correctly
- [ ] Invalid collaborator JSON is retried and handled
- [ ] Patches are applied correctly to drafts
- [ ] Token counting and cost estimates are accurate
- [ ] Context compression kicks in after round 3
- [ ] Error fallback returns partial result
- [ ] UI shows loading state during run
- [ ] Results panel displays final output correctly
- [ ] Round log shows all rounds with feedback
- [ ] Copy and Download work
- [ ] Multiple templates work (test both Email and Spec)
- [ ] Different provider combinations work (GPT+Claude, GPT+Gemini, etc.)

---

## Recommended Build Order

If using Claude Code or Antigravity to build:

**Day 1**: Phase 1 (Provider Adapters + Convergence Engine)
**Day 2**: Phase 2 (API Route) + Basic frontend shell
**Day 3**: Phase 3 (Full UI) + Polish
**Day 4**: Testing + bug fixes
**Day 5**: Additional templates (if desired)

---

## Quick Start Command

Once you have the structure, tell Claude Code:

```
Build Phase 1 and Phase 2. Start with provider adapters, then convergence engine, then API route. Use the prompts in docs/NEXT_STEPS.md for each component. Test each piece before moving to the next.
```

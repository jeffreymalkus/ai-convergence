# Architecture

## Design Principles

1. **Deterministic over emergent**: Fixed roles, structured outputs, clear stop rules
2. **Template-driven**: Artifact types define shape, not prompts
3. **Provider-agnostic**: Swap models without changing convergence logic
4. **Collaboration not critique**: Both models co-own completion
5. **Cost-conscious**: Token compression, max rounds, smart defaults

## System Flow

```
User Input
    ↓
Select Artifact Template
    ↓
POST /api/converge
    ↓
┌─────────────────────────────────────┐
│   Convergence Loop (server-side)    │
│                                     │
│   1. Writer generates draft         │
│   2. Collaborator refines (JSON)    │
│   3. Writer integrates              │
│   4. Collaborator validates (JSON)  │
│   5. Check stop condition           │
│   6. Repeat or finalize             │
└─────────────────────────────────────┘
    ↓
Return: { final, rounds[], stopReason }
    ↓
Display Results + Export
```

## Core Components

### 1. Convergence Engine (`src/lib/utils/convergence-engine.ts`)

```typescript
interface ConvergenceConfig {
  idea: string
  context?: string
  template: ArtifactTemplate
  writer: ProviderAdapter
  collaborator: ProviderAdapter
  maxRounds: number
  scoreThreshold: number
}

async function runConvergence(config: ConvergenceConfig): Promise<ConvergenceResult>
```

**Responsibilities:**
- Orchestrate Writer ↔ Collaborator loop
- Enforce stop conditions
- Compress context when needed
- Handle retries and fallbacks

### 2. Provider Adapters (`src/lib/providers/`)

Unified interface for all AI providers:

```typescript
interface ProviderAdapter {
  name: string
  testConnection(): Promise<boolean>
  generate(prompt: string, options?: GenerateOptions): Promise<string>
  validateJson<T>(prompt: string, schema: JSONSchema): Promise<T>
}
```

**Implementations:**
- `openai-adapter.ts` (GPT-4, GPT-4 mini)
- `anthropic-adapter.ts` (Claude Sonnet, Opus)
- `google-adapter.ts` (Gemini Pro, Flash)

### 3. Artifact Templates (`src/lib/templates/`)

Define what "complete" means for each deliverable type:

```typescript
interface ArtifactTemplate {
  id: string
  name: string
  description: string
  inputs: FieldDefinition[]
  outputSchema: SectionDefinition[]
  rubric: RubricDimension[]
  convergencePolicy: {
    maxRounds: number
    scoreThreshold: number
    requireQuestionsResolved: boolean
  }
  writerPrompt: (inputs) => string
  collaboratorPrompt: (draft) => string
}
```

**Starter Templates:**
- `email-reply.ts`
- `software-spec.ts`
- `video-script.ts`
- `proposal.ts`
- `custom.ts`

### 4. Collaborator JSON Schema

Structured feedback contract:

```typescript
interface CollaboratorResponse {
  score: number                    // 1-10
  ready: boolean                   // true when complete
  mustFix: string[]               // Critical issues
  shouldImprove: string[]         // Optional enhancements
  questions: string[]             // Open questions
  patches: Patch[]                // Specific edits
  noMaterialImprovements: boolean // Convergence signal
}

interface Patch {
  path: string        // e.g., "Body/Paragraph2"
  replaceWith: string // Updated content
}
```

### 5. Stop Conditions

Loop terminates when ANY of:
1. `ready == true AND score >= threshold`
2. `noMaterialImprovements == true` (2 consecutive rounds)
3. `maxRounds` reached
4. Error fallback

## Data Flow

### Request
```json
{
  "idea": "Build a feature prompt for user auth",
  "context": "Next.js app, using Supabase",
  "templateId": "software-spec",
  "writerModel": "gpt-4",
  "collaboratorModel": "claude-sonnet-4",
  "maxRounds": 4,
  "scoreThreshold": 9
}
```

### Response
```json
{
  "final": "...",
  "stopReason": "THRESHOLD_MET",
  "rounds": [
    {
      "roundNum": 1,
      "draft": "...",
      "collaboratorFeedback": {...},
      "tokensUsed": 2500
    }
  ],
  "totalCost": 0.06,
  "metadata": {
    "template": "software-spec",
    "modelsUsed": ["gpt-4", "claude-sonnet-4"]
  }
}
```

## Security

- **API keys**: Never sent to client, server-side only
- **Rate limiting**: Per-user limits on /api/converge
- **Input validation**: Sanitize all user inputs
- **Cost caps**: Hard token limits per request

## Performance

- **Token compression**: Summarize old rounds after round 3
- **Parallel validation**: Test connection to all providers at startup
- **Caching**: Template definitions loaded once
- **Streaming**: Optional streaming response for real-time updates (future)

## Extension Points

### Add New Provider
1. Implement `ProviderAdapter` interface
2. Add to `src/lib/providers/index.ts`
3. Update UI provider selector

### Add New Template
1. Create file in `src/lib/templates/`
2. Export from `src/lib/templates/index.ts`
3. Appears automatically in UI

### Custom Convergence Logic
Override `convergencePolicy` in template definition

## Cost Model

Estimated tokens per round:
- Input: ~1000 (draft) + 500 (instructions) = 1500
- Output: ~1000 (revised) + 200 (JSON) = 1200

4 rounds × 2700 tokens/round = ~10,800 tokens total

At GPT-4 rates: ~$0.15/run
At GPT-4 mini rates: ~$0.03/run

## Future Enhancements

- [ ] Multi-collaborator mode (3+ models)
- [ ] Critic hardening pass (final validation)
- [ ] Template marketplace
- [ ] Run history/analytics
- [ ] Desktop app (Electron/Tauri)
- [ ] Browser extension (UI automation fallback)

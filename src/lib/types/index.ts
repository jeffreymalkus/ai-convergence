// Core type definitions for AI Convergence Runner

// ============================================================================
// Provider Types
// ============================================================================

export interface GenerateOptions {
  temperature?: number
  maxTokens?: number
  model?: string
  systemPrompt?: string
}

export interface ProviderAdapter {
  name: string
  models: string[]
  testConnection(): Promise<boolean>
  generate(prompt: string, options?: GenerateOptions): Promise<string>
  generateJson<T>(prompt: string, schema: any, options?: GenerateOptions): Promise<T>
}

export type ProviderType = 'openai' | 'anthropic' | 'google'

// ============================================================================
// Artifact Template Types
// ============================================================================

export interface FieldDefinition {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required: boolean
  placeholder?: string
  options?: string[]
  defaultValue?: string
}

export interface SectionDefinition {
  id: string
  label: string
  description: string
  required: boolean
}

export interface RubricDimension {
  id: string
  label: string
  description: string
  weight: number
}

export interface ConvergencePolicy {
  maxRounds: number
  scoreThreshold: number
  requireQuestionsResolved: boolean
  requireAllSectionsPresent: boolean
}

export interface ArtifactTemplate {
  id: string
  name: string
  description: string
  icon?: string
  inputs: FieldDefinition[]
  outputSchema: SectionDefinition[]
  rubric: RubricDimension[]
  convergencePolicy: ConvergencePolicy
  writerSystemPrompt: string
  collaboratorSystemPrompt: string
}

// ============================================================================
// Convergence Loop Types
// ============================================================================

export interface Patch {
  path: string // Section/Subsection identifier
  operation: 'replace' | 'add' | 'remove'
  content: string
}

export interface CollaboratorResponse {
  score: number // 1-10
  ready: boolean
  mustFix: string[]
  shouldImprove: string[]
  questions: string[]
  patches: Patch[]
  noMaterialImprovements: boolean
}

export interface ConvergenceRound {
  roundNum: number
  draft: string
  collaboratorFeedback: CollaboratorResponse
  tokensUsed: number
  timeMs: number
}

export interface ConvergenceConfig {
  idea: string
  context?: string
  template: ArtifactTemplate
  writerProvider: ProviderAdapter
  collaboratorProvider: ProviderAdapter
  writerModel: string
  collaboratorModel: string
  maxRounds: number
  scoreThreshold: number
}

export type StopReason =
  | 'THRESHOLD_MET'
  | 'MAX_ROUNDS'
  | 'NO_IMPROVEMENT'
  | 'ERROR_FALLBACK'

export interface ConvergenceResult {
  final: string
  stopReason: StopReason
  rounds: ConvergenceRound[]
  totalCost: number
  totalTokens: number
  totalTimeMs: number
  metadata: {
    templateId: string
    writerModel: string
    collaboratorModel: string
  }
}

// ============================================================================
// API Types
// ============================================================================

export interface ConvergeRequest {
  idea: string
  context?: string
  templateId: string
  writerProvider: ProviderType
  collaboratorProvider: ProviderType
  writerModel: string
  collaboratorModel: string
  maxRounds?: number
  scoreThreshold?: number
  showLog?: boolean
}

export interface ConvergeResponse {
  success: boolean
  data?: ConvergenceResult
  error?: string
}

// ============================================================================
// UI State Types
// ============================================================================

export interface RunState {
  status: 'idle' | 'running' | 'completed' | 'error'
  currentRound?: number
  result?: ConvergenceResult
  error?: string
}

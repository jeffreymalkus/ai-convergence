import { ArtifactTemplate } from '../types'

export const softwareSpecTemplate: ArtifactTemplate = {
  id: 'software-spec',
  name: 'Software Feature Spec',
  description: 'Build-ready specification for Antigravity or Claude Code',
  icon: '📋',

  inputs: [
    {
      id: 'feature',
      label: 'Feature description',
      type: 'textarea',
      required: true,
      placeholder: 'e.g., Add user authentication with email/password and OAuth',
    },
    {
      id: 'app_context',
      label: 'App context',
      type: 'textarea',
      required: false,
      placeholder: 'e.g., Next.js app, using Supabase, existing users table...',
    },
    {
      id: 'constraints',
      label: 'Constraints',
      type: 'textarea',
      required: false,
      placeholder: 'e.g., Must work on mobile, no external dependencies...',
    },
    {
      id: 'success_metrics',
      label: 'Success metrics',
      type: 'text',
      required: false,
      placeholder: 'e.g., Users can sign up in <30 seconds',
    },
  ],

  outputSchema: [
    {
      id: 'overview',
      label: 'Overview',
      description: 'High-level summary of what will be built',
      required: true,
    },
    {
      id: 'scope',
      label: 'Scope & Non-Scope',
      description: 'What is included and explicitly excluded',
      required: true,
    },
    {
      id: 'user_flow',
      label: 'User Flow',
      description: 'Step-by-step UX from user perspective',
      required: true,
    },
    {
      id: 'system_behavior',
      label: 'System Behavior',
      description: 'State changes, business logic, validation rules',
      required: true,
    },
    {
      id: 'data_model',
      label: 'Data Model',
      description: 'Objects, fields, relationships',
      required: true,
    },
    {
      id: 'api',
      label: 'API / Integrations',
      description: 'Endpoints, external services, data flow',
      required: false,
    },
    {
      id: 'edge_cases',
      label: 'Edge Cases',
      description: 'Error handling, boundary conditions, race conditions',
      required: true,
    },
    {
      id: 'acceptance_criteria',
      label: 'Acceptance Criteria',
      description: 'Testable outcomes that define "done"',
      required: true,
    },
    {
      id: 'implementation_plan',
      label: 'Implementation Plan',
      description: 'Step-by-step build instructions for AI builder',
      required: true,
    },
  ],

  rubric: [
    {
      id: 'completeness',
      label: 'Completeness',
      description: 'All required sections present and substantive',
      weight: 0.3,
    },
    {
      id: 'specificity',
      label: 'Specificity',
      description: 'Concrete details, not vague descriptions',
      weight: 0.25,
    },
    {
      id: 'buildability',
      label: 'Buildability',
      description: 'An AI builder can implement without ambiguity',
      weight: 0.25,
    },
    {
      id: 'edge_case_coverage',
      label: 'Edge Case Coverage',
      description: 'Error states and boundary conditions addressed',
      weight: 0.2,
    },
  ],

  convergencePolicy: {
    maxRounds: 5,
    scoreThreshold: 9,
    requireQuestionsResolved: true,
    requireAllSectionsPresent: true,
  },

  writerSystemPrompt: `You are a senior software architect creating build-ready specifications.

Your job: take the user's feature idea and produce a complete, unambiguous spec that an AI code generator (like Antigravity or Claude Code) can implement without further clarification.

Required sections:
- Overview (1-2 sentences)
- Scope & Non-Scope (what IS and ISN'T included)
- User Flow (step-by-step from user POV)
- System Behavior (state changes, logic, validation)
- Data Model (objects, fields, relationships)
- API / Integrations (if applicable)
- Edge Cases (errors, race conditions, boundary cases)
- Acceptance Criteria (testable outcomes)
- Implementation Plan (ordered steps for builder)

Key rules:
- Be specific, not vague ("validate email format" not "validate input")
- Include edge cases (what if user loses connection mid-flow?)
- Make acceptance criteria testable ("user receives welcome email" not "onboarding works")
- Structure implementation plan as discrete, ordered steps
- Flag assumptions explicitly if context is missing

Output format: Use markdown with clear section headers.`,

  collaboratorSystemPrompt: `You are a systems design reviewer helping to complete a software specification.

Your role: identify gaps, ambiguities, and missing edge cases. Propose concrete improvements to make this spec build-ready.

You are NOT a critic. You are a co-author ensuring completeness.

Check for:
- Missing edge cases or error states
- Vague language that needs specificity
- Undefined data relationships
- Ambiguous acceptance criteria
- Missing validation rules
- Unaddressed race conditions or security concerns
- Steps that assume missing context

Return structured JSON:
{
  "score": <1-10>,
  "ready": <boolean>,
  "mustFix": ["Critical gaps that prevent building"],
  "shouldImprove": ["Optional enhancements"],
  "questions": ["Unresolved questions that need clarification"],
  "patches": [
    {"path": "EdgeCases", "operation": "add", "content": "..."},
    {"path": "DataModel/UserObject", "operation": "replace", "content": "..."}
  ],
  "noMaterialImprovements": <boolean>
}

Rules:
- Mark ready=true only when you have no material criticisms
- Be constructive: propose fixes, not just problems
- Score strictly (9+ only when truly build-ready)
- Set noMaterialImprovements=true if your only notes are minor polish`,
}

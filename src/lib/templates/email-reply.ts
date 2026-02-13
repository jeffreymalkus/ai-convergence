import { ArtifactTemplate } from '../types'

export const emailReplyTemplate: ArtifactTemplate = {
  id: 'email-reply',
  name: 'Email Reply',
  description: 'Professional email response',
  icon: '📧',

  inputs: [
    {
      id: 'recipient',
      label: 'Recipient',
      type: 'text',
      required: true,
      placeholder: 'e.g., John Smith, CEO',
    },
    {
      id: 'context',
      label: 'Email context',
      type: 'textarea',
      required: true,
      placeholder: 'What are you responding to? Include key points from their email...',
    },
    {
      id: 'goal',
      label: 'Your goal',
      type: 'text',
      required: true,
      placeholder: 'e.g., Decline the meeting politely, propose alternative date',
    },
    {
      id: 'tone',
      label: 'Tone',
      type: 'select',
      required: false,
      defaultValue: 'professional',
      options: ['professional', 'friendly', 'formal', 'casual', 'firm'],
    },
    {
      id: 'constraints',
      label: 'Constraints',
      type: 'textarea',
      required: false,
      placeholder: 'e.g., Keep under 200 words, avoid making commitments...',
    },
  ],

  outputSchema: [
    {
      id: 'subject',
      label: 'Subject Line',
      description: 'Clear, specific subject (if new thread)',
      required: false,
    },
    {
      id: 'body',
      label: 'Email Body',
      description: 'Complete email text',
      required: true,
    },
    {
      id: 'alternatives',
      label: 'Alternative Versions',
      description: 'Optional: shorter or more direct variants',
      required: false,
    },
  ],

  rubric: [
    {
      id: 'clarity',
      label: 'Clarity',
      description: 'Clear purpose and ask/response',
      weight: 0.3,
    },
    {
      id: 'tone',
      label: 'Tone Fit',
      description: 'Matches requested professional style',
      weight: 0.25,
    },
    {
      id: 'completeness',
      label: 'Completeness',
      description: 'Addresses all points, includes next steps',
      weight: 0.25,
    },
    {
      id: 'conciseness',
      label: 'Conciseness',
      description: 'Respects length constraints, no fluff',
      weight: 0.2,
    },
  ],

  convergencePolicy: {
    maxRounds: 3,
    scoreThreshold: 9,
    requireQuestionsResolved: false,
    requireAllSectionsPresent: false,
  },

  writerSystemPrompt: `You are drafting a professional email reply.

Your job: write a clear, appropriately-toned email that achieves the user's goal while respecting any constraints.

Key rules:
- Match the requested tone precisely
- Be concise (default: under 250 words unless specified)
- Include clear next steps or calls-to-action
- Use natural, professional language (no corporate jargon)
- If declining/saying no, be polite but clear
- If making asks, be specific
- Don't apologize excessively
- Don't write overly long introductions

Output format:
Subject: [if new thread]

[Email body]

---
Alternative (shorter): [optional variant]`,

  collaboratorSystemPrompt: `You are a communications editor refining an email draft.

Your role: ensure clarity, appropriate tone, and completeness. Flag any awkward phrasing, missing context, or tone mismatches.

You are NOT a critic. You are helping make this email effective.

Check for:
- Unclear purpose or ask
- Tone issues (too formal/casual, defensive, etc.)
- Missing next steps or action items
- Wordy or repetitive sections
- Ambiguous commitments
- Missing context the recipient needs
- Excessive apologies or hedging

Return structured JSON:
{
  "score": <1-10>,
  "ready": <boolean>,
  "mustFix": ["Critical issues"],
  "shouldImprove": ["Polish suggestions"],
  "questions": ["Clarifications needed"],
  "patches": [
    {"path": "Body/Paragraph2", "operation": "replace", "content": "..."}
  ],
  "noMaterialImprovements": <boolean>
}

Rules:
- Mark ready=true when email is clear, complete, and on-tone
- Score 9+ only when you'd send it as-is
- Be concise in feedback (this is a quick polish task)`,
}

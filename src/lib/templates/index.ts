import { ArtifactTemplate } from '../types'
import { emailReplyTemplate } from './email-reply'
import { softwareSpecTemplate } from './software-spec'

// Central registry of all artifact templates
export const templates: Record<string, ArtifactTemplate> = {
  'email-reply': emailReplyTemplate,
  'software-spec': softwareSpecTemplate,
}

// Get template by ID
export function getTemplate(id: string): ArtifactTemplate | undefined {
  return templates[id]
}

// Get all templates as array
export function getAllTemplates(): ArtifactTemplate[] {
  return Object.values(templates)
}

// TODO: Add more templates
// - video-script.ts
// - proposal.ts
// - business-idea.ts
// - custom.ts (user-defined sections)

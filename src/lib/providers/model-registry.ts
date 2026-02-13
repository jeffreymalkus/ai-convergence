import { ProviderType } from '../types';

export type ModelOption = { id: string; label: string };

export const MODEL_REGISTRY: Record<ProviderType, ModelOption[]> = {
    openai: [
        { id: 'gpt-4o', label: 'GPT-4o (Strong)' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
        { id: 'gpt-4.1', label: 'GPT-4.1' },
        { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    ],
    anthropic: [
        { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Strong)' },
        { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
        { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ],
    google: [
        { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Fast)' },
        { id: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro (Strong)' },
        { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
};

export function getDefaultModels(templateId: string): { writerModel: string; collaboratorModel: string } {
    if (templateId === 'software-spec') {
        return {
            writerModel: 'claude-sonnet-4-5-20250929',
            collaboratorModel: 'gpt-4o',
        };
    }

    // Default (e.g., email-reply) faster/cheaper
    return {
        writerModel: 'gpt-4o-mini',
        collaboratorModel: 'claude-haiku-4-5-20251001',
    };
}

import { ProviderType } from '../types';

export type ModelOption = { id: string; label: string };

export const MODEL_REGISTRY: Record<ProviderType, ModelOption[]> = {
    openai: [
        { id: 'gpt-4o', label: 'GPT-4o (Strong)' },
        { id: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
        { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
        { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet (Strong)' },
        { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)' },
    ],
    google: [
        { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Strong)' },
        { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast)' },
        { id: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' },
    ],
};

export function getDefaultModels(templateId: string): { writerModel: string; collaboratorModel: string } {
    if (templateId === 'software-spec') {
        return {
            writerModel: 'claude-3-5-sonnet-20240620',
            collaboratorModel: 'gpt-4o',
        };
    }

    // Default (e.g., email-reply) faster/cheaper
    return {
        writerModel: 'gpt-4o-mini',
        collaboratorModel: 'claude-3-haiku-20240307',
    };
}

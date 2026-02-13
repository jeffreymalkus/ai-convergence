import { ProviderType, ProviderAdapter } from '../types';
import { OpenAIAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { GoogleAdapter } from './google-adapter';

export function getProvider(type: ProviderType): ProviderAdapter {
    switch (type) {
        case 'openai':
            return new OpenAIAdapter();
        case 'anthropic':
            return new AnthropicAdapter();
        case 'google':
            return new GoogleAdapter();
        default:
            throw new Error(`Provider not found: ${type}`);
    }
}

export { OpenAIAdapter, AnthropicAdapter, GoogleAdapter };

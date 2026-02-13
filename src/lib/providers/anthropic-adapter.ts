import Anthropic from '@anthropic-ai/sdk';
import { GenerateOptions, ProviderAdapter } from '../types';
import { validateAndRetry } from '../utils/json';
import { z } from 'zod';

export class AnthropicAdapter implements ProviderAdapter {
    readonly name = 'Anthropic';
    readonly models = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-2.1'];
    private client: Anthropic;

    constructor(apiKey?: string) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Ping' }],
            });
            return true;
        } catch (error) {
            console.error('Anthropic connection failed:', error);
            return false;
        }
    }

    async generate(prompt: string, options?: GenerateOptions): Promise<string> {
        const response = await this.client.messages.create({
            model: options?.model || 'claude-3-sonnet-20240229',
            max_tokens: options?.maxTokens || 4096,
            temperature: options?.temperature ?? 0.7,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        return content.type === 'text' ? content.text : '';
    }

    async generateJson<T>(prompt: string, schema: any, options?: GenerateOptions): Promise<T> {
        const generateFn = async () => {
            const systemPrompt = 'You are a helpful assistant that outputs only valid JSON. Do not include any explanation or markdown formatting.';
            const response = await this.client.messages.create({
                model: options?.model || 'claude-3-sonnet-20240229',
                max_tokens: options?.maxTokens || 4096,
                temperature: options?.temperature ?? 0,
                system: systemPrompt,
                messages: [{ role: 'user', content: `Respond with valid JSON only. ${prompt}` }],
            });

            const content = response.content[0];
            return content.type === 'text' ? content.text : '{}';
        };

        const zodSchema = schema instanceof z.ZodType ? schema : z.any();
        return validateAndRetry(generateFn, zodSchema);
    }
}

import OpenAI from 'openai';
import { GenerateOptions, ProviderAdapter } from '../types';
import { validateAndRetry } from '../utils/json';
import { z } from 'zod';

export class OpenAIAdapter implements ProviderAdapter {
    readonly name = 'OpenAI';
    readonly models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
    private client: OpenAI;

    constructor(apiKey?: string) {
        this.client = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY,
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.models.list();
            return true;
        } catch (error) {
            console.error('OpenAI connection failed:', error);
            return false;
        }
    }

    async generate(prompt: string, options?: GenerateOptions): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: options?.model || 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens,
        });

        return response.choices[0]?.message?.content || '';
    }

    async generateJson<T>(prompt: string, schema: any, options?: GenerateOptions): Promise<T> {
        const generateFn = async () => {
            const response = await this.client.chat.completions.create({
                model: options?.model || 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that outputs only valid JSON. Do not include any explanation or markdown formatting outside the JSON.'
                    },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: options?.temperature ?? 0,
                max_tokens: options?.maxTokens,
            });

            return response.choices[0]?.message?.content || '{}';
        };

        const zodSchema = schema instanceof z.ZodType ? schema : z.any();
        return validateAndRetry(generateFn, zodSchema);
    }
}

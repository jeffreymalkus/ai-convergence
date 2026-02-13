import { GoogleGenerativeAI } from '@google/generative-ai';
import { GenerateOptions, ProviderAdapter } from '../types';
import { validateAndRetry } from '../utils/json';
import { z } from 'zod';

export class GoogleAdapter implements ProviderAdapter {
    readonly name = 'Google';
    readonly models = ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    private genAI: GoogleGenerativeAI;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GOOGLE_API_KEY;
        this.genAI = new GoogleGenerativeAI(key || '');
    }

    async testConnection(): Promise<boolean> {
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            await model.generateContent('Ping');
            return true;
        } catch (error) {
            console.error('Google connection failed:', error);
            return false;
        }
    }

    async generate(prompt: string, options?: GenerateOptions): Promise<string> {
        const model = this.genAI.getGenerativeModel({
            model: options?.model || 'gemini-2.0-flash'
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
            },
        });

        const response = await result.response;
        return response.text();
    }

    async generateJson<T>(prompt: string, schema: any, options?: GenerateOptions): Promise<T> {
        const generateFn = async () => {
            const model = this.genAI.getGenerativeModel({
                model: options?.model || 'gemini-2.0-flash',
            });

            const result = await model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: `Respond with valid JSON only. Do not include markdown formatting or explanations. ${prompt}` }] }
                ],
                generationConfig: {
                    temperature: options?.temperature ?? 0,
                    maxOutputTokens: options?.maxTokens,
                    responseMimeType: 'application/json',
                },
            });

            const response = await result.response;
            let text = response.text();

            // Fallback cleaning if model wraps in markdown despite responseMimeType
            if (text.includes('```json')) {
                text = text.split('```json')[1].split('```')[0].trim();
            } else if (text.includes('```')) {
                text = text.split('```')[1].split('```')[0].trim();
            }

            return text;
        };

        const zodSchema = schema instanceof z.ZodType ? schema : z.any();
        return validateAndRetry(generateFn, zodSchema);
    }
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GenerateOptions, ProviderAdapter } from '../types';
import { validateAndRetry } from '../utils/json';
import { z } from 'zod';

export class GoogleAdapter implements ProviderAdapter {
    readonly name = 'Google';
    readonly models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];
    private genAI: GoogleGenerativeAI;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GOOGLE_API_KEY;
        this.genAI = new GoogleGenerativeAI(key || '');
    }

    async testConnection(): Promise<boolean> {
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent('Ping');
            return true;
        } catch (error) {
            console.error('Google connection failed:', error);
            return false;
        }
    }

    async generate(prompt: string, options?: GenerateOptions): Promise<string> {
        const model = this.genAI.getGenerativeModel({
            model: options?.model || 'gemini-1.5-pro'
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
                model: options?.model || 'gemini-1.5-pro',
                // Note: Some models support responseMimeType: "application/json"
            });

            const result = await model.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: `Respond with valid JSON only. Do not include markdown formatting or explanations. ${prompt}` }] }
                ],
                generationConfig: {
                    temperature: options?.temperature ?? 0,
                    maxOutputTokens: options?.maxTokens,
                },
            });

            const response = await result.response;
            let text = response.text();

            // Basic cleaning for Gemini if it wraps in markdown
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

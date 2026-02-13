import { ZodSchema } from 'zod';

export async function validateAndRetry<T>(
    generateFn: () => Promise<string>,
    schema: ZodSchema<T>,
    maxRetries: number = 1
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            let content = await generateFn();

            // 1. Strip markdown code fences if present
            if (content.includes('```json')) {
                content = content.split('```json')[1].split('```')[0].trim();
            } else if (content.includes('```')) {
                content = content.split('```')[1].split('```')[0].trim();
            }

            // 2. If parsing still fails, try to extract the first valid JSON-like substring
            try {
                const parsed = JSON.parse(content);
                return schema.parse(parsed);
            } catch (parseError) {
                // Attempt extraction
                const firstBrace = content.indexOf('{');
                const firstBracket = content.indexOf('[');
                const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;

                if (start !== -1) {
                    const lastBrace = content.lastIndexOf('}');
                    const lastBracket = content.lastIndexOf(']');
                    const end = lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket) ? lastBrace : lastBracket;

                    if (end !== -1 && end > start) {
                        const extracted = content.substring(start, end + 1);
                        const parsed = JSON.parse(extracted);
                        return schema.parse(parsed);
                    }
                }
                throw parseError;
            }
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
                console.warn(`Validation failed, retrying... (Attempt ${attempt + 1})`, error);
                continue;
            }
        }
    }

    throw new Error(`Failed to generate valid JSON after ${maxRetries} retries: ${lastError?.message}`);
}

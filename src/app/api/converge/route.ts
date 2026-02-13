import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runConvergence } from '@/lib/utils/convergence-engine';
import { ConvergeRequest, ProviderType } from '@/lib/types';
import { randomUUID } from 'crypto';

// Rate limiting in-memory storage (MVP)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 10;

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const userData = rateLimitMap.get(ip);

    if (!userData || now - userData.lastReset > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { count: 1, lastReset: now });
        return false;
    }

    if (userData.count >= MAX_REQUESTS) {
        return true;
    }

    userData.count += 1;
    return false;
}

// Zod schema matching ConvergeRequest
const ConvergeRequestSchema = z.object({
    idea: z.string().min(1),
    context: z.string().optional(),
    templateId: z.string().min(1),
    writerProvider: z.enum(['openai', 'anthropic', 'google']),
    collaboratorProvider: z.enum(['openai', 'anthropic', 'google']),
    writerModel: z.string(),
    collaboratorModel: z.string(),
    maxRounds: z.number().int().min(1).max(10).optional(),
    scoreThreshold: z.number().min(1).max(10).optional(),
    showLog: z.boolean().optional(),
});

function checkEnv(provider: ProviderType): { keyName: string; isPresent: boolean } {
    const keyName =
        provider === 'openai' ? 'OPENAI_API_KEY' :
            provider === 'anthropic' ? 'ANTHROPIC_API_KEY' :
                'GOOGLE_API_KEY';
    return { keyName, isPresent: !!process.env[keyName] };
}

function normalizeModelId(provider: ProviderType, modelLabel: string): string {
    const label = modelLabel.trim();
    const slug = label.toLowerCase();

    if (provider === 'openai') {
        if (slug.includes('gpt-4o mini') || slug === 'gpt-4o-mini') return 'gpt-4o-mini';
        if (slug.includes('gpt-4o') || slug === 'gpt-4o') return 'gpt-4o';
        if (slug.includes('gpt-3.5 turbo') || slug === 'gpt-3.5-turbo') return 'gpt-4o-mini';
        return label; // Fallback to raw label if it might be an ID
    }

    if (provider === 'google') {
        if (slug.includes('gemini 1.5 pro') || slug === 'gemini-1.5-pro') return 'gemini-1.5-pro';
        if (slug.includes('gemini 1.5 flash') || slug === 'gemini-1.5-flash') return 'gemini-1.5-flash';
        return label;
    }

    if (provider === 'anthropic') {
        if (slug.includes('claude 3.5 sonnet') || slug === 'claude-3-5-sonnet-20240620') return 'claude-3-5-sonnet-20240620';
        if (slug.includes('claude 3 opus')) return 'claude-3-opus-20240229';
        if (slug.includes('claude 3 sonnet')) return 'claude-3-sonnet-20240229';
        if (slug.includes('claude 3 haiku')) return 'claude-3-haiku-20240307';
        return label;
    }

    throw new Error(`Unsupported provider: ${provider}`);
}

export async function POST(req: NextRequest) {
    const requestId = randomUUID();

    // 1. Rate Limiting
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    if (isRateLimited(ip)) {
        return NextResponse.json(
            { success: false, error: 'Too many requests. Please try again in 10 minutes.', requestId },
            { status: 429 }
        );
    }

    try {
        // 2. Body Parsing & Validation
        const body = await req.json();
        const result = ConvergeRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid request body', details: result.error.format(), requestId },
                { status: 400 }
            );
        }

        const request = result.data as ConvergeRequest;

        // 3. Env Validation (Canonical)
        const writerEnv = checkEnv(request.writerProvider);
        const collaboratorEnv = checkEnv(request.collaboratorProvider);

        // TEMP DEBUG LOGS
        console.log(`[DEBUG] rid=${requestId} writer_provider=${request.writerProvider} key=${writerEnv.keyName} found=${writerEnv.isPresent}`);
        console.log(`[DEBUG] rid=${requestId} collaborator_provider=${request.collaboratorProvider} key=${collaboratorEnv.keyName} found=${collaboratorEnv.isPresent}`);

        if (!writerEnv.isPresent) {
            return NextResponse.json({ success: false, error: `Missing ${writerEnv.keyName}`, requestId }, { status: 400 });
        }
        if (!collaboratorEnv.isPresent) {
            return NextResponse.json({ success: false, error: `Missing ${collaboratorEnv.keyName}`, requestId }, { status: 400 });
        }

        // 4. Model Normalization
        try {
            const originalWriterModel = request.writerModel;
            const originalCollaboratorModel = request.collaboratorModel;

            request.writerModel = normalizeModelId(request.writerProvider, request.writerModel);
            request.collaboratorModel = normalizeModelId(request.collaboratorProvider, request.collaboratorModel);

            console.log(`[DEBUG] rid=${requestId} writer_model: IN="${originalWriterModel}" OUT="${request.writerModel}"`);
            console.log(`[DEBUG] rid=${requestId} collaborator_model: IN="${originalCollaboratorModel}" OUT="${request.collaboratorModel}"`);
        } catch (normError: any) {
            return NextResponse.json({ success: false, error: normError.message, requestId }, { status: 400 });
        }

        // 5. Core Logic with Timeout
        const TIMEOUT_MS = 60 * 1000;

        const convergencePromise = runConvergence(request);
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
        );

        const response = await Promise.race([convergencePromise, timeoutPromise]);

        // 6. Safe Logging (Summary)
        const stopReason = response.success ? response.data?.stopReason : 'N/A';
        const totalTimeMs = response.success ? response.data?.totalTimeMs : 0;
        console.log(`[CONVERGE] rid=${requestId} tid=${request.templateId} wp=${request.writerProvider} cp=${request.collaboratorProvider} stop=${stopReason} time=${totalTimeMs}ms`);

        // 7. Return Response
        return NextResponse.json({ ...response, requestId });
    } catch (err: any) {
        if (err.message === 'TIMEOUT') {
            console.warn(`[CONVERGE] rid=${requestId} TIMEOUT after 60s`);
            return NextResponse.json(
                { success: false, error: 'Timeout', requestId },
                { status: 504 }
            );
        }

        console.error(`[CONVERGE] rid=${requestId} API Error:`, err);
        return NextResponse.json(
            { success: false, error: 'Internal server error', requestId },
            { status: 500 }
        );
    }
}

// 405 for other methods
export async function GET() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }
export async function PUT() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }
export async function PATCH() { return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 }); }

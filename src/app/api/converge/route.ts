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

function checkEnv(provider: string): { keyName: string; isPresent: boolean } {
    const keyMap: Record<string, string> = {
        'openai': 'OPENAI_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY'
    };
    const keyName = keyMap[provider.toLowerCase()] || 'UNKNOWN_KEY';
    return { keyName, isPresent: !!process.env[keyName] };
}

function normalizeProvider(p: string): ProviderType {
    const slug = p.toLowerCase().trim();
    if (slug.includes('openai')) return 'openai';
    if (slug.includes('google') || slug.includes('gemini')) return 'google';
    if (slug.includes('anthropic') || slug.includes('claude')) return 'anthropic';
    throw new Error(`Unsupported provider: ${p}`);
}

function normalizeModelId(provider: ProviderType, modelLabel: string): string {
    const label = modelLabel.trim();
    const slug = label.toLowerCase();

    if (provider === 'openai') {
        if (slug.includes('gpt-4o mini') || slug === 'gpt-4o-mini') return 'gpt-4o-mini';
        if (slug.includes('gpt-4o')) return 'gpt-4o';
        if (slug.includes('gpt-4.1 mini') || slug === 'gpt-4.1-mini') return 'gpt-4.1-mini';
        if (slug.includes('gpt-4.1')) return 'gpt-4.1';
        if (slug.includes('gpt-3.5 turbo')) return 'gpt-4o-mini'; // redirect deprecated model
        return label;
    }

    if (provider === 'google') {
        if (slug.includes('gemini 2.0 flash') || slug === 'gemini-2.0-flash') return 'gemini-2.0-flash';
        if (slug.includes('gemini 2.0 pro') || slug === 'gemini-2.0-pro') return 'gemini-2.0-pro';
        if (slug.includes('gemini 1.5 pro')) return 'gemini-1.5-pro';
        if (slug.includes('gemini 1.5 flash')) return 'gemini-1.5-flash';
        return label;
    }

    if (provider === 'anthropic') {
        if (slug.includes('claude sonnet 4.5') || slug.includes('claude-sonnet-4-5')) return 'claude-sonnet-4-5-20250929';
        if (slug.includes('claude haiku 4.5') || slug.includes('claude-haiku-4-5')) return 'claude-haiku-4-5-20251001';
        if (slug.includes('claude 3.5 sonnet') || slug.includes('claude-3-5-sonnet')) return 'claude-3-5-sonnet-20241022';
        if (slug.includes('claude 3.5 haiku') || slug.includes('claude-3-5-haiku')) return 'claude-3-5-haiku-20241022';
        return label;
    }

    throw new Error(`Unsupported provider for model normalization: ${provider}`);
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
        // 2. Body Parsing & Normalization
        const body = await req.json();

        // Surgical Normalization before Zod
        try {
            if (body.writerProvider) body.writerProvider = normalizeProvider(body.writerProvider);
            if (body.collaboratorProvider) body.collaboratorProvider = normalizeProvider(body.collaboratorProvider);

            if (body.writerProvider && body.writerModel) {
                body.writerModel = normalizeModelId(body.writerProvider, body.writerModel);
            }
            if (body.collaboratorProvider && body.collaboratorModel) {
                body.collaboratorModel = normalizeModelId(body.collaboratorProvider, body.collaboratorModel);
            }
        } catch (normError: any) {
            return NextResponse.json({ success: false, error: normError.message, requestId }, { status: 400 });
        }

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
        console.log(`[DEBUG] rid=${requestId} writer_provider=${request.writerProvider} key=${writerEnv.keyName} found=${writerEnv.isPresent} model=${request.writerModel}`);
        console.log(`[DEBUG] rid=${requestId} collaborator_provider=${request.collaboratorProvider} key=${collaboratorEnv.keyName} found=${collaboratorEnv.isPresent} model=${request.collaboratorModel}`);

        if (!writerEnv.isPresent) {
            return NextResponse.json({ success: false, error: `Missing ${writerEnv.keyName}`, requestId }, { status: 400 });
        }
        if (!collaboratorEnv.isPresent) {
            return NextResponse.json({ success: false, error: `Missing ${collaboratorEnv.keyName}`, requestId }, { status: 400 });
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

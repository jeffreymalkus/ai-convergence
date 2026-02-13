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

function getApiKeyEnv(provider: ProviderType): string {
    switch (provider) {
        case 'openai': return 'OPENAI_API_KEY';
        case 'anthropic': return 'ANTHROPIC_API_KEY';
        case 'google': return 'GOOGLE_API_KEY';
    }
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

        // 3. Env Validation
        const writerKey = getApiKeyEnv(request.writerProvider);
        const collaboratorKey = getApiKeyEnv(request.collaboratorProvider);

        if (!process.env[writerKey]) {
            return NextResponse.json({ success: false, error: `Missing ${writerKey}`, requestId }, { status: 400 });
        }
        if (!process.env[collaboratorKey]) {
            return NextResponse.json({ success: false, error: `Missing ${collaboratorKey}`, requestId }, { status: 400 });
        }

        // 4. Core Logic with Timeout
        const TIMEOUT_MS = 60 * 1000;

        const convergencePromise = runConvergence(request);
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
        );

        const response = await Promise.race([convergencePromise, timeoutPromise]);

        // 5. Safe Logging
        const stopReason = response.success ? response.data?.stopReason : 'N/A';
        const totalTimeMs = response.success ? response.data?.totalTimeMs : 0;
        console.log(`[CONVERGE] rid=${requestId} tid=${request.templateId} wp=${request.writerProvider} cp=${request.collaboratorProvider} stop=${stopReason} time=${totalTimeMs}ms`);

        // 6. Return Response
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

import { NextResponse } from 'next/server';

export async function GET() {
    const keys = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `set (${process.env.OPENAI_API_KEY.substring(0, 8)}...)` : 'MISSING',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.substring(0, 8)}...)` : 'MISSING',
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? `set (${process.env.GOOGLE_API_KEY.substring(0, 8)}...)` : 'MISSING',
    };

    return NextResponse.json({
        status: 'ok',
        env: keys,
        node: process.version,
        timestamp: new Date().toISOString(),
    });
}

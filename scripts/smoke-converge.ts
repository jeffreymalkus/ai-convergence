/**
 * Smoke test for Convergence API
 * Usage: bun run scripts/smoke-converge.ts
 */

const API_URL = 'http://localhost:3000/api/converge';

async function runSmokeTest() {
    console.log('🚀 Starting smoke test for /api/converge...');

    const payload = {
        templateId: 'email-reply',
        idea: 'A polite rejection of a partnership proposal.',
        context: 'The recipient is a friendly but too small startup.',
        writerProvider: 'openai',
        collaboratorProvider: 'anthropic',
        writerModel: 'gpt-4o-mini',
        collaboratorModel: 'claude-3-haiku-20240307',
        maxRounds: 2,
        scoreThreshold: 9,
        showLog: true
    };

    try {
        const start = Date.now();
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const duration = (Date.now() - start) / 1000;

        if (!response.ok) {
            console.error(`❌ API Error (${response.status}):`, data.error || data);
            process.exit(1);
        }

        console.log(`✅ Success in ${duration.toFixed(2)}s!`);
        console.log(`Stop Reason: ${data.data.stopReason}`);
        console.log(`Rounds: ${data.data.rounds.length}`);
        console.log('\nFinal Output Preview:');
        console.log('----------------------');
        console.log(data.data.final.substring(0, 200) + (data.data.final.length > 200 ? '...' : ''));
        console.log('----------------------');

    } catch (err: any) {
        if (err.code === 'ECONNREFUSED') {
            console.error('❌ Error: Connection refused. Is the server running at http://localhost:3000?');
        } else {
            console.error('❌ Unexpected Error:', err.message);
        }
        process.exit(1);
    }
}

runSmokeTest();

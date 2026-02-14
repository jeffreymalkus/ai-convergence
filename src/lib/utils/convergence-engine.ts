import {
    ConvergeRequest,
    ConvergeResponse,
    ArtifactTemplate,
    ConvergenceRound,
    StopReason,
    CollaboratorResponse
} from '../types';
import { getTemplate } from '../templates';
import { getProvider } from '../providers';
import { z } from 'zod';

// Zod schema for collaborator feedback to ensure generateJson works correctly
interface ExtendedCollaboratorResponse extends CollaboratorResponse {
    shouldStop?: boolean;
    stopReason?: string;
}

const collaboratorFeedbackSchema = z.object({
    score: z.number(),
    ready: z.boolean(),
    mustFix: z.array(z.string()),
    shouldImprove: z.array(z.string()),
    questions: z.array(z.string()),
    patches: z.array(z.object({
        path: z.string(),
        operation: z.enum(['replace', 'add', 'remove']),
        content: z.string()
    })),
    noMaterialImprovements: z.boolean(),
    shouldStop: z.boolean().optional(),
    stopReason: z.string().optional()
});

/**
 * Compute the writer temperature for a given round.
 * Round 1 (initial draft) = 0.7 (creative), then tapers toward 0.3 (focused).
 */
function writerTemperature(roundNum: number, maxRounds: number): number {
    if (roundNum <= 1) return 0.7;
    // Linear taper from 0.55 at round 2 down to 0.3 at maxRounds
    const t = Math.max(0, (roundNum - 2) / Math.max(1, maxRounds - 2));
    return Math.round((0.55 - t * 0.25) * 100) / 100; // 0.55 → 0.3
}

/**
 * Format collaborator patches into a readable string for the writer.
 */
function formatPatches(patches: CollaboratorResponse['patches']): string {
    if (!patches || patches.length === 0) return '';
    return patches.map(p => {
        const op = p.operation.toUpperCase();
        return `[${op} at "${p.path}"]: ${p.content}`;
    }).join('\n');
}

/**
 * Build a concise memory summary of prior rounds for context compression.
 */
function buildMemory(rounds: ConvergenceRound[]): string {
    if (rounds.length < 2) return '';

    const recentRounds = rounds.slice(-3);
    const scoreHistory = recentRounds
        .map(r => `  Round ${r.roundNum}: ${r.collaboratorFeedback.score}/10${r.collaboratorFeedback.ready ? ' (ready)' : ''}`)
        .join('\n');

    // Collect unresolved issues from the most recent round only
    const latest = recentRounds[recentRounds.length - 1].collaboratorFeedback;
    const resolvedIssues = rounds.slice(0, -1)
        .flatMap(r => r.collaboratorFeedback.mustFix)
        .filter(issue => !latest.mustFix.includes(issue))
        .slice(-3);

    let memory = `Score progression:\n${scoreHistory}`;
    if (resolvedIssues.length > 0) {
        memory += `\n\nPreviously resolved (keep these fixes):\n${resolvedIssues.map(i => `  ✓ ${i}`).join('\n')}`;
    }
    return memory;
}

export async function runConvergence(request: ConvergeRequest): Promise<ConvergeResponse> {
    const rounds: ConvergenceRound[] = [];
    let currentDraft = '';
    let stopReason: StopReason = 'MAX_ROUNDS';
    let unresolvedQuestions: string[] = [];

    try {
        // 1. Resolve template
        const template = getTemplate(request.templateId);

        // 2. Setup providers
        const writer = getProvider(request.writerProvider);
        const collaborator = getProvider(request.collaboratorProvider);

        const maxRounds = request.maxRounds || template.convergencePolicy.maxRounds;
        const threshold = request.scoreThreshold || template.convergencePolicy.scoreThreshold;

        // 3. Round 0: Initial Draft
        // FIX #2: System prompt sent separately via systemPrompt option
        const initialUserPrompt = `Goal: ${request.idea}
${request.context ? `Context: ${request.context}` : ''}

Please generate the initial draft following the artifact template requirements.`;

        const startTime = Date.now();
        currentDraft = await writer.generate(initialUserPrompt, {
            model: request.writerModel,
            systemPrompt: template.writerSystemPrompt,
            temperature: writerTemperature(0, maxRounds), // 0.7 for initial
        });

        let lastScore = 0;
        let scoreStallCount = 0;

        for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
            const roundStartTime = Date.now();

            // 4. Collaborator Feedback
            // FIX #3: Collaborator sees the original goal/context
            // FIX #4: Unresolved questions from prior rounds included
            let feedbackUserPrompt = `## Original Request
Goal: ${request.idea}
${request.context ? `Context: ${request.context}` : ''}

## Current Draft (Round ${roundNum})
${currentDraft}

## Evaluation Rubric
${template.rubric.map(r => `- ${r.label} (weight ${r.weight}): ${r.description}`).join('\n')}`;

            if (unresolvedQuestions.length > 0) {
                feedbackUserPrompt += `\n\n## Unresolved Questions From Prior Rounds
The writer has not yet addressed these questions. Factor them into your score:
${unresolvedQuestions.map(q => `- ${q}`).join('\n')}`;
            }

            feedbackUserPrompt += `\n\nProvide structured feedback in JSON format.`;

            // FIX #2: Collaborator system prompt sent separately
            const feedback = await collaborator.generateJson<ExtendedCollaboratorResponse>(
                feedbackUserPrompt,
                collaboratorFeedbackSchema,
                {
                    model: request.collaboratorModel,
                    systemPrompt: template.collaboratorSystemPrompt,
                }
            );

            // Track unresolved questions across rounds
            // FIX #4: Accumulate questions, deduplicate
            if (feedback.questions && feedback.questions.length > 0) {
                const existingSet = new Set(unresolvedQuestions);
                for (const q of feedback.questions) {
                    if (!existingSet.has(q)) {
                        unresolvedQuestions.push(q);
                    }
                }
            }

            rounds.push({
                roundNum,
                draft: currentDraft,
                collaboratorFeedback: feedback,
                tokensUsed: 0, // Placeholder
                timeMs: Date.now() - roundStartTime
            });

            // 5. Check stop conditions
            const isValidStopReason = (reason: string | undefined): reason is StopReason =>
                ['THRESHOLD_MET', 'MAX_ROUNDS', 'NO_IMPROVEMENT', 'ERROR_FALLBACK'].includes(reason || '');

            if (feedback.stopReason && isValidStopReason(feedback.stopReason)) {
                stopReason = feedback.stopReason;
                break;
            }

            if (feedback.score >= threshold && feedback.ready) {
                stopReason = 'THRESHOLD_MET';
                break;
            }

            if (feedback.score <= lastScore || feedback.noMaterialImprovements) {
                scoreStallCount++;
            } else {
                scoreStallCount = 0;
            }

            if (scoreStallCount >= 2 || feedback.noMaterialImprovements) {
                stopReason = 'NO_IMPROVEMENT';
                break;
            }

            lastScore = feedback.score;

            // 6. Build memory for context compression
            const memory = buildMemory(rounds);

            // 7. Writer Revision
            // FIX #1: Pass patches to writer
            // FIX #4: Feed unresolved questions as assumptions to address
            // FIX #5: Temperature tapers across rounds
            // FIX #6: "Preserve what works" instruction
            const patchText = formatPatches(feedback.patches);

            let revisionUserPrompt = `## Original Goal
${request.idea}
${request.context ? `Context: ${request.context}` : ''}

## Current Draft
${currentDraft}

## Collaborator Feedback (Score: ${feedback.score}/10)

### Must Fix (Critical)
${feedback.mustFix.length > 0 ? feedback.mustFix.map(f => `- ${f}`).join('\n') : '- None'}

### Should Improve
${feedback.shouldImprove.length > 0 ? feedback.shouldImprove.map(s => `- ${s}`).join('\n') : '- None'}`;

            if (patchText) {
                revisionUserPrompt += `

### Specific Rewrites Proposed by Collaborator
The collaborator has suggested these concrete changes. Integrate them where they improve the draft:
${patchText}`;
            }

            if (unresolvedQuestions.length > 0) {
                revisionUserPrompt += `

### Unresolved Questions
Address these by either answering them in the draft or making reasonable assumptions (state assumptions explicitly):
${unresolvedQuestions.map(q => `- ${q}`).join('\n')}`;
            }

            if (memory) {
                revisionUserPrompt += `

### Round History
${memory}`;
            }

            revisionUserPrompt += `

## Instructions
Produce a revised, COMPLETE draft that:
1. Fixes all "Must Fix" issues
2. Integrates the collaborator's proposed rewrites where they improve quality
3. Addresses unresolved questions with reasonable assumptions
4. PRESERVES sections and phrasing that were NOT flagged — do not regress on what already works
5. Improves "Should Improve" items where possible without over-engineering`;

            // FIX #2: System prompt sent separately
            // FIX #5: Temperature tapers
            currentDraft = await writer.generate(revisionUserPrompt, {
                model: request.writerModel,
                systemPrompt: template.writerSystemPrompt,
                temperature: writerTemperature(roundNum, maxRounds),
            });
        }

        return {
            success: true,
            data: {
                final: currentDraft,
                stopReason,
                rounds,
                totalCost: 0, // Placeholder
                totalTokens: 0, // Placeholder
                totalTimeMs: Date.now() - startTime,
                metadata: {
                    templateId: request.templateId,
                    writerModel: request.writerModel,
                    collaboratorModel: request.collaboratorModel
                }
            }
        };

    } catch (error) {
        console.error('Convergence failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: {
                final: currentDraft, // Return best known draft
                stopReason: 'ERROR_FALLBACK',
                rounds,
                totalCost: 0,
                totalTokens: 0,
                totalTimeMs: 0,
                metadata: {
                    templateId: request.templateId,
                    writerModel: request.writerModel,
                    collaboratorModel: request.collaboratorModel
                }
            }
        };
    }
}

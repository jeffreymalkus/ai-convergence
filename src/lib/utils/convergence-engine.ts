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

export async function runConvergence(request: ConvergeRequest): Promise<ConvergeResponse> {
    const rounds: ConvergenceRound[] = [];
    let currentDraft = '';
    let stopReason: StopReason = 'MAX_ROUNDS';
    let memory = '';

    try {
        // 1. Resolve template
        const template = getTemplate(request.templateId);

        // 2. Setup providers
        const writer = getProvider(request.writerProvider);
        const collaborator = getProvider(request.collaboratorProvider);

        // 3. Round 0: Initial Draft
        const initialPrompt = `${template.writerSystemPrompt}

Goal: ${request.idea}
Context: ${request.context || 'None'}

Please generate the initial draft following the artifact template requirements.
`;

        const startTime = Date.now();
        currentDraft = await writer.generate(initialPrompt, {
            model: request.writerModel,
            temperature: 0.7
        });

        // We don't have feedback for round 0 yet, but we'll fill it in the loop
        // or keep round 0 as just the draft. The ARCHITECTURE says Round 0 is initial draft.

        const maxRounds = request.maxRounds || template.convergencePolicy.maxRounds;
        const threshold = request.scoreThreshold || template.convergencePolicy.scoreThreshold;

        let lastScore = 0;
        let scoreStallCount = 0;

        for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
            const roundStartTime = Date.now();

            // 4. Collaborator Feedback
            const feedbackPrompt = `
Draft:
${currentDraft}

Rubric:
${template.rubric.map(r => `- ${r.label} (weight ${r.weight}): ${r.description}`).join('\n')}

${template.collaboratorSystemPrompt}

Provide structured feedback in JSON format.
`;

            const feedback = await collaborator.generateJson<ExtendedCollaboratorResponse>(
                feedbackPrompt,
                collaboratorFeedbackSchema,
                { model: request.collaboratorModel }
            );

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

            if (feedback.score >= threshold) {
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

            // 6. Context Compression (Memory)
            if (roundNum >= 3) {
                const recentRounds = rounds.slice(-3);
                const scoreHistory = recentRounds.map(r => `- R${r.roundNum}: ${r.collaboratorFeedback.score}`).join('\n');
                const recentIssues = rounds.flatMap(r => r.collaboratorFeedback.mustFix).slice(-5).map(f => `- ${f}`).join('\n');

                memory = `Prior rounds:\n${scoreHistory}\nTop issues:\n${recentIssues}`;
            }

            // 7. Writer Revision
            const revisionPrompt = `${template.writerSystemPrompt}

Original Goal: ${request.idea}
${memory ? `\nMemory of previous rounds:\n${memory}\n` : ''}

Current Draft:
${currentDraft}

Feedback for improvement:
- Must Fix: ${feedback.mustFix.join(', ')}
- Should Improve: ${feedback.shouldImprove.join(', ')}

Please provide a revised, full draft integrating the feedback.
`;

            currentDraft = await writer.generate(revisionPrompt, {
                model: request.writerModel,
                temperature: 0.7
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

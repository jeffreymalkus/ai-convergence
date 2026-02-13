'use client';

import { useState, useEffect } from 'react';
import { ConvergeRequest, ConvergeResponse, ProviderType } from '@/lib/types';
import { MODEL_REGISTRY, getDefaultModels } from '@/lib/providers/model-registry';

export default function ConvergencePage() {
    const [formData, setFormData] = useState({
        templateId: 'email-reply',
        idea: '',
        context: '',
        writerProvider: 'openai' as ProviderType,
        collaboratorProvider: 'anthropic' as ProviderType,
        writerModel: 'gpt-4o-mini',
        collaboratorModel: 'claude-3-haiku-20240307',
        maxRounds: 5,
        scoreThreshold: 9,
        showLog: true,
    });

    const [isCustomWriterModel, setIsCustomWriterModel] = useState(false);
    const [isCustomCollaboratorModel, setIsCustomCollaboratorModel] = useState(false);

    // Update defaults when template changes
    useEffect(() => {
        const defaults = getDefaultModels(formData.templateId);
        setFormData(prev => ({
            ...prev,
            writerModel: defaults.writerModel,
            collaboratorModel: defaults.collaboratorModel,
            writerProvider: defaults.writerModel.startsWith('gpt') ? 'openai' : (defaults.writerModel.startsWith('claude') ? 'anthropic' : 'google'),
            collaboratorProvider: defaults.collaboratorModel.startsWith('gpt') ? 'openai' : (defaults.collaboratorModel.startsWith('claude') ? 'anthropic' : 'google'),
        }));
        setIsCustomWriterModel(false);
        setIsCustomCollaboratorModel(false);
    }, [formData.templateId]);

    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<ConvergeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResponse(null);

        try {
            const res = await fetch('/api/converge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Error: ${res.status}`);
            }

            setResponse(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (response?.data?.final) {
            navigator.clipboard.writeText(response.data.final);
            alert('Copied to clipboard!');
        }
    };

    return (
        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
            <h1>AI Convergence Runner</h1>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px' }}>
                <div>
                    <label style={{ display: 'block', fontWeight: 'bold' }}>Template</label>
                    <select
                        value={formData.templateId}
                        onChange={e => setFormData({ ...formData, templateId: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem' }}
                    >
                        <option value="email-reply">Email Reply</option>
                        <option value="software-spec">Software Feature Spec</option>
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontWeight: 'bold' }}>Idea</label>
                    <textarea
                        required
                        value={formData.idea}
                        onChange={e => setFormData({ ...formData, idea: e.target.value })}
                        placeholder="What do you want to build/write?"
                        style={{ width: '100%', padding: '0.5rem', minHeight: '80px' }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', fontWeight: 'bold' }}>Context (Optional)</label>
                    <textarea
                        value={formData.context}
                        onChange={e => setFormData({ ...formData, context: e.target.value })}
                        placeholder="Additional context or constraints..."
                        style={{ width: '100%', padding: '0.5rem' }}
                    />
                </div>

                {/* Writer Provider/Model */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Writer Provider</label>
                        <select
                            value={formData.writerProvider}
                            onChange={e => {
                                const provider = e.target.value as ProviderType;
                                setFormData({ ...formData, writerProvider: provider, writerModel: MODEL_REGISTRY[provider][0].id });
                                setIsCustomWriterModel(false);
                            }}
                            style={{ width: '100%', padding: '0.5rem' }}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="google">Google</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Writer Model</label>
                        {!isCustomWriterModel ? (
                            <select
                                value={formData.writerModel}
                                onChange={e => {
                                    if (e.target.value === 'custom') {
                                        setIsCustomWriterModel(true);
                                        setFormData({ ...formData, writerModel: '' });
                                    } else {
                                        setFormData({ ...formData, writerModel: e.target.value });
                                    }
                                }}
                                style={{ width: '100%', padding: '0.5rem' }}
                            >
                                {MODEL_REGISTRY[formData.writerProvider].map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                                <option value="custom">Custom model...</option>
                            </select>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={formData.writerModel}
                                    placeholder="Model name"
                                    onChange={e => setFormData({ ...formData, writerModel: e.target.value })}
                                    style={{ flex: 1, padding: '0.5rem' }}
                                />
                                <button type="button" onClick={() => setIsCustomWriterModel(false)} style={{ padding: '0.5rem' }}>×</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collaborator Provider/Model */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Collaborator Provider</label>
                        <select
                            value={formData.collaboratorProvider}
                            onChange={e => {
                                const provider = e.target.value as ProviderType;
                                setFormData({ ...formData, collaboratorProvider: provider, collaboratorModel: MODEL_REGISTRY[provider][0].id });
                                setIsCustomCollaboratorModel(false);
                            }}
                            style={{ width: '100%', padding: '0.5rem' }}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="google">Google</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Collaborator Model</label>
                        {!isCustomCollaboratorModel ? (
                            <select
                                value={formData.collaboratorModel}
                                onChange={e => {
                                    if (e.target.value === 'custom') {
                                        setIsCustomCollaboratorModel(true);
                                        setFormData({ ...formData, collaboratorModel: '' });
                                    } else {
                                        setFormData({ ...formData, collaboratorModel: e.target.value });
                                    }
                                }}
                                style={{ width: '100%', padding: '0.5rem' }}
                            >
                                {MODEL_REGISTRY[formData.collaboratorProvider].map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                                <option value="custom">Custom model...</option>
                            </select>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={formData.collaboratorModel}
                                    placeholder="Model name"
                                    onChange={e => setFormData({ ...formData, collaboratorModel: e.target.value })}
                                    style={{ flex: 1, padding: '0.5rem' }}
                                />
                                <button type="button" onClick={() => setIsCustomCollaboratorModel(false)} style={{ padding: '0.5rem' }}>×</button>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Max Rounds</label>
                        <input
                            type="number"
                            value={formData.maxRounds}
                            onChange={e => setFormData({ ...formData, maxRounds: parseInt(e.target.value) })}
                            style={{ width: '100%', padding: '0.5rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold' }}>Score Threshold</label>
                        <input
                            type="number"
                            value={formData.scoreThreshold}
                            onChange={e => setFormData({ ...formData, scoreThreshold: parseFloat(e.target.value) })}
                            style={{ width: '100%', padding: '0.5rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={formData.showLog}
                                onChange={e => setFormData({ ...formData, showLog: e.target.checked })}
                            />
                            Show Log
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '1rem',
                        background: loading ? '#ccc' : '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Running Convergence...' : 'Run Convergence'}
                </button>
            </form>

            {error && (
                <div style={{ marginTop: '2rem', padding: '1rem', background: '#fff5f5', border: '1px solid #ff0000', color: '#ff0000', borderRadius: '4px' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {response && response.data && (
                <div style={{ marginTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2>Final Output</h2>
                        <button onClick={copyToClipboard} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Copy Output</button>
                    </div>

                    <div style={{ background: '#f4f4f4', padding: '1.5rem', borderRadius: '8px', whiteSpace: 'pre-wrap', border: '1px solid #ddd' }}>
                        {response.data.final}
                    </div>

                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f7ff', borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Stop Reason</div>
                            <div style={{ fontWeight: 'bold' }}>{response.data.stopReason}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Rounds</div>
                            <div style={{ fontWeight: 'bold' }}>{response.data.rounds.length}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Elapsed Time</div>
                            <div style={{ fontWeight: 'bold' }}>{Math.round(response.data.totalTimeMs / 1000)}s</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Last Score</div>
                            <div style={{ fontWeight: 'bold' }}>
                                {response.data.rounds.length > 0
                                    ? `${response.data.rounds[response.data.rounds.length - 1].collaboratorFeedback.score}/10`
                                    : 'N/A'}
                            </div>
                        </div>
                    </div>

                    {formData.showLog && response.data.rounds && (
                        <div style={{ marginTop: '2rem' }}>
                            <h2>Process Log</h2>
                            {response.data.rounds.map((round) => (
                                <details key={round.roundNum} style={{ marginBottom: '1rem', border: '1px solid #eee', borderRadius: '4px' }}>
                                    <summary style={{ padding: '0.75rem', cursor: 'pointer', background: '#fafafa', fontWeight: 'bold' }}>
                                        Round {round.roundNum} — Score: {round.collaboratorFeedback.score}/10
                                    </summary>
                                    <div style={{ padding: '1rem' }}>
                                        <p><strong>Must Fix:</strong></p>
                                        <ul>{round.collaboratorFeedback.mustFix.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
                                        <p><strong>Should Improve:</strong></p>
                                        <ul>{round.collaboratorFeedback.shouldImprove.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                                        {round.collaboratorFeedback.questions.length > 0 && (
                                            <>
                                                <p><strong>Questions:</strong></p>
                                                <ul>{round.collaboratorFeedback.questions.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>
                                            </>
                                        )}
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}

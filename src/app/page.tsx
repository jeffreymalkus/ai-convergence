'use client';

import { useState, useEffect, useRef } from 'react';
import { ConvergeRequest, ConvergeResponse, ProviderType } from '@/lib/types';
import { MODEL_REGISTRY, getDefaultModels } from '@/lib/providers/model-registry';

// ─── Animated background particles ───────────────────────────────
function ParticleField() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
        const COUNT = 60;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < COUNT; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 2 + 0.5,
                o: Math.random() * 0.3 + 0.05,
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(168,162,255,${p.o})`;
                ctx.fill();
            }
            // draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(168,162,255,${0.06 * (1 - dist / 120)})`;
                        ctx.stroke();
                    }
                }
            }
            animId = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
}

// ─── Provider icon component ─────────────────────────────────────
function ProviderIcon({ provider }: { provider: ProviderType }) {
    const colors: Record<ProviderType, string> = {
        openai: '#10a37f',
        anthropic: '#d4a574',
        google: '#4285f4',
    };
    const labels: Record<ProviderType, string> = {
        openai: 'O',
        anthropic: 'A',
        google: 'G',
    };
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: 6,
                background: colors[provider] + '18',
                color: colors[provider],
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                flexShrink: 0,
            }}
        >
            {labels[provider]}
        </span>
    );
}

// ─── Score ring component ────────────────────────────────────────
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
    const pct = score / 10;
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const color = score >= 9 ? '#34d399' : score >= 7 ? '#fbbf24' : '#f87171';
    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={4}
                strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
            <text
                x={size / 2}
                y={size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={14}
                fontWeight={700}
                style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
            >
                {score}
            </text>
        </svg>
    );
}

// ─── Pulse animation for loading ─────────────────────────────────
function PulseLoader() {
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
                <div
                    key={i}
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#a8a2ff',
                        animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function ConvergencePage() {
    const [formData, setFormData] = useState({
        templateId: 'email-reply',
        idea: '',
        context: '',
        writerProvider: 'openai' as ProviderType,
        collaboratorProvider: 'anthropic' as ProviderType,
        writerModel: 'gpt-4o-mini',
        collaboratorModel: 'claude-haiku-4-5-20251001',
        maxRounds: 5,
        scoreThreshold: 9,
        showLog: true,
    });

    const [isCustomWriterModel, setIsCustomWriterModel] = useState(false);
    const [isCustomCollaboratorModel, setIsCustomCollaboratorModel] = useState(false);
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<ConvergeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

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
            if (!res.ok) throw new Error(data.error || `Error: ${res.status}`);
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
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const templateOptions = [
        { id: 'email-reply', label: 'Email Reply', icon: '✉️' },
        { id: 'software-spec', label: 'Software Spec', icon: '⚙️' },
    ];

    // ── Styles ───────────────────────────────────────────────────
    const vars = {
        bg: '#0c0a1a',
        surface: 'rgba(255,255,255,0.03)',
        surfaceHover: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.07)',
        borderHover: 'rgba(168,162,255,0.25)',
        text: '#e4e2f0',
        textMuted: '#807ca0',
        accent: '#a8a2ff',
        accentGlow: 'rgba(168,162,255,0.15)',
        success: '#34d399',
        error: '#f87171',
        radius: '14px',
        radiusSm: '10px',
    } as const;

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        background: vars.surface,
        border: `1px solid ${vars.border}`,
        borderRadius: vars.radiusSm,
        color: vars.text,
        fontSize: 14,
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        fontFamily: 'inherit',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: vars.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 6,
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

                * { box-sizing: border-box; margin: 0; padding: 0; }
                html, body { background: ${vars.bg}; color: ${vars.text}; font-family: 'DM Sans', sans-serif; }
                ::selection { background: ${vars.accent}; color: ${vars.bg}; }

                input, select, textarea {
                    font-family: 'DM Sans', sans-serif;
                }
                input:focus, select:focus, textarea:focus {
                    border-color: ${vars.borderHover} !important;
                    box-shadow: 0 0 0 3px ${vars.accentGlow} !important;
                }
                select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23807ca0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px !important; }
                select option { background: #1a1730; color: ${vars.text}; }
                textarea { resize: vertical; min-height: 80px; }

                details summary { list-style: none; }
                details summary::-webkit-details-marker { display: none; }

                @keyframes pulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .fade-up {
                    animation: fadeUp 0.5s ease forwards;
                }
                .fade-up-delay-1 { animation-delay: 0.1s; opacity: 0; }
                .fade-up-delay-2 { animation-delay: 0.2s; opacity: 0; }
                .fade-up-delay-3 { animation-delay: 0.3s; opacity: 0; }

                .btn-primary {
                    position: relative;
                    overflow: hidden;
                    padding: 14px 28px;
                    background: linear-gradient(135deg, #a8a2ff 0%, #7c6ef0 100%);
                    color: #0c0a1a;
                    border: none;
                    border-radius: ${vars.radiusSm};
                    font-weight: 700;
                    font-size: 15px;
                    cursor: pointer;
                    transition: transform 0.15s, box-shadow 0.25s;
                    font-family: 'DM Sans', sans-serif;
                    letter-spacing: -0.01em;
                }
                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 30px rgba(168,162,255,0.3);
                }
                .btn-primary:active:not(:disabled) { transform: translateY(0); }
                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .btn-primary.loading {
                    background: linear-gradient(90deg, #7c6ef0, #a8a2ff, #7c6ef0);
                    background-size: 200% 100%;
                    animation: shimmer 2s linear infinite;
                }

                .template-chip {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    border-radius: ${vars.radiusSm};
                    border: 1px solid ${vars.border};
                    background: ${vars.surface};
                    color: ${vars.textMuted};
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: 'DM Sans', sans-serif;
                }
                .template-chip:hover {
                    border-color: ${vars.borderHover};
                    background: ${vars.surfaceHover};
                }
                .template-chip.active {
                    border-color: ${vars.accent};
                    background: ${vars.accentGlow};
                    color: ${vars.accent};
                }

                .stat-card {
                    padding: 16px;
                    border-radius: ${vars.radiusSm};
                    background: ${vars.surface};
                    border: 1px solid ${vars.border};
                }

                .round-card {
                    border: 1px solid ${vars.border};
                    border-radius: ${vars.radiusSm};
                    overflow: hidden;
                    transition: border-color 0.2s;
                }
                .round-card:hover { border-color: ${vars.borderHover}; }
                .round-card summary {
                    padding: 14px 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: ${vars.surface};
                    transition: background 0.15s;
                }
                .round-card summary:hover { background: ${vars.surfaceHover}; }
                .round-card[open] summary { border-bottom: 1px solid ${vars.border}; }

                .tag {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                }
            `}</style>

            <ParticleField />

            <main style={{
                position: 'relative',
                zIndex: 1,
                maxWidth: 720,
                margin: '0 auto',
                padding: '48px 24px 80px',
            }}>
                {/* ── Header ──────────────────────────────────────── */}
                <header className="fade-up" style={{ marginBottom: 40, textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: `linear-gradient(135deg, ${vars.accentGlow}, transparent)`,
                        border: `1px solid ${vars.border}`,
                        marginBottom: 16,
                        fontSize: 22,
                    }}>
                        ◈
                    </div>
                    <h1 style={{
                        fontSize: 28,
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.2,
                        background: `linear-gradient(135deg, ${vars.text} 0%, ${vars.accent} 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        AI Convergence
                    </h1>
                    <p style={{ color: vars.textMuted, fontSize: 15, marginTop: 6 }}>
                        Multi-model refinement until both agree it's done
                    </p>
                </header>

                {/* ── Form ────────────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="fade-up fade-up-delay-1" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Template selection */}
                    <div>
                        <label style={labelStyle}>Template</label>
                        <div style={{ display: 'flex', gap: 10 }}>
                            {templateOptions.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    className={`template-chip ${formData.templateId === t.id ? 'active' : ''}`}
                                    onClick={() => setFormData({ ...formData, templateId: t.id })}
                                >
                                    <span>{t.icon}</span>
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Idea input */}
                    <div>
                        <label style={labelStyle}>Your Idea</label>
                        <textarea
                            required
                            value={formData.idea}
                            onChange={e => setFormData({ ...formData, idea: e.target.value })}
                            placeholder="What do you want to build or write?"
                            style={{ ...inputStyle, minHeight: 100 }}
                        />
                    </div>

                    {/* Context */}
                    <div>
                        <label style={labelStyle}>Context <span style={{ opacity: 0.5, fontWeight: 400 }}>— optional</span></label>
                        <textarea
                            value={formData.context}
                            onChange={e => setFormData({ ...formData, context: e.target.value })}
                            placeholder="Audience, constraints, tone, examples..."
                            style={{ ...inputStyle, minHeight: 64 }}
                        />
                    </div>

                    {/* Model selectors */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                        padding: 16,
                        background: vars.surface,
                        border: `1px solid ${vars.border}`,
                        borderRadius: vars.radius,
                    }}>
                        {/* Writer */}
                        <div>
                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ProviderIcon provider={formData.writerProvider} />
                                Writer
                            </label>
                            <select
                                value={formData.writerProvider}
                                onChange={e => {
                                    const provider = e.target.value as ProviderType;
                                    setFormData({ ...formData, writerProvider: provider, writerModel: MODEL_REGISTRY[provider][0].id });
                                    setIsCustomWriterModel(false);
                                }}
                                style={{ ...inputStyle, marginBottom: 8 }}
                            >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="google">Google</option>
                            </select>
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
                                    style={inputStyle}
                                >
                                    {MODEL_REGISTRY[formData.writerProvider].map(m => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                    <option value="custom">Custom model…</option>
                                </select>
                            ) : (
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input
                                        type="text"
                                        value={formData.writerModel}
                                        placeholder="Model name"
                                        onChange={e => setFormData({ ...formData, writerModel: e.target.value })}
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomWriterModel(false)}
                                        style={{
                                            background: vars.surface,
                                            border: `1px solid ${vars.border}`,
                                            borderRadius: vars.radiusSm,
                                            color: vars.textMuted,
                                            padding: '0 12px',
                                            cursor: 'pointer',
                                            fontSize: 16,
                                        }}
                                    >×</button>
                                </div>
                            )}
                        </div>

                        {/* Collaborator */}
                        <div>
                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ProviderIcon provider={formData.collaboratorProvider} />
                                Collaborator
                            </label>
                            <select
                                value={formData.collaboratorProvider}
                                onChange={e => {
                                    const provider = e.target.value as ProviderType;
                                    setFormData({ ...formData, collaboratorProvider: provider, collaboratorModel: MODEL_REGISTRY[provider][0].id });
                                    setIsCustomCollaboratorModel(false);
                                }}
                                style={{ ...inputStyle, marginBottom: 8 }}
                            >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="google">Google</option>
                            </select>
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
                                    style={inputStyle}
                                >
                                    {MODEL_REGISTRY[formData.collaboratorProvider].map(m => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                    <option value="custom">Custom model…</option>
                                </select>
                            ) : (
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input
                                        type="text"
                                        value={formData.collaboratorModel}
                                        placeholder="Model name"
                                        onChange={e => setFormData({ ...formData, collaboratorModel: e.target.value })}
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomCollaboratorModel(false)}
                                        style={{
                                            background: vars.surface,
                                            border: `1px solid ${vars.border}`,
                                            borderRadius: vars.radiusSm,
                                            color: vars.textMuted,
                                            padding: '0 12px',
                                            cursor: 'pointer',
                                            fontSize: 16,
                                        }}
                                    >×</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Advanced toggle */}
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: vars.textMuted,
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: 'inherit',
                            padding: 0,
                        }}
                    >
                        <span style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▸</span>
                        Advanced settings
                    </button>

                    {showAdvanced && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: 12,
                            animation: 'fadeUp 0.3s ease',
                        }}>
                            <div>
                                <label style={labelStyle}>Max Rounds</label>
                                <input
                                    type="number"
                                    value={formData.maxRounds}
                                    onChange={e => setFormData({ ...formData, maxRounds: parseInt(e.target.value) })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Score Threshold</label>
                                <input
                                    type="number"
                                    value={formData.scoreThreshold}
                                    onChange={e => setFormData({ ...formData, scoreThreshold: parseFloat(e.target.value) })}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 13,
                                    color: vars.textMuted,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.showLog}
                                        onChange={e => setFormData({ ...formData, showLog: e.target.checked })}
                                        style={{ accentColor: vars.accent }}
                                    />
                                    Show log
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !formData.idea.trim()}
                        className={`btn-primary ${loading ? 'loading' : ''}`}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                <PulseLoader />
                                Running convergence…
                            </span>
                        ) : (
                            '▸ Run Convergence'
                        )}
                    </button>
                </form>

                {/* ── Error ────────────────────────────────────────── */}
                {error && (
                    <div className="fade-up" style={{
                        marginTop: 24,
                        padding: '14px 18px',
                        background: 'rgba(248,113,113,0.08)',
                        border: `1px solid rgba(248,113,113,0.25)`,
                        borderRadius: vars.radiusSm,
                        color: vars.error,
                        fontSize: 14,
                    }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* ── Results ─────────────────────────────────────── */}
                {response && response.data && (
                    <div className="fade-up fade-up-delay-2" style={{ marginTop: 32 }}>
                        {/* Header bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                                Output
                            </h2>
                            <button
                                onClick={copyToClipboard}
                                style={{
                                    background: copied ? 'rgba(52,211,153,0.12)' : vars.surface,
                                    border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : vars.border}`,
                                    borderRadius: 8,
                                    color: copied ? vars.success : vars.textMuted,
                                    padding: '8px 14px',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>

                        {/* Final output */}
                        <div style={{
                            background: vars.surface,
                            border: `1px solid ${vars.border}`,
                            borderRadius: vars.radius,
                            padding: '20px 22px',
                            whiteSpace: 'pre-wrap',
                            fontSize: 14,
                            lineHeight: 1.7,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 400,
                            color: vars.text,
                        }}>
                            {response.data.final}
                        </div>

                        {/* Stats row */}
                        <div className="fade-up fade-up-delay-3" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 10,
                            marginTop: 14,
                        }}>
                            {[
                                { label: 'Status', value: response.data.stopReason.replace('_', ' ').toLowerCase(), color: response.data.stopReason === 'THRESHOLD_MET' ? vars.success : vars.textMuted },
                                { label: 'Rounds', value: response.data.rounds.length },
                                { label: 'Time', value: `${Math.round(response.data.totalTimeMs / 1000)}s` },
                                {
                                    label: 'Final Score',
                                    value: response.data.rounds.length > 0
                                        ? `${response.data.rounds[response.data.rounds.length - 1].collaboratorFeedback.score}/10`
                                        : 'N/A',
                                    color: (() => {
                                        if (response.data.rounds.length === 0) return vars.textMuted;
                                        const s = response.data.rounds[response.data.rounds.length - 1].collaboratorFeedback.score;
                                        return s >= 9 ? vars.success : s >= 7 ? '#fbbf24' : vars.error;
                                    })(),
                                },
                            ].map((stat, i) => (
                                <div key={i} className="stat-card">
                                    <div style={{ fontSize: 11, color: vars.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                                        {stat.label}
                                    </div>
                                    <div style={{
                                        fontWeight: 700,
                                        fontSize: 15,
                                        color: stat.color || vars.text,
                                        textTransform: stat.label === 'Status' ? 'capitalize' : undefined,
                                    }}>
                                        {stat.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Process Log */}
                        {formData.showLog && response.data.rounds && (
                            <div style={{ marginTop: 28 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, color: vars.textMuted, marginBottom: 12, letterSpacing: '-0.01em' }}>
                                    Process Log
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {response.data.rounds.map((round) => (
                                        <details key={round.roundNum} className="round-card">
                                            <summary>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontWeight: 600, fontSize: 14 }}>Round {round.roundNum}</span>
                                                    <span className="tag" style={{
                                                        background: round.collaboratorFeedback.score >= 9
                                                            ? 'rgba(52,211,153,0.12)' : round.collaboratorFeedback.score >= 7
                                                                ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                                                        color: round.collaboratorFeedback.score >= 9
                                                            ? vars.success : round.collaboratorFeedback.score >= 7
                                                                ? '#fbbf24' : vars.error,
                                                    }}>
                                                        {round.collaboratorFeedback.score}/10
                                                    </span>
                                                    {round.collaboratorFeedback.ready && (
                                                        <span className="tag" style={{ background: 'rgba(52,211,153,0.12)', color: vars.success }}>
                                                            Ready
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{ color: vars.textMuted, fontSize: 18, transition: 'transform 0.2s' }}>›</span>
                                            </summary>
                                            <div style={{ padding: '16px 18px', fontSize: 13, lineHeight: 1.6 }}>
                                                {round.collaboratorFeedback.mustFix.length > 0 && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <div style={{ fontWeight: 600, color: vars.error, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Must Fix</div>
                                                        {round.collaboratorFeedback.mustFix.map((m: string, i: number) => (
                                                            <div key={i} style={{ color: vars.text, paddingLeft: 12, borderLeft: `2px solid rgba(248,113,113,0.3)`, marginBottom: 4 }}>{m}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                {round.collaboratorFeedback.shouldImprove.length > 0 && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Should Improve</div>
                                                        {round.collaboratorFeedback.shouldImprove.map((s: string, i: number) => (
                                                            <div key={i} style={{ color: vars.text, paddingLeft: 12, borderLeft: '2px solid rgba(251,191,36,0.3)', marginBottom: 4 }}>{s}</div>
                                                        ))}
                                                    </div>
                                                )}
                                                {round.collaboratorFeedback.questions.length > 0 && (
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: vars.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Questions</div>
                                                        {round.collaboratorFeedback.questions.map((q: string, i: number) => (
                                                            <div key={i} style={{ color: vars.text, paddingLeft: 12, borderLeft: `2px solid rgba(168,162,255,0.3)`, marginBottom: 4 }}>{q}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </>
    );
}

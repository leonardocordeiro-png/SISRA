import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, QrCode, Search, Hash, Wifi, Settings } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
const PURPLE     = '#a78bfa';
const GREEN      = '#34d399';
const TEXT_MUTED = '#8491A2';
const GLASS_BG   = 'rgba(17,24,43,0.65)';

function GlassPanel({
    children,
    className,
    outerStyle,
    innerStyle,
}: {
    children: React.ReactNode;
    className?: string;
    outerStyle?: React.CSSProperties;
    innerStyle?: React.CSSProperties;
}) {
    return (
        <div
            className={className}
            style={{
                background: 'linear-gradient(135deg, rgba(71,184,255,0.32) 0%, rgba(199,158,97,0.32) 100%)',
                padding: 2,
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                ...outerStyle,
            }}
        >
            <div style={{
                background: GLASS_BG,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 12,
                height: '100%',
                boxShadow: 'inset 0 0 12px rgba(255,255,255,0.015)',
                ...innerStyle,
            }}>
                {children}
            </div>
        </div>
    );
}

export default function TotemHome() {
    const navigate = useNavigate();
    const [time, setTime] = useState(new Date());
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const p = setInterval(() => setPulse(v => !v), 2000);
        return () => clearInterval(p);
    }, []);

    const formatTime = (d: Date) =>
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatDate = (d: Date) =>
        d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const methods = [
        { icon: Search, label: 'Busca por CPF',      num: '1', accent: CYAN,   glow: 'rgba(71,184,255,0.22)'   },
        { icon: Hash,   label: 'Código de Acesso',  num: '2', accent: GOLD,   glow: 'rgba(199,158,97,0.22)'  },
        { icon: QrCode, label: 'Escanear QR Code',  num: '3', accent: PURPLE, glow: 'rgba(167,139,250,0.22)' },
    ];

    return (
        <div
            style={{
                minHeight: '100dvh',
                background: '#0A0F2B',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: "'Inter', system-ui, sans-serif",
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                userSelect: 'none',
            }}
            onClick={() => navigate('/totem/identificar')}
        >
            {/* Scoped styles */}
            <style>{`
                .totem-bg {
                    background-image:
                        radial-gradient(circle at 15% 20%, rgba(71,184,255,0.07) 0%, transparent 45%),
                        radial-gradient(circle at 85% 80%, rgba(167,139,250,0.06) 0%, transparent 45%),
                        repeating-linear-gradient(rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 40px),
                        repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 40px);
                }
                .totem-action-card { transition: transform 0.22s ease, box-shadow 0.22s ease; }
                .totem-action-card:hover { transform: translateY(-6px); }
                @keyframes totem-scan {
                    0%   { top: -2px; opacity: 0; }
                    10%  { opacity: 1; }
                    90%  { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .totem-scanline {
                    animation: totem-scan 6s linear infinite;
                }
            `}</style>

            {/* Background layer */}
            <div className="totem-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* Scan line */}
            <div className="totem-scanline" style={{
                position: 'absolute', left: 0, right: 0, height: 1, zIndex: 1,
                background: 'linear-gradient(to right, transparent, rgba(71,184,255,0.18), transparent)',
                pointerEvents: 'none',
            }} />

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <header style={{
                position: 'relative', zIndex: 2,
                padding: '20px 40px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
            }}>
                {/* Left: logo + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(22,28,44,0.4), rgba(10,15,31,0.9))',
                        display: 'grid', placeItems: 'center',
                        border: `1.5px solid ${GOLD}`,
                        boxShadow: `0 0 24px rgba(199,158,97,0.28), inset 0 0 10px rgba(0,0,0,0.3)`,
                        flexShrink: 0,
                    }}>
                        <School style={{ width: 28, height: 28, color: GOLD, filter: `drop-shadow(0 0 8px rgba(199,158,97,0.5))` }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 3 }}>
                            La Salle — SISRA
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1 }}>
                            Terminal de Auto-Atendimento
                        </div>
                    </div>
                </div>

                {/* Right: 3 method status boxes */}
                <div style={{ display: 'flex', gap: 12 }}>
                    {methods.map(({ icon: Icon, label, num, accent, glow }) => (
                        <GlassPanel key={num} outerStyle={{ boxShadow: `0 4px 16px rgba(0,0,0,0.35)` }}>
                            <div style={{
                                padding: '10px 16px',
                                display: 'flex', alignItems: 'center', gap: 10,
                            }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: `radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.9))`,
                                    border: `1px solid ${accent}`,
                                    boxShadow: `0 0 14px ${glow}`,
                                    display: 'grid', placeItems: 'center', flexShrink: 0,
                                }}>
                                    <Icon style={{ width: 15, height: 15, color: accent }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 8, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Opção {num}
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                                        {label}
                                    </div>
                                </div>
                            </div>
                        </GlassPanel>
                    ))}
                </div>
            </header>

            {/* ── MAIN ────────────────────────────────────────────────────────── */}
            <main style={{
                position: 'relative', zIndex: 2,
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '32px 40px',
                gap: 32,
            }}>
                {/* Divider */}
                <div style={{
                    width: '100%', maxWidth: 700, height: 1,
                    background: 'linear-gradient(to right, transparent, rgba(71,184,255,0.3), rgba(199,158,97,0.3), transparent)',
                }} />

                {/* Title */}
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{
                        fontSize: 'clamp(44px,8vw,80px)',
                        fontWeight: 900, fontStyle: 'italic',
                        margin: 0, lineHeight: 1,
                        background: `linear-gradient(135deg, ${CYAN} 0%, ${PURPLE} 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        letterSpacing: -2,
                        textTransform: 'uppercase',
                        filter: `drop-shadow(0 0 30px rgba(71,184,255,0.2))`,
                    }}>
                        La Salle, Cheguei!
                    </h1>
                    <p style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 3, marginTop: 10 }}>
                        Sistema Inteligente de Segurança e Retirada de Alunos
                    </p>
                </div>

                {/* Clock */}
                <GlassPanel outerStyle={{ maxWidth: 420, width: '100%' }}>
                    <div style={{ padding: '20px 32px', textAlign: 'center' }}>
                        <div style={{
                            fontSize: 'clamp(48px,10vw,72px)',
                            fontWeight: 900, color: '#fff',
                            lineHeight: 1, letterSpacing: -2,
                            fontVariantNumeric: 'tabular-nums',
                            filter: `drop-shadow(0 0 20px rgba(71,184,255,0.3))`,
                        }}>
                            {formatTime(time)}
                        </div>
                        <div style={{ fontSize: 13, color: TEXT_MUTED, fontWeight: 600, marginTop: 8, textTransform: 'capitalize', letterSpacing: 1 }}>
                            {formatDate(time)}
                        </div>
                    </div>
                </GlassPanel>

                {/* Action panels */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 20,
                    width: '100%', maxWidth: 800,
                }}>
                    {methods.map(({ icon: Icon, label, num, accent, glow }) => (
                        <GlassPanel
                            key={num}
                            className="totem-action-card"
                            outerStyle={{ boxShadow: `0 8px 28px rgba(0,0,0,0.4), 0 0 20px ${glow}` }}
                        >
                            <div style={{
                                padding: '28px 20px',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: 14, textAlign: 'center',
                            }}>
                                {/* Number badge */}
                                <div style={{
                                    fontSize: 10, fontWeight: 800, color: accent,
                                    textTransform: 'uppercase', letterSpacing: 2,
                                    opacity: 0.7,
                                }}>
                                    Opção {num}
                                </div>

                                {/* Icon circle */}
                                <div style={{
                                    width: 68, height: 68, borderRadius: '50%',
                                    background: 'radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.9))',
                                    display: 'grid', placeItems: 'center',
                                    border: `1.5px solid ${accent}`,
                                    boxShadow: `0 0 28px ${glow}, inset 0 0 10px rgba(0,0,0,0.2)`,
                                }}>
                                    <Icon style={{ width: 28, height: 28, color: accent, filter: `drop-shadow(0 0 8px ${glow})` }} />
                                </div>

                                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {label}
                                </div>
                            </div>
                        </GlassPanel>
                    ))}
                </div>

                {/* Touch instruction */}
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                    opacity: pulse ? 1 : 0.35,
                    transition: 'opacity 0.7s ease',
                }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 18,
                        border: '2px solid rgba(255,255,255,0.18)',
                        display: 'grid', placeItems: 'center',
                        fontSize: 26,
                    }}>
                        👆
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 4, margin: 0 }}>
                        Toque em qualquer lugar para iniciar
                    </p>
                </div>

                {/* Divider */}
                <div style={{
                    width: '100%', maxWidth: 700, height: 1,
                    background: 'linear-gradient(to right, transparent, rgba(71,184,255,0.3), rgba(199,158,97,0.3), transparent)',
                }} />
            </main>

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
            <footer style={{
                position: 'relative', zIndex: 2,
                padding: '14px 40px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
            }}>
                {/* Left: status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: pulse ? GREEN : `${GREEN}44`,
                        boxShadow: pulse ? `0 0 10px rgba(52,211,153,0.7)` : 'none',
                        transition: 'all 0.7s ease',
                    }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                        Sistema Ativo
                    </span>
                </div>

                {/* Center: date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Settings style={{ width: 12, height: 12, color: GOLD }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Sistema de Retirada SISRA // V{__APP_VERSION__}
                    </span>
                </div>

                {/* Right: online */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wifi style={{ width: 12, height: 12, color: GOLD }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Status do Link:
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Estável
                    </span>
                </div>
            </footer>
        </div>
    );
}

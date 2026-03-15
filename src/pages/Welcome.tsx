import { Link } from 'react-router-dom';
import { School, User, GraduationCap, Shield, ChevronRight, Settings, Wifi, QrCode, Hash, LogOut } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
const BLUE_COL   = '#2980B9';
const GREEN      = '#34d399';
const TEXT_MUTED = '#8491A2';
const GLASS_BG   = 'rgba(17,24,43,0.65)';

// Gradient-border glass panel (cyan→gold, same pattern used in Login)
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
                width: '100%',
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

export default function Welcome() {
    return (
        <div style={{
            minHeight: '100dvh',
            background: '#070a13',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px 20px',
            fontFamily: "'Inter', system-ui, sans-serif",
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Scoped styles: background pattern + responsive + hover helpers */}
            <style>{`
                .sisra-w-bg {
                    background-image:
                        radial-gradient(circle at 10% 10%, #1a2540 0%, transparent 40%),
                        radial-gradient(circle at 90% 90%, #0d121f 0%, transparent 40%),
                        repeating-linear-gradient(
                            rgba(255,255,255,0.012) 0px,
                            rgba(255,255,255,0.012) 1px,
                            transparent 1px,
                            transparent 15px
                        );
                    background-size: 100% 100%, 100% 100%, 15px 15px;
                }
                .sisra-w-card { transition: transform 0.22s ease, box-shadow 0.22s ease; }
                .sisra-w-card:hover { transform: translateY(-5px); box-shadow: 0 12px 36px rgba(0,0,0,0.5) !important; }
                .sisra-w-card:active { transform: scale(0.975); }
                .sisra-w-hbtn { transition: background 0.2s ease; }
                .sisra-w-hbtn:hover { background: rgba(255,255,255,0.06) !important; }
                @media (max-width: 768px) {
                    .sisra-w-modules { grid-template-columns: 1fr !important; }
                    .sisra-w-header  { flex-direction: column !important; gap: 14px !important; text-align: center !important; }
                    .sisra-w-hctrl  { flex-direction: column !important; width: 100% !important; }
                    .sisra-w-footer  { flex-direction: column !important; gap: 10px !important; text-align: center !important; }
                }
            `}</style>

            {/* Background: radial gradients + micro-grid */}
            <div className="sisra-w-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── Main container ───────────────────────────────────────────── */}
            <div style={{
                position: 'relative', zIndex: 1,
                width: '100%', maxWidth: 992,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 32,
            }}>

                {/* ── Header ─────────────────────────────────────────────── */}
                <GlassPanel
                    innerStyle={{ padding: '14px 28px' }}
                    outerStyle={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                    <div
                        className="sisra-w-header"
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                        }}
                    >
                        {/* Title block */}
                        <div>
                            <div style={{
                                fontSize: 11, fontWeight: 600, color: GOLD,
                                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
                            }}>
                                A La Salle, Cheguei! — SCT
                            </div>
                            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
                                Portal de Acesso
                            </h1>
                        </div>

                        {/* Controls: QR + Code + logout icon */}
                        <div className="sisra-w-hctrl" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.05)',
                                overflow: 'hidden',
                            }}>
                                <Link
                                    to="/totem/qr"
                                    className="sisra-w-hbtn"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '9px 16px',
                                        fontSize: 12, fontWeight: 700,
                                        color: GOLD, textDecoration: 'none',
                                        textTransform: 'uppercase', letterSpacing: 1,
                                        background: 'transparent',
                                    }}
                                >
                                    <QrCode style={{ width: 14, height: 14 }} />
                                    Escanear QR
                                </Link>
                                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                                <Link
                                    to="/totem/codigo"
                                    className="sisra-w-hbtn"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '9px 16px',
                                        fontSize: 12, fontWeight: 700,
                                        color: CYAN, textDecoration: 'none',
                                        textTransform: 'uppercase', letterSpacing: 1,
                                        background: 'transparent',
                                    }}
                                >
                                    <Hash style={{ width: 14, height: 14 }} />
                                    Código
                                </Link>
                            </div>
                            <LogOut style={{ width: 18, height: 18, color: TEXT_MUTED, cursor: 'default', opacity: 0.6 }} />
                        </div>
                    </div>
                </GlassPanel>

                {/* ── Welcome section ─────────────────────────────────────── */}
                <div style={{
                    textAlign: 'center',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 14,
                }}>
                    {/* Logo circle */}
                    <div style={{
                        width: 100, height: 100, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.88))',
                        display: 'grid', placeItems: 'center',
                        border: '1px solid rgba(255,255,255,0.04)',
                        boxShadow: `0 0 32px rgba(199,158,97,0.22), inset 0 0 14px rgba(0,0,0,0.3)`,
                    }}>
                        <School style={{
                            width: 38, height: 38, color: GOLD,
                            filter: `drop-shadow(0 0 10px rgba(199,158,97,0.5))`,
                        }} />
                    </div>

                    <div>
                        <h2 style={{
                            fontSize: 42, fontWeight: 800, color: '#fff',
                            margin: '0 0 8px', fontStyle: 'italic',
                            letterSpacing: -1, lineHeight: 1.1,
                        }}>
                            La Salle, Cheguei!
                        </h2>
                        <p style={{ fontSize: 15, color: TEXT_MUTED, fontWeight: 500, marginBottom: 10 }}>
                            Sistema Inteligente de Segurança e Retirada de Alunos.
                        </p>
                        <span style={{
                            fontSize: 10, color: TEXT_MUTED,
                            textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: 600,
                        }}>
                            Selecione o módulo operacional para iniciar a sequência
                        </span>
                    </div>
                </div>

                {/* ── Module cards grid ───────────────────────────────────── */}
                <div
                    className="sisra-w-modules"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 20, width: '100%',
                    }}
                >
                    {/* RECEPÇÃO */}
                    <Link to="/recepcao/login" style={{ textDecoration: 'none', display: 'flex' }}>
                        <GlassPanel
                            className="sisra-w-card"
                            outerStyle={{ height: '100%' }}
                            innerStyle={{
                                padding: 28,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: 14, textAlign: 'center',
                                position: 'relative', overflow: 'hidden',
                                minHeight: 230,
                            }}
                        >
                            {/* Decorative ghost icon */}
                            <User style={{
                                position: 'absolute', bottom: -10, left: -10,
                                width: 86, height: 86, color: 'rgba(71,184,255,0.04)',
                                pointerEvents: 'none',
                            }} />
                            {/* Icon circle */}
                            <div style={{
                                width: 76, height: 76, borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.88))',
                                display: 'grid', placeItems: 'center',
                                border: '1px solid rgba(255,255,255,0.03)',
                                boxShadow: `0 0 28px rgba(71,184,255,0.22), inset 0 0 10px rgba(0,0,0,0.2)`,
                            }}>
                                <User style={{ width: 32, height: 32, color: CYAN }} />
                            </div>
                            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                                Recepção
                            </h3>
                            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
                                Controle tático de entrada e saída de ativos.
                            </p>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 12, fontWeight: 700, color: GREEN,
                                textTransform: 'uppercase', letterSpacing: 1,
                                marginTop: 'auto',
                            }}>
                                Iniciar Missão
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </div>
                        </GlassPanel>
                    </Link>

                    {/* SCT */}
                    <Link to="/sala/login" style={{ textDecoration: 'none', display: 'flex' }}>
                        <GlassPanel
                            className="sisra-w-card"
                            outerStyle={{ height: '100%' }}
                            innerStyle={{
                                padding: 28,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: 14, textAlign: 'center',
                                position: 'relative', overflow: 'hidden',
                                minHeight: 230,
                            }}
                        >
                            <GraduationCap style={{
                                position: 'absolute', bottom: -10, left: -10,
                                width: 86, height: 86, color: 'rgba(41,128,185,0.04)',
                                pointerEvents: 'none',
                            }} />
                            <div style={{
                                width: 76, height: 76, borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.88))',
                                display: 'grid', placeItems: 'center',
                                border: '1px solid rgba(255,255,255,0.03)',
                                boxShadow: `0 0 28px rgba(41,128,185,0.22), inset 0 0 10px rgba(0,0,0,0.2)`,
                            }}>
                                <GraduationCap style={{ width: 32, height: 32, color: BLUE_COL }} />
                            </div>
                            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                                SCT
                            </h3>
                            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
                                Gestão operacional de sala e liberação.
                            </p>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 12, fontWeight: 700, color: GREEN,
                                textTransform: 'uppercase', letterSpacing: 1,
                                marginTop: 'auto',
                            }}>
                                Portal de Acesso
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </div>
                        </GlassPanel>
                    </Link>

                    {/* Admin */}
                    <Link to="/admin/login" style={{ textDecoration: 'none', display: 'flex' }}>
                        <GlassPanel
                            className="sisra-w-card"
                            outerStyle={{ height: '100%' }}
                            innerStyle={{
                                padding: 28,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: 14, textAlign: 'center',
                                position: 'relative', overflow: 'hidden',
                                minHeight: 230,
                            }}
                        >
                            <Shield style={{
                                position: 'absolute', bottom: -10, left: -10,
                                width: 86, height: 86, color: 'rgba(255,255,255,0.02)',
                                pointerEvents: 'none',
                            }} />
                            <div style={{
                                width: 76, height: 76, borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.88))',
                                display: 'grid', placeItems: 'center',
                                border: '1px solid rgba(255,255,255,0.03)',
                                boxShadow: `0 0 28px rgba(255,255,255,0.12), inset 0 0 10px rgba(0,0,0,0.2)`,
                            }}>
                                <Shield style={{ width: 32, height: 32, color: '#fff' }} />
                            </div>
                            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                                Admin
                            </h3>
                            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
                                Configurações globais e telemetria de dados.
                            </p>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 12, fontWeight: 700, color: GREEN,
                                textTransform: 'uppercase', letterSpacing: 1,
                                marginTop: 'auto',
                            }}>
                                Central de Controle
                                <ChevronRight style={{ width: 14, height: 14 }} />
                            </div>
                        </GlassPanel>
                    </Link>
                </div>

                {/* ── Global footer ───────────────────────────────────────── */}
                <div
                    className="sisra-w-footer"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        fontSize: 11, color: TEXT_MUTED,
                        textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1,
                        padding: '0 4px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Settings style={{ width: 13, height: 13, color: GOLD }} />
                        <span>Sistema de Retirada SISRA // V{__APP_VERSION__}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wifi style={{ width: 13, height: 13, color: GOLD }} />
                        <span>Status do Link:</span>
                        <span style={{ color: GREEN }}>Estável</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

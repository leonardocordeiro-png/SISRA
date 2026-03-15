import { useNavigate } from 'react-router-dom';
import { Search, Hash, QrCode, ArrowLeft, CreditCard, ChevronRight, Settings, Wifi } from 'lucide-react';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
const PURPLE     = '#a26bf5';
const BLUE_COL   = '#2980B9';
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

export default function TotemIdentify() {
    const navigate = useNavigate();
    useInactivityTimer({ timeoutMs: 40000, redirectTo: '/totem' });

    const methods = [
        {
            id: 'busca',
            icon: Search,
            title: 'Buscar por CPF',
            description: 'Digite o CPF do responsável para localizar os alunos vinculados.',
            accent: CYAN,
            glow: 'rgba(71,184,255,0.22)',
            glowBorder: 'rgba(71,184,255,0.35)',
            path: '/totem/busca',
        },
        {
            id: 'codigo',
            icon: Hash,
            title: 'Código de Acesso',
            description: 'Use o código único impresso no seu cartão QR para se identificar.',
            accent: PURPLE,
            glow: 'rgba(162,107,245,0.22)',
            glowBorder: 'rgba(162,107,245,0.35)',
            path: '/totem/codigo',
        },
        {
            id: 'qr',
            icon: QrCode,
            title: 'Escanear QR Code',
            description: 'Aproxime o cartão QR da câmera do terminal para leitura automática.',
            accent: BLUE_COL,
            glow: 'rgba(41,128,185,0.22)',
            glowBorder: 'rgba(41,128,185,0.35)',
            path: '/totem/qr',
        },
    ];

    return (
        <div style={{
            minHeight: '100dvh',
            background: '#070a13',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Scoped styles */}
            <style>{`
                .tid-bg {
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
                .tid-card {
                    transition: transform 0.22s ease, box-shadow 0.22s ease;
                    cursor: pointer;
                    background: none;
                    border: none;
                    padding: 0;
                    text-align: left;
                    width: 100%;
                }
                .tid-card:hover { transform: translateY(-6px); }
                .tid-card:active { transform: scale(0.975); }
                @media (max-width: 768px) {
                    .tid-grid { grid-template-columns: 1fr !important; }
                    .tid-footer { flex-direction: column !important; gap: 10px !important; text-align: center !important; }
                }
            `}</style>

            {/* Background */}
            <div className="tid-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <header style={{
                position: 'relative', zIndex: 2,
                padding: '16px 32px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
            }}>
                {/* Left: back + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <button
                        onClick={() => navigate('/totem')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 18px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, cursor: 'pointer',
                            color: TEXT_MUTED, fontSize: 13, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: 1,
                            transition: 'all 0.2s ease',
                            fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(71,184,255,0.08)';
                            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                            (e.currentTarget as HTMLButtonElement).style.color = TEXT_MUTED;
                        }}
                    >
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        Voltar
                    </button>

                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>
                            A La Salle, Cheguei! — Totem
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Acesso Seguro
                        </div>
                    </div>
                </div>

                {/* Right: badge */}
                <GlassPanel outerStyle={{ flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                    <div style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <QrCode style={{ width: 16, height: 16, color: GOLD }} />
                        <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                                Tela do Totem
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>
                                V{__APP_VERSION__}
                            </div>
                        </div>
                    </div>
                </GlassPanel>
            </header>

            {/* ── WELCOME SECTION ─────────────────────────────────────────────── */}
            <div style={{
                position: 'relative', zIndex: 2,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 12,
                padding: '28px 32px 20px',
                textAlign: 'center',
            }}>
                {/* Logo circle */}
                <div style={{
                    width: 84, height: 84, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(22,28,44,0.2), rgba(10,15,31,0.85))',
                    display: 'grid', placeItems: 'center',
                    border: '1px solid rgba(255,255,255,0.03)',
                    boxShadow: `0 0 30px rgba(199,158,97,0.22), inset 0 0 10px rgba(0,0,0,0.2)`,
                }}>
                    <CreditCard style={{
                        width: 34, height: 34, color: GOLD,
                        filter: `drop-shadow(0 0 10px rgba(199,158,97,0.5))`,
                    }} />
                </div>

                <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', textTransform: 'uppercase', margin: 0, letterSpacing: 1 }}>
                    Como deseja se identificar?
                </h2>
                <p style={{ fontSize: 14, color: TEXT_MUTED, fontWeight: 500, margin: 0 }}>
                    Escolha uma das opções abaixo para autenticação.
                </p>
                <span style={{ fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: 600 }}>
                    Selecione uma opção para iniciar a sequência
                </span>
            </div>

            {/* ── MODULE CARDS ────────────────────────────────────────────────── */}
            <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', alignItems: 'center', padding: '0 32px' }}>
                <div
                    className="tid-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 20,
                        width: '100%',
                    }}
                >
                    {methods.map(({ id, icon: Icon, title, description, accent, glow, glowBorder, path }) => (
                        <button
                            key={id}
                            className="tid-card"
                            onClick={() => navigate(path)}
                        >
                            <GlassPanel
                                outerStyle={{
                                    height: '100%',
                                    boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${glow}`,
                                }}
                            >
                                <div style={{
                                    padding: '32px 24px',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', gap: 16, textAlign: 'center',
                                    position: 'relative', overflow: 'hidden',
                                    minHeight: 260,
                                }}>
                                    {/* Decorative ghost icon */}
                                    <Icon style={{
                                        position: 'absolute', bottom: -12, left: -12,
                                        width: 90, height: 90,
                                        color: `${accent}08`,
                                        pointerEvents: 'none',
                                    }} />

                                    {/* Icon circle */}
                                    <div style={{
                                        width: 80, height: 80, borderRadius: '50%',
                                        background: 'radial-gradient(circle, rgba(22,28,44,0.2), rgba(10,15,31,0.85))',
                                        display: 'grid', placeItems: 'center',
                                        border: `1px solid ${glowBorder}`,
                                        boxShadow: `0 0 30px ${glow}, inset 0 0 10px rgba(0,0,0,0.2)`,
                                    }}>
                                        <Icon style={{ width: 34, height: 34, color: accent, filter: `drop-shadow(0 0 8px ${glow})` }} />
                                    </div>

                                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                                        {title}
                                    </h3>

                                    <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
                                        {description}
                                    </p>

                                    {/* CTA */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        marginTop: 'auto',
                                        padding: '8px 18px',
                                        borderRadius: 20,
                                        background: `${accent}0d`,
                                        border: `1px solid ${glowBorder}`,
                                        color: accent,
                                        fontSize: 11, fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: 1.5,
                                    }}>
                                        Selecionar
                                        <ChevronRight style={{ width: 14, height: 14 }} />
                                    </div>
                                </div>
                            </GlassPanel>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
            <footer
                className="tid-footer"
                style={{
                    position: 'relative', zIndex: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 36px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 11, color: TEXT_MUTED,
                    textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Settings style={{ width: 13, height: 13, color: GOLD }} />
                    <span>Tela do Totem — SISRA</span>
                </div>
                <span style={{ color: `${TEXT_MUTED}80`, fontSize: 10 }}>
                    Terminal retornará ao início automaticamente em caso de inatividade
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wifi style={{ width: 13, height: 13, color: GOLD }} />
                    <span>Status do Link:</span>
                    <span style={{ color: GREEN }}>Estável</span>
                </div>
            </footer>
        </div>
    );
}

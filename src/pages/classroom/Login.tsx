import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useNavigate } from 'react-router-dom';
import { School, Loader2, Eye, EyeOff, Mail, KeyRound, AlertCircle, ChevronRight, Shield, Settings, Wifi } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
const GREEN      = '#34d399';
const TEXT_MUTED = '#8491A2';
const GLASS_BG   = 'rgba(17,24,43,0.65)';

// Gradient-border glass panel (cyan→gold)
function GlassPanel({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(71,184,255,0.35) 0%, rgba(199,158,97,0.35) 100%)',
            padding: 2,
            borderRadius: 14,
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            ...style,
        }}>
            <div style={{
                background: GLASS_BG,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 12,
                height: '100%',
                boxShadow: 'inset 0 0 12px rgba(255,255,255,0.015)',
            }}>
                {children}
            </div>
        </div>
    );
}

export default function ClassroomLogin() {
    const navigate = useNavigate();
    const [email, setEmail]               = useState('');
    const [password, setPassword]         = useState('');
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // ── Authentication logic — UNCHANGED ──────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user) {
                // Verify role
                const { data: userData, error: userError } = await supabase
                    .from('usuarios')
                    .select('tipo_usuario, turma_atribuida')
                    .eq('id', data.user.id)
                    .single();

                if (userError) throw userError;

                if (userData.tipo_usuario !== 'SCT' && userData.tipo_usuario !== 'ADMIN' && userData.tipo_usuario !== 'COORDENADOR') {
                    await supabase.auth.signOut();
                    logAudit('ACESSO_NEGADO', 'usuarios', data.user.id, { email, motivo: 'Perfil sem permissão de acesso ao portal de sala', perfil: userData.tipo_usuario, portal: 'SALA' });
                    throw new Error('Acesso restrito para SCTs.');
                }

                logAudit('LOGIN_SUCESSO', 'usuarios', data.user.id, { email, role: userData.tipo_usuario, turma: userData.turma_atribuida, portal: 'SALA' }, data.user.id);
                navigate('/sala/dashboard');
            }
        } catch (err: any) {
            if (err.message !== 'Acesso restrito para SCTs.') {
                logAudit('LOGIN_FALHA', 'usuarios', undefined, { email, motivo: err.message, portal: 'SALA' });
            }
            setError(err.message || 'Erro ao acessar sala');
        } finally {
            setLoading(false);
        }
    };

    // ── Visual ────────────────────────────────────────────────────────────────
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
            {/* Scoped styles */}
            <style>{`
                .sisra-sala-bg {
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
                .sisra-sala-input { font-family: inherit !important; }
                .sisra-sala-input::placeholder { color: ${TEXT_MUTED}; }
                .sisra-sala-input:focus { outline: none !important; }
                .sisra-sala-btn { transition: all 0.2s ease; }
                .sisra-sala-btn:hover:not(:disabled) {
                    background: rgba(255,255,255,0.08) !important;
                    box-shadow: 0 6px 22px rgba(0,0,0,0.4) !important;
                }
                .sisra-sala-btn:active:not(:disabled) { transform: scale(0.98); }
                .sisra-sala-forgot { transition: color 0.2s; }
                .sisra-sala-forgot:hover { color: #fff !important; }
                @keyframes sisra-sala-pulse {
                    0%   { box-shadow: 0 0 0 0 rgba(71,184,255,0.7); }
                    70%  { box-shadow: 0 0 0 6px rgba(71,184,255,0); }
                    100% { box-shadow: 0 0 0 0 rgba(71,184,255,0); }
                }
                .sisra-sala-dot { animation: sisra-sala-pulse 1.5s infinite; }
                @media (max-width: 768px) {
                    .sisra-sala-grid { grid-template-columns: 1fr !important; }
                    .sisra-sala-brand { display: none !important; }
                    .sisra-sala-footer { flex-direction: column !important; gap: 12px !important; text-align: center !important; }
                }
            `}</style>

            {/* Background */}
            <div className="sisra-sala-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── Layout grid ───────────────────────────────────────────────── */}
            <div
                className="sisra-sala-grid"
                style={{
                    position: 'relative', zIndex: 1,
                    width: '100%', maxWidth: 992,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 40,
                }}
            >
                {/* ── Brand panel (left) ──────────────────────────────────── */}
                <div className="sisra-sala-brand" style={{ display: 'flex' }}>
                    <GlassPanel>
                        <div style={{
                            padding: 32,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 22,
                            textAlign: 'center',
                        }}>
                            <School style={{
                                width: 52, height: 52, color: GOLD,
                                filter: `drop-shadow(0 0 18px rgba(199,158,97,0.55))`,
                            }} />
                            <div>
                                <h1 style={{
                                    fontSize: 30, fontWeight: 800, color: CYAN,
                                    marginBottom: 8, textTransform: 'uppercase',
                                    fontStyle: 'italic', letterSpacing: 1,
                                }}>
                                    Sala de Aula
                                </h1>
                                <p style={{
                                    fontSize: 12, color: TEXT_MUTED,
                                    textTransform: 'uppercase', fontWeight: 600, letterSpacing: 2,
                                }}>
                                    • Acesso Seguro
                                </p>
                            </div>
                            <p style={{
                                fontSize: 14, color: TEXT_MUTED,
                                maxWidth: 230, lineHeight: 1.75, marginTop: 8,
                            }}>
                                Gestão em tempo real para o sucesso do aluno.
                            </p>
                        </div>
                    </GlassPanel>
                </div>

                {/* ── Login panel (right) ─────────────────────────────────── */}
                <GlassPanel>
                    <div style={{
                        padding: '44px 36px',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 26,
                    }}>
                        {/* Status badge */}
                        <div style={{
                            background: 'rgba(17,24,43,0.85)',
                            borderRadius: 30,
                            border: '1px solid rgba(255,255,255,0.06)',
                            padding: '9px 20px',
                            display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: 12, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: 1,
                            color: TEXT_MUTED,
                        }}>
                            <Shield style={{
                                width: 14, height: 14, color: CYAN,
                                filter: `drop-shadow(0 0 6px rgba(71,184,255,0.5))`,
                                flexShrink: 0,
                            }} />
                            Sistema Ativo&nbsp;
                            <strong style={{ color: '#fff' }}>V{__APP_VERSION__}</strong>
                        </div>

                        {/* Title */}
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{
                                fontSize: 26, fontWeight: 800, color: '#fff',
                                marginBottom: 6, textTransform: 'uppercase',
                                fontStyle: 'italic', letterSpacing: 1,
                            }}>
                                Portal SCT
                            </h2>
                            <p style={{
                                fontSize: 11, color: TEXT_MUTED,
                                textTransform: 'uppercase', fontWeight: 600, letterSpacing: 3,
                            }}>
                                • Ambiente de Liberação
                            </p>
                        </div>

                        {/* Form */}
                        <form
                            onSubmit={handleLogin}
                            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}
                        >
                            {/* E-mail */}
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    marginBottom: 8, fontSize: 11, fontWeight: 700,
                                    color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1,
                                }}>
                                    <Mail style={{ width: 13, height: 13, color: CYAN }} />
                                    E-mail da Sala
                                </div>
                                <div style={{
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    padding: '13px 16px',
                                    background: 'rgba(11,16,29,0.75)',
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    backdropFilter: 'blur(2px)',
                                }}>
                                    <input
                                        className="sisra-sala-input"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="professor@lasalle.org.br"
                                        autoComplete="off"
                                        style={{
                                            width: '100%', background: 'none', border: 'none',
                                            fontSize: 15, fontWeight: 500, color: '#fff',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Senha */}
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    marginBottom: 8, fontSize: 11, fontWeight: 700,
                                    color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1,
                                }}>
                                    <KeyRound style={{ width: 13, height: 13, color: CYAN }} />
                                    Senha Digital
                                </div>
                                <div style={{
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    padding: '13px 16px',
                                    background: 'rgba(11,16,29,0.75)',
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    backdropFilter: 'blur(2px)',
                                }}>
                                    <input
                                        className="sisra-sala-input"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="off"
                                        style={{
                                            width: '100%', background: 'none', border: 'none',
                                            fontSize: 15, fontWeight: 500, color: '#fff',
                                            letterSpacing: 2,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            background: 'none', border: 'none',
                                            cursor: 'pointer', color: TEXT_MUTED,
                                            padding: 0, display: 'flex', flexShrink: 0,
                                        }}
                                    >
                                        {showPassword
                                            ? <EyeOff style={{ width: 17, height: 17 }} />
                                            : <Eye style={{ width: 17, height: 17 }} />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.06)',
                                    borderRadius: 8,
                                    border: '1px solid rgba(239,68,68,0.14)',
                                    padding: '11px 14px',
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    fontSize: 12, fontWeight: 700, color: '#ef4444',
                                    textTransform: 'uppercase', letterSpacing: 0.5,
                                }}>
                                    <AlertCircle style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Submit — glass style with pulsing cyan dot */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="sisra-sala-btn"
                                style={{
                                    width: '100%', borderRadius: 30, marginTop: 4,
                                    background: 'rgba(255,255,255,0.04)',
                                    color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
                                    padding: '15px 24px',
                                    fontSize: 14, fontWeight: 800,
                                    textTransform: 'uppercase', letterSpacing: 2,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
                                    opacity: loading ? 0.5 : 1,
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: CYAN }} />
                                        <span>Conectando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span
                                            className="sisra-sala-dot"
                                            style={{
                                                display: 'inline-block', width: 8, height: 8,
                                                borderRadius: '50%', background: CYAN, flexShrink: 0,
                                            }}
                                        />
                                        <span>Conectar Terminal</span>
                                        <ChevronRight style={{ width: 16, height: 16, color: CYAN }} />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer links */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                            fontSize: 11, color: TEXT_MUTED,
                            textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1,
                        }}>
                            <a
                                href="#"
                                className="sisra-sala-forgot"
                                style={{ color: TEXT_MUTED, textDecoration: 'none' }}
                            >
                                Esqueceu sua senha?
                            </a>
                            <span style={{ fontSize: 10, opacity: 0.7 }}>
                                v{__APP_VERSION__} | La Salle, Cheguei! | Intelligent School Ecosystem
                            </span>
                        </div>
                    </div>
                </GlassPanel>

                {/* ── Global footer — spans both columns ──────────────────── */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <div
                        className="sisra-sala-footer"
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
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
        </div>
    );
}

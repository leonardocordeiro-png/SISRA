import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, ChevronRight, AlertCircle, School, Settings, Wifi } from 'lucide-react';

// ── Design tokens (mirrors the reference HTML) ────────────────────────────────
const GOLD        = '#c79e61';
const GREEN       = '#34d399';
const GREEN_BTN   = '#10b981';
const GREEN_DARK  = '#059669';
const TEXT_MUTED  = '#8491A2';
const GLASS_BG    = 'rgba(17,24,43,0.65)';

// Gradient-border wrapper — approximates the ::after pseudo-element technique
function GlassPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(56,217,169,0.38) 0%, rgba(199,158,97,0.38) 100%)',
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

export default function ReceptionLogin() {
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
                    .select('tipo_usuario')
                    .eq('id', data.user.id)
                    .single();

                if (userError) throw userError;

                if (userData.tipo_usuario !== 'RECEPCIONISTA' && userData.tipo_usuario !== 'ADMIN' && userData.tipo_usuario !== 'COORDENADOR') {
                    await supabase.auth.signOut();
                    logAudit('ACESSO_NEGADO', 'usuarios', data.user.id, { email, motivo: 'Perfil sem permissão de acesso ao terminal de recepção', perfil: userData.tipo_usuario, portal: 'RECEPCAO' });
                    throw new Error('Acesso não autorizado para este perfil.');
                }

                logAudit('LOGIN_SUCESSO', 'usuarios', data.user.id, { email, role: userData.tipo_usuario, portal: 'RECEPCAO' }, data.user.id);
                navigate('/recepcao/busca');
            }
        } catch (err: any) {
            if (err.message !== 'Acesso não autorizado para este perfil.') {
                logAudit('LOGIN_FALHA', 'usuarios', undefined, { email, motivo: err.message, portal: 'RECEPCAO' });
            }
            setError(err.message || 'Erro ao realizar login');
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
            {/* Scoped styles: background pattern + micro-grid + hover helpers */}
            <style>{`
                .sisra-recep-bg {
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
                .sisra-recep-input { font-family: inherit !important; }
                .sisra-recep-input::placeholder { color: ${TEXT_MUTED}; }
                .sisra-recep-input:focus { outline: none !important; }
                .sisra-recep-btn { transition: all 0.2s ease; }
                .sisra-recep-btn:hover:not(:disabled) {
                    opacity: 0.88;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 22px rgba(16,185,129,0.45) !important;
                }
                .sisra-recep-btn:active:not(:disabled) { transform: scale(0.98); }
                .sisra-recep-forgot { transition: color 0.2s; }
                .sisra-recep-forgot:hover { color: #fff !important; }
                @media (max-width: 768px) {
                    .sisra-recep-grid { grid-template-columns: 1fr !important; }
                    .sisra-recep-brand { display: none !important; }
                    .sisra-recep-footer { flex-direction: column !important; gap: 12px !important; text-align: center; }
                }
            `}</style>

            {/* Background: radial gradients + micro-grid */}
            <div className="sisra-recep-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── Layout grid ───────────────────────────────────────────────── */}
            <div
                className="sisra-recep-grid"
                style={{
                    position: 'relative', zIndex: 1,
                    width: '100%', maxWidth: 992,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 40,
                }}
            >
                {/* ── Brand panel (left) ──────────────────────────────────── */}
                <div className="sisra-recep-brand" style={{ display: 'flex' }}>
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
                                    fontSize: 30, fontWeight: 800, color: GREEN,
                                    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1,
                                    fontStyle: 'italic',
                                }}>
                                    Terminal Recepção
                                </h1>
                                <p style={{
                                    fontSize: 12, color: TEXT_MUTED,
                                    textTransform: 'uppercase', fontWeight: 600, letterSpacing: 2,
                                }}>
                                    • Portal Administrativo Seguro
                                </p>
                            </div>
                            <p style={{
                                fontSize: 14, color: TEXT_MUTED,
                                maxWidth: 230, lineHeight: 1.75, marginTop: 8,
                            }}>
                                Segurança inteligente para a rotina escolar de quem protege.
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
                            <span style={{
                                display: 'inline-block', width: 8, height: 8,
                                borderRadius: '50%', background: GREEN,
                                boxShadow: `0 0 8px ${GREEN}`,
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
                                Acesso Seguro
                            </h2>
                            <p style={{
                                fontSize: 11, color: TEXT_MUTED,
                                textTransform: 'uppercase', fontWeight: 600, letterSpacing: 3,
                            }}>
                                • Autenticação de Operador
                            </p>
                        </div>

                        {/* Form */}
                        <form
                            onSubmit={handleLogin}
                            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}
                            autoComplete="off"
                        >
                            {/* E-mail */}
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    marginBottom: 8, fontSize: 11, fontWeight: 700,
                                    color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1,
                                }}>
                                    <Mail style={{ width: 13, height: 13, color: GREEN }} />
                                    Identidade de Acesso
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
                                        className="sisra-recep-input"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="recepcao@lasalle.org.br"
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
                                    <Lock style={{ width: 13, height: 13, color: GREEN }} />
                                    Senha de Segurança
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
                                        className="sisra-recep-input"
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

                            {/* Error message */}
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

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="sisra-recep-btn"
                                style={{
                                    width: '100%', borderRadius: 30, marginTop: 4,
                                    background: `linear-gradient(135deg, ${GREEN_BTN} 0%, ${GREEN_DARK} 100%)`,
                                    color: '#fff', border: 'none',
                                    padding: '15px 24px',
                                    fontSize: 14, fontWeight: 800,
                                    textTransform: 'uppercase', letterSpacing: 2,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                                    opacity: loading ? 0.5 : 1,
                                    boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
                                ) : (
                                    <>
                                        <span>Iniciar Acesso</span>
                                        <ChevronRight style={{ width: 17, height: 17 }} />
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
                                className="sisra-recep-forgot"
                                style={{ color: TEXT_MUTED, textDecoration: 'none' }}
                            >
                                Esqueceu sua senha?
                            </a>
                            <span>v{__APP_VERSION__} | La Salle, Cheguei!</span>
                        </div>
                    </div>
                </GlassPanel>

                {/* ── Global footer — spans both columns ──────────────────── */}
                <div style={{ gridColumn: '1 / -1' }}>
                    <div
                        className="sisra-recep-footer"
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

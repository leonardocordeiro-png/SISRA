import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, Eye, EyeOff, Lock, Mail, AlertCircle, ChevronRight, Settings, Wifi, Menu } from 'lucide-react';
import { logAudit } from '../../lib/audit';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
const TEXT_MUTED = '#8491A2';
const GLASS_BG   = 'rgba(17,24,43,0.65)';

// Gradient-border glass panel (cyan→gold)
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

export default function AdminLogin() {
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
                const { data: userData, error: userError } = await supabase
                    .from('usuarios')
                    .select('tipo_usuario')
                    .eq('id', data.user.id)
                    .single();

                if (userError) throw userError;

                if (userData.tipo_usuario !== 'ADMIN') {
                    await supabase.auth.signOut();
                    await logAudit('LOGIN_FALHA', 'usuarios', data.user.id, { email, motivo: 'Acesso negado: Não é administrador' });
                    throw new Error('Acesso exclusivo para administradores.');
                }

                await logAudit('LOGIN_SUCESSO', 'usuarios', data.user.id, { email, role: 'ADMIN' }, data.user.id);
                navigate('/admin/dashboard');
            }
        } catch (err: any) {
            const message = err.message || 'Erro ao realizar login admin';
            setError(message);
            await logAudit('LOGIN_FALHA', undefined, undefined, { email, motivo: message });
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
                .sisra-adm-bg {
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
                .sisra-adm-input { font-family: inherit !important; }
                .sisra-adm-input::placeholder { color: ${TEXT_MUTED}; }
                .sisra-adm-input:focus { outline: none !important; }
                .sisra-adm-btn { transition: all 0.2s ease; }
                .sisra-adm-btn:hover:not(:disabled) {
                    background: rgba(255,255,255,0.08) !important;
                    box-shadow: 0 6px 22px rgba(0,0,0,0.4) !important;
                }
                .sisra-adm-btn:active:not(:disabled) { transform: scale(0.98); }
                .sisra-adm-forgot { transition: color 0.2s; }
                .sisra-adm-forgot:hover { color: #fff !important; }
                @keyframes sisra-adm-pulse {
                    0%   { box-shadow: 0 0 0 0 rgba(71,184,255,0.7); }
                    70%  { box-shadow: 0 0 0 6px rgba(71,184,255,0); }
                    100% { box-shadow: 0 0 0 0 rgba(71,184,255,0); }
                }
                .sisra-adm-dot { animation: sisra-adm-pulse 1.5s infinite; }
                @media (max-width: 768px) {
                    .sisra-adm-header  { flex-direction: column !important; gap: 14px !important; text-align: center !important; }
                    .sisra-adm-footer  { flex-direction: column !important; gap: 12px !important; }
                }
            `}</style>

            {/* Background */}
            <div className="sisra-adm-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── Main container ───────────────────────────────────────────── */}
            <div style={{
                position: 'relative', zIndex: 1,
                width: '100%', maxWidth: 992,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 32,
            }}>

                {/* ── Header ─────────────────────────────────────────────── */}
                <GlassPanel
                    outerStyle={{ width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                    innerStyle={{ padding: '14px 28px' }}
                >
                    <div
                        className="sisra-adm-header"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
                    >
                        <div>
                            <div style={{
                                fontSize: 11, fontWeight: 600, color: GOLD,
                                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
                            }}>
                                Manifesto de Comando — Portal Administrativo Seguro
                            </div>
                            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, fontStyle: 'italic' }}>
                                Manifesto de Comando
                            </h1>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <Menu style={{ width: 18, height: 18, color: TEXT_MUTED, cursor: 'default', opacity: 0.6 }} />
                        </div>
                    </div>
                </GlassPanel>

                {/* ── Auth panel (centered) ───────────────────────────────── */}
                <GlassPanel
                    outerStyle={{ width: '100%', maxWidth: 480 }}
                    innerStyle={{
                        padding: '44px 36px',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 26,
                    }}
                >
                    {/* Badge */}
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
                            width: 16, height: 16, color: CYAN,
                            filter: `drop-shadow(0 0 6px rgba(71,184,255,0.5))`,
                        }} />
                        Manifesto de Comando&nbsp;
                        <strong style={{ color: '#fff' }}>V{__APP_VERSION__}</strong>
                    </div>

                    {/* Title */}
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{
                            fontSize: 22, fontWeight: 800, color: GOLD,
                            marginBottom: 6, textTransform: 'uppercase',
                            fontStyle: 'italic', letterSpacing: 1,
                        }}>
                            Manifesto de Comando
                        </h2>
                        <p style={{
                            fontSize: 11, color: TEXT_MUTED,
                            textTransform: 'uppercase', fontWeight: 600, letterSpacing: 3,
                        }}>
                            • Portal Administrativo Seguro
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
                                <Mail style={{ width: 13, height: 13, color: CYAN }} />
                                Identidade de Acesso
                            </div>
                            <div style={{
                                borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                                padding: '13px 16px', background: 'rgba(11,16,29,0.75)',
                                display: 'flex', alignItems: 'center', gap: 12,
                                backdropFilter: 'blur(2px)',
                            }}>
                                <input
                                    className="sisra-adm-input"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@lasalle.org.br"
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
                                <Lock style={{ width: 13, height: 13, color: CYAN }} />
                                Senha de Segurança
                            </div>
                            <div style={{
                                borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)',
                                padding: '13px 16px', background: 'rgba(11,16,29,0.75)',
                                display: 'flex', alignItems: 'center', gap: 12,
                                backdropFilter: 'blur(2px)',
                            }}>
                                <input
                                    className="sisra-adm-input"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
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
                            className="sisra-adm-btn"
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
                                    <span>Autenticando...</span>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="sisra-adm-dot"
                                        style={{
                                            display: 'inline-block', width: 8, height: 8,
                                            borderRadius: '50%', background: CYAN, flexShrink: 0,
                                        }}
                                    />
                                    <span>Iniciar Acesso</span>
                                    <ChevronRight style={{ width: 16, height: 16, color: CYAN }} />
                                </>
                            )}
                        </button>
                    </form>
                </GlassPanel>

                {/* ── Footer — two glass badges ───────────────────────────── */}
                <div
                    className="sisra-adm-footer"
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16, width: '100%',
                    }}
                >
                    <GlassPanel
                        outerStyle={{ flex: 1 }}
                        innerStyle={{
                            padding: '12px 20px',
                            display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: 11, color: TEXT_MUTED,
                            textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1,
                        }}
                    >
                        <Settings style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 2 }}>Protocolo de Acesso</div>
                            <div>V{__APP_VERSION__} // Criptografado</div>
                        </div>
                    </GlassPanel>

                    <GlassPanel
                        outerStyle={{ flex: 1 }}
                        innerStyle={{
                            padding: '12px 20px',
                            display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: 11, color: TEXT_MUTED,
                            textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1,
                        }}
                    >
                        <Wifi style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: 2 }}>Nó do Sistema</div>
                            <div style={{ color: '#fff' }}>SISRA_ADMIN_NODE_01</div>
                        </div>
                    </GlassPanel>
                </div>
            </div>
        </div>
    );
}

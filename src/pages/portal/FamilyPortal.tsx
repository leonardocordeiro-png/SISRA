import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Shield, LogOut, RefreshCw, Bell, BellOff, Clock, CheckCircle2,
    AlertTriangle, User, School, ChevronRight, Loader2, KeyRound,
    CheckCheck, XCircle, Eye, EyeOff, Sparkles,
    Activity, MapPin, ArrowRight, Star, GraduationCap,
} from 'lucide-react';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const B = {
    navy: '#104699', navyDark: '#0a2f6b', navyDeep: '#071830',
    navyCard: 'rgba(16,70,153,0.18)', navyBorder: 'rgba(16,70,153,0.35)',
    gold: '#fbd12d', goldDark: '#e8be1a', onGold: '#071830',
    goldCard: 'rgba(251,209,45,0.10)', goldBorder: 'rgba(251,209,45,0.28)',
    red: '#E40123', redCard: 'rgba(228,1,35,0.12)', redBorder: 'rgba(228,1,35,0.35)',
    green: '#22C55E', greenCard: 'rgba(34,197,94,0.10)', greenBorder: 'rgba(34,197,94,0.30)',
    gray: '#A7A7A2', white: '#FFFFFF',
    surface: 'rgba(255,255,255,0.04)', surfaceBorder: 'rgba(255,255,255,0.08)',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Guardian = {
    id: string;
    nome_completo: string;
    foto_url: string | null;
    parentesco?: string;
};

type Student = {
    id: string;
    nome_completo: string;
    turma: string;
    sala: string;
    foto_url: string | null;
};

type Request = {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    horario_liberacao: string | null;
    horario_confirmacao: string | null;
    mensagem_sala: string | null;
    mensagem_recepcao: string | null;
    aluno: Student;
};

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; order: number }> = {
    SOLICITADO:  { label: 'Aguardando Sala',    color: B.gray,  bg: B.surface,    border: B.surfaceBorder, icon: <Clock size={14} />,        order: 1 },
    NOTIFICADO:  { label: 'Sala Notificada',    color: B.gold,  bg: B.goldCard,   border: B.goldBorder,    icon: <Bell size={14} />,         order: 2 },
    AGUARDANDO:  { label: 'Aguardando Liberação', color: B.gold, bg: B.goldCard, border: B.goldBorder,     icon: <Clock size={14} />,        order: 3 },
    LIBERADO:    { label: 'A Caminho',          color: B.gold,  bg: B.goldCard,   border: B.goldBorder,    icon: <ArrowRight size={14} />,   order: 4 },
    CONFIRMADO:  { label: 'Na Recepção',        color: B.green, bg: B.greenCard,  border: B.greenBorder,   icon: <MapPin size={14} />,       order: 5 },
    CONCLUIDO:   { label: 'Concluído',          color: B.green, bg: B.greenCard,  border: B.greenBorder,   icon: <CheckCheck size={14} />,   order: 6 },
    CANCELADO:   { label: 'Cancelado',          color: B.red,   bg: B.redCard,    border: B.redBorder,     icon: <XCircle size={14} />,      order: 0 },
};

const PIPELINE = ['SOLICITADO', 'NOTIFICADO', 'LIBERADO', 'CONFIRMADO', 'CONCLUIDO'];

function elapsed(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    return `${Math.floor(diff / 3600)}h atrás`;
}

function fmtTime(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── Components ────────────────────────────────────────────────────────────────

function StatusBadge({ status, emergency }: { status: string; emergency?: boolean }) {
    if (emergency && status !== 'CONCLUIDO' && status !== 'CANCELADO') {
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 99,
                background: B.redCard, border: `1px solid ${B.redBorder}`,
                color: B.red, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
                <AlertTriangle size={11} /> EMERGÊNCIA
            </span>
        );
    }
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['SOLICITADO'];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 99,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            color: cfg.color, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
            {cfg.icon} {cfg.label}
        </span>
    );
}

function ProgressBar({ status, emergency }: { status: string; emergency?: boolean }) {
    const idx = PIPELINE.indexOf(status);
    const progress = idx === -1 ? 0 : Math.round(((idx + 1) / PIPELINE.length) * 100);
    const color = emergency ? B.red : status === 'CONCLUIDO' ? B.green : B.gold;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                {PIPELINE.map((step, i) => {
                    const done = idx >= i;
                    const current = idx === i;
                    const stepCfg = STATUS_CONFIG[step];
                    return (
                        <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: done ? color : 'rgba(255,255,255,0.06)',
                                border: `2px solid ${done ? color : 'rgba(255,255,255,0.12)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, color: done ? (color === B.gold ? B.onGold : '#fff') : 'rgba(255,255,255,0.3)',
                                transition: 'all 0.4s',
                                boxShadow: current ? `0 0 0 3px ${color}30` : 'none',
                                position: 'relative',
                            }}>
                                {done ? (current ? stepCfg.icon : <CheckCircle2 size={13} />) : <span style={{ fontSize: 9, fontWeight: 700 }}>{i + 1}</span>}
                            </div>
                            {i < PIPELINE.length - 1 && (
                                <div style={{
                                    position: 'absolute',
                                    // connecting line handled below
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${progress}%`,
                    background: `linear-gradient(90deg, ${color}aa, ${color})`,
                    borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {PIPELINE.map((step, i) => (
                    <span key={step} style={{
                        fontSize: 9, textAlign: 'center', flex: 1,
                        color: idx >= i ? color : 'rgba(255,255,255,0.25)',
                        fontWeight: idx === i ? 800 : 600,
                        letterSpacing: '0.03em',
                    }}>
                        {STATUS_CONFIG[step].label.split(' ')[0]}
                    </span>
                ))}
            </div>
        </div>
    );
}

function RequestCard({ req }: { req: Request }) {
    const [expanded, setExpanded] = useState(false);
    const isEmergency = req.tipo_solicitacao === 'EMERGENCIA';
    const isActive = !['CONCLUIDO', 'CANCELADO'].includes(req.status);
    const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG['SOLICITADO'];

    return (
        <div style={{
            background: isEmergency ? B.redCard : B.navyCard,
            border: `1.5px solid ${isEmergency ? B.redBorder : cfg.border}`,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: isEmergency ? `0 0 0 1px ${B.red}20, 0 8px 32px rgba(228,1,35,0.15)`
                : req.status === 'CONFIRMADO' ? `0 4px 20px rgba(34,197,94,0.12)`
                : req.status === 'CONCLUIDO' ? `0 4px 20px rgba(34,197,94,0.08)`
                : '0 4px 16px rgba(0,0,0,0.2)',
            transition: 'all 0.3s',
            animation: isEmergency && isActive ? 'portal-pulse 2s infinite' : 'none',
        }}>
            {/* Emergency stripe */}
            {isEmergency && isActive && (
                <div style={{ height: 3, background: `linear-gradient(90deg, ${B.red}, #ff4d6d, ${B.red})`, backgroundSize: '200% 100%', animation: 'stripe-move 2s linear infinite' }} />
            )}
            {/* Completed stripe */}
            {req.status === 'CONCLUIDO' && (
                <div style={{ height: 3, background: `linear-gradient(90deg, ${B.green}60, ${B.green})` }} />
            )}

            {/* Card header */}
            <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Student photo */}
                    <div style={{
                        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                        background: 'rgba(255,255,255,0.06)',
                        border: `2px solid ${isEmergency ? B.redBorder : B.navyBorder}`,
                        overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {req.aluno.foto_url
                            ? <img src={req.aluno.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <GraduationCap size={22} color="rgba(255,255,255,0.3)" />
                        }
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            margin: 0, fontWeight: 900, fontSize: 15, color: '#fff',
                            textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 1.2,
                            wordBreak: 'break-word', overflowWrap: 'anywhere',
                        }}>
                            {req.aluno.nome_completo}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: B.gray, fontWeight: 600 }}>
                                {req.aluno.turma}
                            </span>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: B.gray, fontWeight: 600 }}>
                                SALA {req.aluno.sala}
                            </span>
                        </div>
                        <div style={{ marginTop: 6 }}>
                            <StatusBadge status={req.status} emergency={isEmergency} />
                        </div>
                    </div>

                    {/* Expand toggle */}
                    {isActive && (
                        <button
                            onClick={() => setExpanded(v => !v)}
                            style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 10, padding: '7px 9px',
                                cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                                transition: 'all 0.2s', flexShrink: 0,
                            }}
                        >
                            {expanded ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    )}
                </div>

                {/* Elapsed time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10 }}>
                    <Clock size={11} color="rgba(255,255,255,0.3)" />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                        {elapsed(req.horario_solicitacao)}
                    </span>
                    {fmtTime(req.horario_solicitacao) && (
                        <>
                            <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 11 }}>·</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                                {fmtTime(req.horario_solicitacao)}
                            </span>
                        </>
                    )}
                    {req.status === 'CONCLUIDO' && fmtTime(req.horario_confirmacao) && (
                        <span style={{ fontSize: 11, color: B.green, fontWeight: 700, marginLeft: 4 }}>
                            Concluído às {fmtTime(req.horario_confirmacao)}
                        </span>
                    )}
                </div>
            </div>

            {/* Expanded: progress pipeline */}
            {(isActive || expanded) && (
                <div style={{
                    padding: '0 16px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: 14,
                    display: (isActive || expanded) ? 'block' : 'none',
                }}>
                    <ProgressBar status={req.status} emergency={isEmergency} />

                    {/* Messages */}
                    {req.mensagem_sala && (
                        <div style={{
                            marginTop: 12, padding: '10px 12px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10,
                        }}>
                            <p style={{ margin: 0, fontSize: 11, color: B.gray, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Mensagem da sala
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                                {req.mensagem_sala}
                            </p>
                        </div>
                    )}
                    {req.mensagem_recepcao && (
                        <div style={{
                            marginTop: 8, padding: '10px 12px',
                            background: B.goldCard,
                            border: `1px solid ${B.goldBorder}`,
                            borderRadius: 10,
                        }}>
                            <p style={{ margin: 0, fontSize: 11, color: B.goldDark, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Mensagem da recepção
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                                {req.mensagem_recepcao}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StudentSummaryPill({ student, active }: { student: Student; active: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 99,
            background: active ? B.goldCard : B.surface,
            border: `1px solid ${active ? B.goldBorder : B.surfaceBorder}`,
            flexShrink: 0,
        }}>
            <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {student.foto_url
                    ? <img src={student.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <User size={12} color="rgba(255,255,255,0.3)" />
                }
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: active ? B.gold : 'rgba(255,255,255,0.4)', letterSpacing: '0.02em' }}>
                {student.nome_completo.split(' ')[0]}
            </span>
            {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: B.gold, animation: 'ping-dot 1.5s infinite' }} />}
        </div>
    );
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (guardian: Guardian, students: Student[]) => void }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCode, setShowCode] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;
        setLoading(true);
        setError('');

        try {
            const escolaIdEnv = (import.meta.env.VITE_ESCOLA_ID as string | undefined)?.trim();

            const { data: responsavel, error: respErr } = await supabase
                .from('responsaveis')
                .select('id, nome_completo, foto_url, parentesco')
                .eq('codigo_acesso', code.trim().toUpperCase())
                .maybeSingle();

            if (respErr) throw respErr;
            if (!responsavel) {
                setError('Código de acesso inválido. Verifique o código no cartão QR ou entre em contato com a escola.');
                setLoading(false);
                return;
            }

            let linksQ = supabase
                .from('alunos_responsaveis')
                .select('aluno:alunos(id, nome_completo, turma, sala, foto_url, escola_id)')
                .eq('responsavel_id', responsavel.id);
            const { data: links, error: linkErr } = await linksQ;

            if (linkErr) throw linkErr;

            const allStudents = (links || []).map((l: any) => l.aluno).filter(Boolean);
            // Restrict to current school when VITE_ESCOLA_ID is configured
            const students = escolaIdEnv
                ? allStudents.filter((s: any) => s.escola_id === escolaIdEnv)
                : allStudents;
            onLogin(responsavel, students);
        } catch (err: any) {
            setError('Erro ao verificar o código. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100dvh',
            background: `linear-gradient(160deg, ${B.navyDeep} 0%, ${B.navyDark} 50%, ${B.navyDeep} 100%)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
            <style>{`
                @keyframes float-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
                @keyframes logo-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,209,45,0.0); } 50% { box-shadow: 0 0 32px 8px rgba(251,209,45,0.15); } }
            `}</style>

            <div style={{ width: '100%', maxWidth: 400, animation: 'float-in 0.6s ease both' }}>
                {/* Logo / Brand */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: 22,
                        background: `linear-gradient(135deg, ${B.navy}, ${B.navyDark})`,
                        border: `2px solid ${B.goldBorder}`,
                        margin: '0 auto 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'logo-glow 3s ease-in-out infinite',
                    }}>
                        <Shield size={34} color={B.gold} />
                    </div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: B.white, letterSpacing: '-0.02em' }}>
                        Portal do Responsável
                    </h1>
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: B.gray, lineHeight: 1.4 }}>
                        Acompanhe a retirada dos seus filhos em tempo real
                    </p>
                </div>

                {/* Auth card */}
                <form onSubmit={handleSubmit} style={{
                    background: B.navyCard,
                    border: `1.5px solid ${B.navyBorder}`,
                    borderRadius: 24, padding: 28,
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                }}>
                    <label style={{ display: 'block', marginBottom: 12 }}>
                        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: B.gray, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Código de Acesso
                        </p>
                        <div style={{ position: 'relative' }}>
                            <KeyRound size={16} color={B.gray} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                            <input
                                ref={inputRef}
                                type={showCode ? 'text' : 'password'}
                                value={code}
                                onChange={e => setCode(e.target.value.toUpperCase())}
                                placeholder="Ex: AB12-XY34"
                                autoComplete="off"
                                autoCapitalize="characters"
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '13px 42px 13px 40px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: `1.5px solid ${error ? B.redBorder : B.navyBorder}`,
                                    borderRadius: 14, color: B.white,
                                    fontSize: 18, fontWeight: 800, letterSpacing: '0.2em',
                                    fontFamily: 'monospace',
                                    outline: 'none', transition: 'border-color 0.2s',
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = B.gold; }}
                                onBlur={e => { e.currentTarget.style.borderColor = error ? B.redBorder : B.navyBorder; }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCode(v => !v)}
                                style={{
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: B.gray, padding: 4,
                                }}
                            >
                                {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </label>

                    {error && (
                        <div style={{
                            padding: '10px 14px', borderRadius: 12, marginBottom: 16,
                            background: B.redCard, border: `1px solid ${B.redBorder}`,
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                            <AlertTriangle size={15} color={B.red} style={{ flexShrink: 0, marginTop: 1 }} />
                            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !code.trim()}
                        style={{
                            width: '100%', padding: '14px',
                            background: loading || !code.trim() ? 'rgba(251,209,45,0.3)' : B.gold,
                            border: 'none', borderRadius: 14,
                            color: B.onGold, fontSize: 15, fontWeight: 900,
                            cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'all 0.2s', letterSpacing: '0.04em',
                        }}
                    >
                        {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ChevronRight size={18} />}
                        {loading ? 'Verificando...' : 'Acessar Portal'}
                    </button>

                    <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                        O código de acesso está disponível no cartão QR fornecido pela escola.
                    </p>
                </form>

                {/* Footer */}
                <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
                    La Salle · Sistema de Retirada Segura
                </p>
            </div>
        </div>
    );
}

// ── Main Portal ───────────────────────────────────────────────────────────────

export default function FamilyPortal() {
    const [guardian, setGuardian] = useState<Guardian | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [requests, setRequests] = useState<Request[]>([]);
    const [history, setHistory] = useState<Request[]>([]);
    const [loading, setLoading] = useState(false);
    const [online, setOnline] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [notif, setNotif] = useState(true);
    const [tab, setTab] = useState<'active' | 'history'>('active');
    const prevStatusRef = useRef<Record<string, string>>({});
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // ── Persist session across page reloads ──
    useEffect(() => {
        const saved = sessionStorage.getItem('sisra_portal_session');
        if (saved) {
            try {
                const { guardian: g, students: s } = JSON.parse(saved);
                setGuardian(g);
                setStudents(s);
            } catch { /* ignore */ }
        }
    }, []);

    const handleLogin = (g: Guardian, s: Student[]) => {
        setGuardian(g);
        setStudents(s);
        sessionStorage.setItem('sisra_portal_session', JSON.stringify({ guardian: g, students: s }));
    };

    const handleLogout = () => {
        setGuardian(null);
        setStudents([]);
        setRequests([]);
        setHistory([]);
        sessionStorage.removeItem('sisra_portal_session');
    };

    // ── Fetch data ───────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!guardian || students.length === 0) return;
        const ids = students.map(s => s.id);

        const today = new Date().toISOString().slice(0, 10);

        const [activeRes, histRes] = await Promise.all([
            supabase
                .from('solicitacoes_retirada')
                .select(`
                    id, status, tipo_solicitacao,
                    horario_solicitacao, horario_liberacao, horario_confirmacao,
                    mensagem_sala, mensagem_recepcao,
                    aluno:alunos!inner(id, nome_completo, turma, sala, foto_url)
                `)
                .in('aluno_id', ids)
                .not('status', 'in', '("CONCLUIDO","CANCELADO")')
                .order('horario_solicitacao', { ascending: false }),
            supabase
                .from('solicitacoes_retirada')
                .select(`
                    id, status, tipo_solicitacao,
                    horario_solicitacao, horario_liberacao, horario_confirmacao,
                    mensagem_sala, mensagem_recepcao,
                    aluno:alunos!inner(id, nome_completo, turma, sala, foto_url)
                `)
                .in('aluno_id', ids)
                .in('status', ['CONCLUIDO', 'CANCELADO'])
                .gte('horario_solicitacao', `${today}T00:00:00`)
                .order('horario_confirmacao', { ascending: false })
                .limit(20),
        ]);

        if (!activeRes.error && activeRes.data) {
            const newReqs = activeRes.data as unknown as Request[];

            // Detect status changes for notification
            if (notif) {
                newReqs.forEach(req => {
                    const prev = prevStatusRef.current[req.id];
                    if (prev && prev !== req.status) {
                        // Status changed — play a soft beep
                        try { audioRef.current?.play().catch(() => {}); } catch { /* ignore */ }
                    }
                    prevStatusRef.current[req.id] = req.status;
                });
            }

            setRequests(newReqs);
        }

        if (!histRes.error && histRes.data) {
            setHistory(histRes.data as unknown as Request[]);
        }

        setLastUpdate(new Date());
    }, [guardian, students, notif]);

    // ── Initial fetch + polling ───────────────────────────────────────────────
    useEffect(() => {
        if (!guardian) return;
        setLoading(true);
        fetchData().finally(() => setLoading(false));

        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [guardian, fetchData]);

    // ── Realtime subscription ─────────────────────────────────────────────────
    useEffect(() => {
        if (!guardian || students.length === 0) return;

        const studentIds = students.map(s => s.id);
        // Supabase Realtime filter supports a single column equality; we use
        // aluno_id for the first student as a hint, and let fetchData scope the rest.
        const realtimeFilter = studentIds.length === 1
            ? { filter: `aluno_id=eq.${studentIds[0]}` }
            : {};

        const channel = supabase
            .channel(`portal-${guardian.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'solicitacoes_retirada',
                ...realtimeFilter,
            }, () => { fetchData(); })
            .subscribe(status => {
                setOnline(status === 'SUBSCRIBED');
            });

        return () => { supabase.removeChannel(channel); };
    }, [guardian, students, fetchData]);

    // ── Audio element (silent audio for status change ping) ───────────────────
    useEffect(() => {
        // Create a tiny oscillator-based beep sound using Web Audio API
        // We'll just set up a ref; actual playback via AudioContext on status change
    }, []);

    if (!guardian) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    const activeIds = new Set(requests.map(r => r.aluno.id));
    const firstName = guardian.nome_completo.split(' ')[0];
    const hasEmergency = requests.some(r => r.tipo_solicitacao === 'EMERGENCIA');

    return (
        <div style={{
            minHeight: '100dvh',
            background: `linear-gradient(160deg, ${B.navyDeep} 0%, ${B.navyDark} 60%, ${B.navyDeep} 100%)`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: B.white,
            paddingBottom: 32,
        }}>
            <style>{`
                @keyframes portal-pulse { 0%,100% { opacity:1; } 50% { opacity:.85; } }
                @keyframes stripe-move { 0% { background-position:0 0; } 100% { background-position:200% 0; } }
                @keyframes ping-dot { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.5); opacity:.5; } }
                @keyframes spin { to { transform:rotate(360deg); } }
                @keyframes slide-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
                @keyframes fade-in { from { opacity:0; } to { opacity:1; } }
                * { box-sizing: border-box; }
            `}</style>

            {/* ── Header ── */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: `linear-gradient(180deg, ${B.navyDeep}f0 0%, ${B.navyDeep}cc 100%)`,
                backdropFilter: 'blur(16px)',
                borderBottom: `1px solid ${B.navyBorder}`,
                padding: '14px 20px',
            }}>
                {/* Emergency banner */}
                {hasEmergency && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', borderRadius: 10, marginBottom: 12,
                        background: B.redCard, border: `1px solid ${B.redBorder}`,
                        animation: 'portal-pulse 1.5s infinite',
                    }}>
                        <AlertTriangle size={16} color={B.red} />
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: B.red, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Solicitação de Emergência Ativa
                        </p>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Guardian avatar */}
                    <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                        background: B.navyCard, border: `2px solid ${B.goldBorder}`,
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {guardian.foto_url
                            ? <img src={guardian.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <User size={20} color={B.gold} />
                        }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: B.white, letterSpacing: '-0.01em' }}>
                            Olá, {firstName}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: online ? B.green : B.red, flexShrink: 0 }} />
                            <p style={{ margin: 0, fontSize: 11, color: B.gray }}>
                                {online ? 'Tempo real' : 'Reconectando...'}
                                {lastUpdate && ` · ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                            </p>
                        </div>
                    </div>

                    {/* Notification toggle */}
                    <button
                        onClick={() => setNotif(v => !v)}
                        title={notif ? 'Desativar notificações de som' : 'Ativar notificações de som'}
                        style={{
                            background: notif ? B.goldCard : B.surface,
                            border: `1px solid ${notif ? B.goldBorder : B.surfaceBorder}`,
                            borderRadius: 10, padding: '8px 9px',
                            cursor: 'pointer', color: notif ? B.gold : 'rgba(255,255,255,0.3)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {notif ? <Bell size={16} /> : <BellOff size={16} />}
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchData()}
                        disabled={loading}
                        style={{
                            background: B.surface, border: `1px solid ${B.surfaceBorder}`,
                            borderRadius: 10, padding: '8px 9px',
                            cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                            transition: 'all 0.2s',
                        }}
                    >
                        <RefreshCw size={16} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                    </button>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        style={{
                            background: B.surface, border: `1px solid ${B.surfaceBorder}`,
                            borderRadius: 10, padding: '8px 9px',
                            cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                            transition: 'all 0.2s',
                        }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>

                {/* Student pills scroll */}
                {students.length > 0 && (
                    <div style={{
                        display: 'flex', gap: 8, marginTop: 12,
                        overflowX: 'auto', paddingBottom: 2,
                        scrollbarWidth: 'none',
                    }}>
                        {students.map(s => (
                            <StudentSummaryPill key={s.id} student={s} active={activeIds.has(s.id)} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Tabs ── */}
            <div style={{ padding: '16px 20px 0', display: 'flex', gap: 8 }}>
                {(['active', 'history'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '9px 18px', borderRadius: 12,
                            background: tab === t ? B.gold : B.surface,
                            border: `1.5px solid ${tab === t ? B.gold : B.surfaceBorder}`,
                            color: tab === t ? B.onGold : 'rgba(255,255,255,0.45)',
                            fontSize: 13, fontWeight: 800, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.2s', letterSpacing: '0.02em',
                        }}
                    >
                        {t === 'active'
                            ? <><Activity size={14} /> Em Andamento {requests.length > 0 && `(${requests.length})`}</>
                            : <><CheckCheck size={14} /> Hoje {history.length > 0 && `(${history.length})`}</>
                        }
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div style={{ padding: '16px 20px' }}>
                {loading && requests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Loader2 size={32} color={B.gold} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                        <p style={{ color: B.gray, fontSize: 14 }}>Carregando informações...</p>
                    </div>
                ) : tab === 'active' ? (
                    requests.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '60px 24px',
                            animation: 'fade-in 0.5s ease both',
                        }}>
                            <div style={{
                                width: 72, height: 72, borderRadius: 22,
                                background: B.navyCard, border: `1.5px solid ${B.navyBorder}`,
                                margin: '0 auto 16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <School size={30} color={B.gray} />
                            </div>
                            <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16, color: B.white }}>
                                Tudo tranquilo!
                            </p>
                            <p style={{ margin: 0, color: B.gray, fontSize: 14, lineHeight: 1.5 }}>
                                Não há solicitações de retirada ativas no momento.
                                {students.length > 0 && ` Acompanhando ${students.length} aluno${students.length > 1 ? 's' : ''}.`}
                            </p>
                            {history.length === 0 && (
                                <div style={{
                                    marginTop: 20, padding: '12px 16px',
                                    background: B.goldCard, border: `1px solid ${B.goldBorder}`,
                                    borderRadius: 14,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                        <Sparkles size={15} color={B.gold} />
                                        <p style={{ margin: 0, fontSize: 13, color: B.gold, fontWeight: 700 }}>
                                            Monitoramento ativo em tempo real
                                        </p>
                                    </div>
                                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                                        Você será notificado assim que uma solicitação for criada.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {requests.map((req, i) => (
                                <div key={req.id} style={{ animation: `slide-up 0.4s ease ${i * 0.08}s both` }}>
                                    <RequestCard req={req} />
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 24px', animation: 'fade-in 0.5s ease both' }}>
                            <div style={{
                                width: 72, height: 72, borderRadius: 22,
                                background: B.navyCard, border: `1.5px solid ${B.navyBorder}`,
                                margin: '0 auto 16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Star size={30} color={B.gray} />
                            </div>
                            <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 16, color: B.white }}>
                                Sem histórico hoje
                            </p>
                            <p style={{ margin: 0, color: B.gray, fontSize: 14 }}>
                                Solicitações concluídas ou canceladas hoje aparecerão aqui.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {history.map((req, i) => (
                                <div key={req.id} style={{ animation: `slide-up 0.4s ease ${i * 0.08}s both` }}>
                                    <RequestCard req={req} />
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* ── Footer ── */}
            <div style={{ textAlign: 'center', padding: '8px 20px 0', borderTop: `1px solid ${B.surfaceBorder}`, marginTop: 8 }}>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
                    La Salle · Dados atualizados a cada 5 segundos
                </p>
            </div>
        </div>
    );
}

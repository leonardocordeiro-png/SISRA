import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, Bell, User as UserIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import type { Student, Guardian } from '../../types';

interface LocationState {
    students: Student[];
    guardian?: Guardian | null;
    mode: 'search' | 'code' | 'qr';
}

type Step = 'confirm' | 'sending' | 'success' | 'error';

// ── Live clock ─────────────────────────────────────────────────────────────────
function Clock() {
    const fmt = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const [time, setTime] = useState(fmt);
    useEffect(() => {
        const t = setInterval(() => setTime(fmt()), 1000);
        return () => clearInterval(t);
    }, []);
    return <span style={{ fontFamily: "'Roboto Mono',monospace", fontSize: '0.9rem', color: '#e0e6ed' }}>{time}</span>;
}

// ── AlertCircle icon ───────────────────────────────────────────────────────────
const AlertCircle = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

// ── CheckMark for guardian card overlay ────────────────────────────────────────
const CheckMark = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#00e676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ── CSS injected via <style> ───────────────────────────────────────────────────
const pageStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Roboto:wght@300;400;500;700;900&display=swap');

    .conf-back-btn:hover  { background: rgba(176,145,79,0.1) !important; box-shadow: 0 0 10px rgba(176,145,79,0.2) !important; }
    .conf-guardian-btn:not(.sel):hover { border-color: rgba(77,166,255,0.3) !important; box-shadow: 0 0 15px rgba(77,166,255,0.1) !important; }
    .conf-student-btn:hover  { opacity: 1 !important; }
    .conf-call-btn:not(:disabled):hover { background: #00ff84 !important; transform: translateY(-2px) !important; box-shadow: 0 15px 40px rgba(0,230,118,0.4) !important; }
    .conf-footer-dot { animation: conf-pulse 2s infinite; }
    .conf-list::-webkit-scrollbar { width: 4px; }
    .conf-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
    .conf-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

    @keyframes conf-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(46,204,113,0.7); }
        70%  { box-shadow: 0 0 0 6px rgba(46,204,113,0); }
        100% { box-shadow: 0 0 0 0 rgba(46,204,113,0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 1024px) {
        .conf-main { flex-direction: column !important; }
        .conf-guardian-panel { flex: none !important; }
    }
    @media (max-width: 768px) {
        .conf-header { flex-direction: column !important; padding: 15px !important; gap: 12px !important; }
        .conf-main   { padding: 20px !important; gap: 20px !important; }
        .conf-student-panel { padding: 20px !important; }
    }
`;

// ── Shared style tokens ────────────────────────────────────────────────────────
const S = {
    page: {
        width: '100vw', height: '100vh',
        background: '#050b1d', color: '#e0e6ed',
        fontFamily: "'Roboto','Inter',sans-serif",
        display: 'flex', flexDirection: 'column' as const,
        overflowX: 'hidden' as const, boxSizing: 'border-box' as const,
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 40px', background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,215,0,0.2)', zIndex: 10, flexShrink: 0,
    },
    backBtn: {
        background: 'transparent', border: '1px solid #b0914f', color: '#b0914f',
        fontFamily: "'Roboto Mono',monospace", fontSize: '0.85rem',
        padding: '8px 18px', cursor: 'pointer', borderRadius: 4,
        textTransform: 'uppercase' as const, letterSpacing: 1,
        display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s ease',
    },
    titleBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: 14 },
    indicator: {
        width: 6, height: 30, background: '#00e676', borderRadius: 3,
        boxShadow: '0 0 10px rgba(0,230,118,0.5)',
    },
    h1: {
        margin: 0, fontSize: 'clamp(1.1rem,3vw,1.8rem)', color: '#fff',
        fontFamily: "'Roboto Mono',monospace", fontWeight: 900,
        letterSpacing: 1, textTransform: 'uppercase' as const, fontStyle: 'italic' as const,
    },
    liveBadge: {
        background: 'transparent', border: '1px solid #2ecc71', color: '#2ecc71',
        padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700,
        textTransform: 'uppercase' as const, letterSpacing: 1,
        fontFamily: "'Roboto Mono',monospace",
    },
    main: {
        display: 'flex', flex: 1, padding: 40, gap: 40,
        overflowY: 'auto' as const, boxSizing: 'border-box' as const,
    },
    footer: {
        display: 'flex', alignItems: 'center', padding: '10px 40px',
        background: 'rgba(0,0,0,0.6)', borderTop: '1px solid rgba(255,215,0,0.2)',
        fontFamily: "'Roboto Mono',monospace", fontSize: '0.75rem',
        gap: 10, flexShrink: 0, overflow: 'hidden',
    },
    footerDot: { width: 8, height: 8, background: '#2ecc71', borderRadius: '50%', flexShrink: 0 },
    footerTxt: { color: '#8892b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
};

// ── Avatar silhouette ──────────────────────────────────────────────────────────
function AvatarSilhouette() {
    return (
        <div style={{ width: '100%', height: '100%', background: '#334155', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '35%', height: '35%', background: '#94a3b8', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '40%', background: '#94a3b8', borderRadius: '50% 50% 0 0' }} />
        </div>
    );
}

// ── Shared footer ──────────────────────────────────────────────────────────────
function Footer() {
    return (
        <footer style={S.footer}>
            <span style={S.footerDot} className="conf-footer-dot" />
            <div style={S.footerTxt}>
                | SISTEMA ATIVO · Sistema de Retirada Segura — La Salle · Atualização em tempo real via SISRA
            </div>
        </footer>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function TotemConfirmation() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState | null;

    const [step, setStep] = useState<Step>('confirm');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [availableGuardians, setAvailableGuardians] = useState<Guardian[]>([]);
    const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
    const [loadingGuardians, setLoadingGuardians] = useState(false);
    const [countdown, setCountdown] = useState(8);
    const [errorMsg, setErrorMsg] = useState('');

    const students: Student[] = state?.students || [];

    // Pre-select all students and load guardians
    useEffect(() => {
        if (!students.length) return;
        setSelectedIds(new Set(students.map(s => s.id)));
        if (state?.guardian) setSelectedGuardian(state.guardian);
        loadGuardians();
    }, [students, state?.guardian]);

    const loadGuardians = async () => {
        setLoadingGuardians(true);
        try {
            const studentIds = students.map(s => s.id);
            if (studentIds.length > 0) {
                // Fetch from both tables for redundancy
                const [authsRes, junctionRes] = await Promise.all([
                    supabase.from('autorizacoes').select('responsavel_id, responsaveis(id, nome_completo, foto_url)').in('aluno_id', studentIds).eq('ativa', true),
                    supabase.from('alunos_responsaveis').select('responsavel_id, responsaveis(id, nome_completo, foto_url)').in('aluno_id', studentIds)
                ]);

                const guardiansMap = new Map();
                const processResults = (data: any[] | null) => {
                    if (!data) return;
                    data.forEach((a: any) => {
                        const r = Array.isArray(a.responsaveis) ? a.responsaveis[0] : a.responsaveis;
                        if (r && !guardiansMap.has(r.id)) guardiansMap.set(r.id, r);
                    });
                };
                processResults(authsRes.data);
                processResults(junctionRes.data);
                setAvailableGuardians(Array.from(guardiansMap.values()));
            }
        } catch (e) {
            console.error('Error loading guardians:', e);
        } finally {
            setLoadingGuardians(false);
        }
    };

    // Auto-redirect countdown on success
    useEffect(() => {
        if (step !== 'success') return;
        const t = setInterval(() => setCountdown(v => v - 1), 1000);
        return () => clearInterval(t);
    }, [step]);

    useEffect(() => {
        if (countdown <= 0 && step === 'success') navigate('/totem');
    }, [countdown, step, navigate]);

    const handleConfirm = async () => {
        if (selectedIds.size === 0 || !selectedGuardian) return;
        setStep('sending');
        try {
            const requests = Array.from(selectedIds).map(id => {
                const studentExists = students.some(s => s.id === id);
                if (!studentExists) throw new Error('Falha de segurança: Tentativa de retirar aluno não reconhecido.');
                return {
                    escola_id: students[0]?.escola_id || null,
                    aluno_id: id,
                    responsavel_id: selectedGuardian.id,
                    recepcionista_id: null,
                    status: 'SOLICITADO',
                    tipo_solicitacao: 'ROTINA',
                    // Guardian is physically using the on-site totem — mark as arrived immediately
                    status_geofence: 'CHEGOU',
                };
            });

            const { error } = await supabase.from('solicitacoes_retirada').insert(requests);
            if (error) throw error;

            // Log individual audit events for each student requested
            for (const req of requests) {
                const student = students.find(s => s.id === req.aluno_id);
                await logAudit('SOLICITACAO_RETIRADA', 'solicitacoes_retirada', undefined, {
                    aluno_nome: student?.nome_completo,
                    aluno_id: req.aluno_id,
                    responsavel_nome: selectedGuardian.nome_completo,
                    responsavel_id: selectedGuardian.id,
                    tipo: 'TOTEM'
                }, selectedGuardian.id, req.escola_id || undefined);
            }
            setStep('success');
        } catch (e: any) {
            setErrorMsg(e.message || 'Erro desconhecido. Tente novamente ou chame a recepção.');
            setStep('error');
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // ── Empty state ──────────────────────────────────────────────────────────
    if (!state?.students?.length) {
        return (
            <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center' }}>
                <style>{pageStyles}</style>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Nenhum dado recebido.</p>
                    <button onClick={() => navigate('/totem')} style={{ padding: '12px 24px', background: '#00e676', color: '#000', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    // ── Success state ────────────────────────────────────────────────────────
    if (step === 'success') {
        return (
            <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <style>{pageStyles}</style>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '0 24px', position: 'relative', zIndex: 1 }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: -48, background: 'rgba(0,230,118,0.12)', filter: 'blur(48px)', borderRadius: '50%' }} />
                        <div style={{ position: 'relative', width: 140, height: 140, background: '#00e676', borderRadius: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(0,230,118,0.4)' }}>
                            <CheckCircle2 style={{ width: 72, height: 72, color: '#000' }} />
                        </div>
                    </div>
                    <div>
                        <h1 style={{ fontSize: 'clamp(2rem,6vw,3.5rem)', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.03em', margin: '0 0 16px' }}>
                            Tudo <span style={{ color: '#00e676' }}>Pronto!</span>
                        </h1>
                        <p style={{ color: '#8892b0', fontSize: '1.1rem' }}>
                            {selectedGuardian?.nome_completo.split(' ')[0]}, aguarde na recepção. Os alunos já foram notificados!
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {students.filter(s => selectedIds.has(s.id)).map(s => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                                    {s.foto_url ? <img src={s.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon style={{ width: 20, height: 20, color: '#475569' }} /></div>}
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>{s.nome_completo.split(' ')[0]}</p>
                                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#00e676', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>{s.turma}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <div style={{ width: 240, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#00e676', borderRadius: 99, width: `${(countdown / 8) * 100}%`, transition: 'width 1s linear' }} />
                        </div>
                        <p style={{ color: '#8892b0', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Retornando em {countdown}s...</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    // ── Error state ──────────────────────────────────────────────────────────
    if (step === 'error') {
        return (
            <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 48px' }}>
                <style>{pageStyles}</style>
                <div style={{ width: 100, height: 100, background: 'rgba(220,38,38,0.1)', border: '2px solid rgba(220,38,38,0.3)', borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                    <Bell style={{ width: 50, height: 50, color: '#f87171' }} />
                </div>
                <h2 style={{ fontSize: 'clamp(1.8rem,5vw,2.5rem)', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.03em', margin: '0 0 16px' }}>Ocorreu um Erro</h2>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: 24, borderRadius: 24, maxWidth: 480, backdropFilter: 'blur(12px)' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>Detalhes Técnicos</p>
                    <p style={{ color: '#e0e6ed', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>{errorMsg}</p>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={() => setStep('confirm')} style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, color: '#fff', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>Tentar Novamente</button>
                    <button onClick={() => navigate('/totem')} style={{ padding: '14px 28px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 16, color: '#f87171', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>Início</button>
                </div>
            </div>
        );
    }

    // ── Main confirm screen ──────────────────────────────────────────────────
    const canConfirm = selectedIds.size > 0 && !!selectedGuardian && step !== 'sending';

    return (
        <div style={S.page}>
            <style>{pageStyles}</style>

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header style={S.header} className="conf-header">
                <button onClick={() => navigate(-1)} style={S.backBtn} className="conf-back-btn">
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    VOLTAR
                </button>
                <div style={S.titleBar}>
                    <div style={S.indicator} />
                    <h1 style={S.h1}>FINALIZAR CHAMADA</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Clock />
                    <span style={S.liveBadge}>AO VIVO</span>
                </div>
            </header>

            {/* ── Main ───────────────────────────────────────────────────────── */}
            <main style={S.main} className="conf-main">

                {/* Left — Guardian selection */}
                <section style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', gap: 20 }} className="conf-guardian-panel">
                    <div>
                        <h2 style={{ margin: 0, fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', color: '#fff', fontWeight: 900, fontStyle: 'italic', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            QUEM ESTÁ RETIRANDO?
                        </h2>
                        <p style={{ margin: '6px 0 0', color: '#8892b0', fontSize: '0.8rem', fontFamily: "'Roboto Mono',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
                            SELECIONE VOCÊ NA LISTA ABAIXO
                        </p>
                    </div>

                    {loadingGuardians ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#8892b0' }}>
                            <Loader2 style={{ width: 36, height: 36, animation: 'spin 1s linear infinite' }} />
                            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Buscando autorizados...</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 16 }}>
                            {availableGuardians.map(resp => {
                                const sel = selectedGuardian?.id === resp.id;
                                return (
                                    <button
                                        key={resp.id}
                                        onClick={() => setSelectedGuardian(resp)}
                                        className={`conf-guardian-btn${sel ? ' sel' : ''}`}
                                        style={{
                                            background: sel ? 'rgba(0,230,118,0.05)' : 'rgba(10,15,30,0.6)',
                                            border: sel ? '2px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
                                            boxShadow: sel ? '0 0 20px rgba(0,230,118,0.15),inset 0 0 15px rgba(0,230,118,0.1)' : 'none',
                                            borderRadius: 16, padding: '20px 10px',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                            justifyContent: 'center', cursor: 'pointer',
                                            backdropFilter: 'blur(10px)', transition: 'all 0.3s ease', gap: 10,
                                            position: 'relative',
                                        }}
                                    >
                                        {sel && (
                                            <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: '50%', border: '2px solid #00e676', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050b1d' }}>
                                                <CheckMark />
                                            </div>
                                        )}
                                        <div style={{ width: 80, height: 80, borderRadius: 16, background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: sel ? '2px solid #00e676' : '2px solid rgba(255,255,255,0.2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {resp.foto_url
                                                ? <img src={resp.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : <AvatarSilhouette />
                                            }
                                        </div>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.3, color: sel ? '#00e676' : '#e0e6ed' }}>
                                            {resp.nome_completo.split(' ')[0]} {resp.nome_completo.split(' ').slice(-1)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Right — Students + Confirm */}
                <section style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 24, padding: 30, overflow: 'hidden' }} className="conf-student-panel">
                    <div style={{ fontSize: '0.82rem', color: '#8892b0', fontFamily: "'Roboto Mono',monospace", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        ESTUDANTES SELECIONADOS ({selectedIds.size})
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', marginBottom: 20 }} className="conf-list">
                        {students.map(student => {
                            const isSelected = selectedIds.has(student.id);
                            return (
                                <button
                                    key={student.id}
                                    onClick={() => toggleStudent(student.id)}
                                    className="conf-student-btn"
                                    style={{
                                        display: 'flex', alignItems: 'center',
                                        background: isSelected ? 'rgba(10,15,30,0.6)' : 'rgba(10,15,30,0.3)',
                                        border: isSelected ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: 12, padding: '14px 18px', gap: 18,
                                        cursor: 'pointer', textAlign: 'left', width: '100%',
                                        opacity: isSelected ? 1 : 0.5, transition: 'all 0.2s ease',
                                    }}
                                >
                                    <div style={{ width: 52, height: 52, borderRadius: 10, background: '#1e293b', flexShrink: 0, overflow: 'hidden', border: isSelected ? '1px solid #00e676' : '1px solid rgba(255,255,255,0.1)' }}>
                                        {student.foto_url
                                            ? <img src={student.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon style={{ width: 24, height: 24, color: '#475569' }} /></div>
                                        }
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: 0.5, lineHeight: 1.2, margin: 0, color: isSelected ? '#fff' : '#8892b0' }}>
                                            {student.nome_completo}
                                        </p>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#00e676', fontFamily: "'Roboto Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            {student.turma}
                                        </span>
                                    </div>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', border: isSelected ? '2px solid #00e676' : '2px solid rgba(255,255,255,0.1)', background: isSelected ? 'rgba(0,230,118,0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {isSelected && <CheckCircle2 style={{ width: 16, height: 16, color: '#00e676' }} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {!selectedGuardian && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 20px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16, marginBottom: 12 }}>
                                <AlertCircle />
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fbbf24' }}>Identifique-se na lista à esquerda</span>
                            </div>
                        )}
                        <button
                            onClick={handleConfirm}
                            disabled={!canConfirm}
                            className="conf-call-btn"
                            style={{
                                width: '100%', background: '#00e676', color: '#000', border: 'none',
                                borderRadius: 16, padding: '22px 24px',
                                fontSize: 'clamp(1rem,2.5vw,1.4rem)', fontWeight: 900,
                                textTransform: 'uppercase', letterSpacing: '0.15em',
                                cursor: canConfirm ? 'pointer' : 'not-allowed',
                                opacity: canConfirm ? 1 : 0.3,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
                                boxShadow: '0 10px 30px rgba(0,230,118,0.3)', transition: 'all 0.2s ease',
                            }}
                        >
                            {step === 'sending'
                                ? <><Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }} /> Processando...</>
                                : <><Bell style={{ width: 24, height: 24 }} /> Chamar {selectedIds.size} Aluno{selectedIds.size !== 1 ? 's' : ''}</>
                            }
                        </button>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
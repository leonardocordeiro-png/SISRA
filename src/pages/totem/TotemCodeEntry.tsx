import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, AlertCircle, Loader2, User as UserIcon, Settings, Wifi, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';
import TotemNumPad from '../../components/totem/TotemNumPad';
import type { Student } from '../../types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
const PURPLE     = '#a26bf5';
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

export default function TotemCodeEntry() {
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
    const [identifiedGuardian, setIdentifiedGuardian] = useState<any>(null);
    useInactivityTimer({ timeoutMs: 60000, redirectTo: '/totem' });

    // Load initial selection
    useEffect(() => {
        const state = window.history.state?.usr;
        if (state?.selectedStudents) {
            setSelectedStudents(state.selectedStudents);
        }
    }, []);

    const handleSubmit = async () => {
        if (code.length < 4) return;
        setLoading(true);
        setError(null);

        try {
            // Search code case-insensitively to handle any casing stored in DB
            const { data: resp, error: err } = await supabase
                .from('responsaveis')
                .select('id, nome_completo, foto_url, cpf')
                .ilike('codigo_acesso', code.trim())
                .maybeSingle();

            if (err || !resp) {
                setError('Código não encontrado. Verifique e tente novamente.');
                setLoading(false);
                return;
            }

            // Collect all responsavel IDs with same CPF — try both formats (handles duplicate registrations with different CPF formats)
            let responsavelIds: string[] = [resp.id];
            if (resp.cpf) {
                const cleanCpf = resp.cpf.replace(/\D/g, '');
                const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                const { data: samesCpf } = await supabase
                    .from('responsaveis')
                    .select('id')
                    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`);
                if (samesCpf && samesCpf.length > 0) {
                    responsavelIds = [...new Set([resp.id, ...samesCpf.map((r: any) => r.id)])];
                }
            }

            // Step 1: collect aluno_ids from both link tables for ALL responsavel IDs
            const [authsRes, junctionRes] = await Promise.all([
                supabase.from('autorizacoes').select('aluno_id').in('responsavel_id', responsavelIds).eq('ativa', true),
                supabase.from('alunos_responsaveis').select('aluno_id').in('responsavel_id', responsavelIds)
            ]);

            const alunoIds = new Set<string>([
                ...(authsRes.data?.map((a: any) => a.aluno_id) || []),
                ...(junctionRes.data?.map((j: any) => j.aluno_id) || [])
            ]);

            if (alunoIds.size === 0) {
                setError('Nenhum aluno vinculado a este código.');
                setLoading(false);
                return;
            }

            // Step 2: fetch full student records by IDs
            const { data: alunosData } = await supabase
                .from('alunos')
                .select('*')
                .in('id', Array.from(alunoIds));

            const newStudents: Student[] = alunosData || [];

            if (newStudents.length === 0) {
                setError('Nenhum aluno vinculado a este código.');
                setLoading(false);
                return;
            }

            // Merge avoiding duplicates
            const merged = [...selectedStudents];
            newStudents.forEach(ns => {
                if (!merged.some(ms => ms.id === ns.id)) merged.push(ns);
            });

            setSelectedStudents(merged);
            setIdentifiedGuardian(resp);
            setCode('');
            setLoading(false);
        } catch {
            setError('Erro de comunicação. Tente novamente.');
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (selectedStudents.length === 0) return;
        navigate('/totem/confirmacao', {
            state: {
                students: selectedStudents,
                mode: 'code',
                guardian: identifiedGuardian
            }
        });
    };

    const codeChars = code.toUpperCase().padEnd(8, '·').split('');

    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: '#070a13',
            color: '#fff',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            position: 'relative',
        }}>
            {/* Scoped styles */}
            <style>{`
                .tce-bg {
                    background-image:
                        radial-gradient(circle at 10% 10%, #1a2540 0%, transparent 40%),
                        radial-gradient(circle at 90% 90%, #0d121f 0%, transparent 40%),
                        repeating-linear-gradient(
                            rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px,
                            transparent 1px, transparent 15px
                        );
                    background-size: 100% 100%, 100% 100%, 15px 15px;
                }
                .tce-back-btn {
                    display: flex; align-items: center; gap: 10px;
                    padding: 10px 18px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px; cursor: pointer;
                    color: ${TEXT_MUTED}; font-size: 13px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 1px;
                    transition: all 0.2s ease; font-family: inherit;
                }
                .tce-back-btn:hover { background: rgba(162,107,245,0.08); color: #fff; }
                .tce-submit-btn {
                    width: 100%; padding: 14px;
                    background: linear-gradient(135deg, ${PURPLE} 0%, rgba(18,30,60,0.9) 100%);
                    border: none; border-radius: 24px; cursor: pointer;
                    color: #fff; font-size: 13px; font-weight: 800;
                    text-transform: uppercase; letter-spacing: 2px;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    box-shadow: 0 4px 20px rgba(162,107,245,0.3);
                    transition: all 0.2s ease; font-family: inherit;
                }
                .tce-submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-2px); }
                .tce-submit-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
                .tce-next-btn {
                    width: 100%; padding: 14px;
                    background: linear-gradient(135deg, ${CYAN} 0%, rgba(18,30,60,0.9) 100%);
                    border: none; border-radius: 24px; cursor: pointer;
                    color: #07111e; font-size: 13px; font-weight: 800;
                    text-transform: uppercase; letter-spacing: 2px;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    box-shadow: 0 4px 20px rgba(71,184,255,0.25);
                    transition: all 0.2s ease; font-family: inherit;
                }
                .tce-next-btn:hover { opacity: 0.9; }
                .tce-student-card {
                    display: flex; align-items: center; gap: 16px;
                    padding: 14px 18px; border-radius: 12px;
                    background: rgba(162,107,245,0.08);
                    border: 1px solid rgba(162,107,245,0.25);
                    min-width: 240px;
                }
                .tce-remove-btn {
                    width: 28px; height: 28px; border-radius: 50%;
                    background: rgba(239,68,68,0.15); border: none; cursor: pointer;
                    color: #f87171; font-size: 18px; font-weight: 900;
                    display: grid; place-items: center; flex-shrink: 0;
                    transition: background 0.2s ease; font-family: inherit;
                }
                .tce-remove-btn:hover { background: rgba(239,68,68,0.3); }
                @media (max-width: 768px) {
                    .tce-main { flex-direction: column !important; }
                    .tce-left { width: 100% !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
                }
            `}</style>

            {/* Background */}
            <div className="tce-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <header style={{
                position: 'relative', zIndex: 2,
                padding: '14px 28px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 16,
            }}>
                {/* Left: back + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <button
                        className="tce-back-btn"
                        onClick={() => navigate('/totem/identificar')}
                    >
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        Voltar
                    </button>

                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: 18 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>
                            Acesso Seguro — Totem
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 4, height: 22, borderRadius: 2,
                                background: PURPLE,
                                boxShadow: `0 0 8px rgba(162,107,245,0.6)`,
                            }} />
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Código de Acesso
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 500, marginTop: 2 }}>
                            Insira os códigos para retirar os alunos
                        </div>
                    </div>
                </div>

                {/* Right: students badge */}
                {selectedStudents.length > 0 && (
                    <GlassPanel outerStyle={{ boxShadow: `0 4px 16px rgba(162,107,245,0.25)` }}>
                        <div style={{
                            padding: '8px 18px',
                            fontSize: 12, fontWeight: 800,
                            color: PURPLE, textTransform: 'uppercase', letterSpacing: 1,
                        }}>
                            {selectedStudents.length} aluno{selectedStudents.length > 1 ? 's' : ''}
                        </div>
                    </GlassPanel>
                )}
            </header>

            {/* ── MAIN ────────────────────────────────────────────────────────── */}
            <div
                className="tce-main"
                style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', overflow: 'hidden' }}
            >
                {/* LEFT: icon + code display + actions */}
                <form
                    className="tce-left"
                    style={{
                        display: 'flex', flexDirection: 'column',
                        width: 350, flexShrink: 0,
                        padding: '24px 24px',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        gap: 24, justifyContent: 'center', alignItems: 'center',
                        textAlign: 'center',
                    }}
                    autoComplete="off"
                    onSubmit={e => e.preventDefault()}
                >
                    {/* Icon */}
                    <div style={{
                        width: 88, height: 88, borderRadius: 24,
                        background: 'radial-gradient(circle, rgba(22,28,44,0.2), rgba(10,15,31,0.85))',
                        display: 'grid', placeItems: 'center',
                        border: `1.5px solid rgba(162,107,245,0.4)`,
                        boxShadow: `0 0 32px rgba(162,107,245,0.22), inset 0 0 10px rgba(0,0,0,0.2)`,
                        position: 'relative',
                    }}>
                        <Hash style={{ width: 40, height: 40, color: PURPLE, filter: `drop-shadow(0 0 10px rgba(162,107,245,0.5))` }} />
                    </div>

                    {/* Title + description */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: PURPLE, textTransform: 'uppercase', letterSpacing: 1, margin: 0, textShadow: '0 0 12px rgba(162,107,245,0.5)' }}>
                            Digite seu código
                        </h2>
                        <p style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.7, margin: 0 }}>
                            Seu código único é encontrado no cartão QR impresso que foi gerado no aplicativo.
                            Ele é composto por letras e números.
                        </p>
                    </div>

                    {/* Code input cards */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        {codeChars.map((char, i) => (
                            <div
                                key={i}
                                style={{
                                    width: 38, height: 48, borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 20, fontWeight: 900,
                                    transition: 'all 0.2s ease',
                                    background: i < code.length
                                        ? 'rgba(162,107,245,0.15)'
                                        : 'rgba(10,15,31,0.8)',
                                    border: i < code.length
                                        ? `1.5px solid ${PURPLE}`
                                        : '1px solid rgba(255,255,255,0.08)',
                                    color: i < code.length ? '#fff' : 'rgba(255,255,255,0.15)',
                                    boxShadow: i < code.length
                                        ? `0 0 12px rgba(162,107,245,0.3), inset 0 0 8px rgba(0,0,0,0.2)`
                                        : `inset 0 0 8px rgba(0,0,0,0.2)`,
                                }}
                            >
                                {char}
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '12px 16px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            borderRadius: 12,
                            color: '#f87171', width: '100%',
                        }}>
                            <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
                            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                        <button
                            className="tce-submit-btn"
                            onClick={handleSubmit}
                            disabled={code.length < 4 || loading}
                        >
                            {loading
                                ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                                : 'Adicionar Aluno +'
                            }
                        </button>

                        {selectedStudents.length > 0 && (
                            <button className="tce-next-btn" onClick={handleNext}>
                                Finalizar ({selectedStudents.length})
                                <ChevronRight style={{ width: 16, height: 16 }} />
                            </button>
                        )}
                    </div>
                </form>

                {/* RIGHT: selected cards + keyboard */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '20px 24px', gap: 20, overflowY: 'auto',
                }}>
                    {/* Selected students */}
                    {selectedStudents.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: 640 }}>
                            {selectedStudents.map(s => (
                                <div key={s.id} className="tce-student-card">
                                    {/* Avatar */}
                                    <div style={{
                                        width: 64, height: 64, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                                        border: '2px solid rgba(162,107,245,0.35)',
                                    }}>
                                        {s.foto_url
                                            ? <img src={s.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>
                                                <UserIcon style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.2)' }} />
                                              </div>
                                        }
                                    </div>
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: 'block', fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#fff', letterSpacing: 0.5, lineHeight: 1.3 }}>
                                            {s.nome_completo}
                                        </span>
                                        {s.turma && (
                                            <span style={{ fontSize: 11, fontWeight: 700, color: `${PURPLE}99`, textTransform: 'uppercase', letterSpacing: 2 }}>
                                                {s.turma}
                                            </span>
                                        )}
                                    </div>
                                    {/* Remove */}
                                    <button
                                        className="tce-remove-btn"
                                        onClick={() => setSelectedStudents(prev => prev.filter(st => st.id !== s.id))}
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Keyboard label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 560, justifyContent: 'center' }}>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(162,107,245,0.2))' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 2.5 }}>
                            Teclado Alfanumérico
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(162,107,245,0.2))' }} />
                    </div>

                    <TotemNumPad
                        value={code}
                        onChange={v => { setCode(v); setError(null); }}
                        onSubmit={handleSubmit}
                        maxLength={8}
                    />
                </div>
            </div>

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
            <footer style={{
                position: 'relative', zIndex: 2,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 28px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                fontSize: 11, color: TEXT_MUTED,
                textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Settings style={{ width: 13, height: 13, color: GOLD }} />
                    <span>Tela do Totem — SISRA</span>
                </div>
                <span style={{ color: `${TEXT_MUTED}70`, fontSize: 10 }}>
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

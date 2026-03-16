import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User as UserIcon, Search as SearchIcon, ChevronRight, Loader2, Settings, Wifi } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';
import TotemNumericPad from '../../components/totem/TotemNumericPad';
import type { Student } from '../../types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
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

export default function TotemSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
    const [identifiedGuardian, setIdentifiedGuardian] = useState<any>(null);
    useInactivityTimer({ timeoutMs: 60000, redirectTo: '/totem' });

    // Load initial selection if returning from confirmation
    useEffect(() => {
        const state = window.history.state?.usr;
        if (state?.selectedStudents) {
            setSelectedStudents(state.selectedStudents);
        }
    }, []);

    // Search with debounce
    useEffect(() => {
        const trimmedQuery = query.trim();
        const cleanCpf = trimmedQuery.replace(/\D/g, '');

        // Security: only search by full CPF (11 digits)
        if (cleanCpf.length !== 11) { setResults([]); return; }

        const t = setTimeout(async () => {
            setLoading(true);
            try {
                let allResults: Student[] = [];

                // Search by Guardian CPF — strictly using normalized numeric CPF
                const { data: guardians } = await supabase
                    .from('responsaveis')
                    .select('*')
                    .eq('cpf', cleanCpf);

                if (guardians && guardians.length > 0) {
                    const guardianIds = guardians.map((g: any) => g.id);

                    // Query both link tables for redundancy across ALL guardian IDs
                    const [authsRes, junctionRes] = await Promise.all([
                        supabase.from('autorizacoes').select('aluno_id').in('responsavel_id', guardianIds).eq('ativa', true),
                        supabase.from('alunos_responsaveis').select('aluno_id').in('responsavel_id', guardianIds)
                    ]);

                    const studentIds = new Set([
                        ...(authsRes.data?.map((a: any) => a.aluno_id) || []),
                        ...(junctionRes.data?.map((j: any) => j.aluno_id) || [])
                    ]);

                    if (studentIds.size > 0) {
                        const { data: cpfStudents } = await supabase
                            .from('alunos')
                            .select('*')
                            .in('id', Array.from(studentIds));

                        if (cpfStudents) {
                            allResults = cpfStudents;
                            // Auto-select all students found by CPF
                            setSelectedStudents(cpfStudents);
                            setIdentifiedGuardian(guardians[0]);
                        }
                    }
                } else {
                    setIdentifiedGuardian(null);
                }

                setResults(allResults);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const toggleStudent = (student: Student) => {
        if (selectedStudents.find(s => s.id === student.id)) {
            setSelectedStudents(prev => prev.filter(s => s.id !== student.id));
        } else {
            setSelectedStudents(prev => [...prev, student]);
        }
    };

    const handleNext = () => {
        if (selectedStudents.length === 0) return;
        navigate('/totem/confirmacao', {
            state: {
                students: selectedStudents,
                mode: 'search',
                guardian: identifiedGuardian
            }
        });
    };

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
                .ts-bg {
                    background-image:
                        radial-gradient(circle at 10% 10%, #1a2540 0%, transparent 40%),
                        radial-gradient(circle at 90% 90%, #0d121f 0%, transparent 40%),
                        repeating-linear-gradient(
                            rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px,
                            transparent 1px, transparent 15px
                        );
                    background-size: 100% 100%, 100% 100%, 15px 15px;
                }
                .ts-back-btn {
                    display: flex; align-items: center; gap: 10px;
                    padding: 10px 18px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px; cursor: pointer;
                    color: ${TEXT_MUTED}; font-size: 13px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 1px;
                    transition: all 0.2s ease; font-family: inherit;
                }
                .ts-back-btn:hover { background: rgba(71,184,255,0.08); color: #fff; }
                .ts-student-card {
                    width: 100%; display: flex; align-items: center; gap: 16px;
                    padding: 16px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.07);
                    background: rgba(17,24,43,0.5); cursor: pointer;
                    transition: all 0.2s ease; text-align: left; font-family: inherit;
                }
                .ts-student-card:hover { background: rgba(71,184,255,0.06); border-color: rgba(71,184,255,0.25); }
                .ts-student-card.selected { background: rgba(71,184,255,0.1); border-color: rgba(71,184,255,0.5); }
                .ts-action-btn {
                    display: flex; align-items: center; gap: 14px;
                    padding: 20px 36px; border-radius: 16px; cursor: pointer;
                    font-size: 18px; font-weight: 800; text-transform: uppercase;
                    letter-spacing: 2px; border: none; font-family: inherit;
                    background: ${CYAN}; color: #07111e;
                    box-shadow: 0 12px 40px rgba(71,184,255,0.35);
                    transition: all 0.2s ease;
                }
                .ts-action-btn:hover { background: #6dcaff; }
                .ts-action-btn:active { transform: scale(0.97); }
                @media (max-width: 768px) {
                    .ts-main { flex-direction: column !important; }
                    .ts-left { width: 100% !important; min-width: unset !important; border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
                }
            `}</style>

            {/* Background */}
            <div className="ts-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

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
                        className="ts-back-btn"
                        onClick={() => navigate('/totem/identificar')}
                    >
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        Voltar
                    </button>

                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: 18 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>
                            A La Salle, Cheguei! — Totem
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 4, height: 22, borderRadius: 2,
                                background: CYAN,
                                boxShadow: `0 0 8px rgba(71,184,255,0.6)`,
                            }} />
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Buscar Estudantes
                            </span>
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 500, marginTop: 2 }}>
                            Digite o CPF do responsável para localizar os alunos
                        </div>
                    </div>
                </div>

                {/* Right: selected badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {selectedStudents.length > 0 && (
                        <GlassPanel outerStyle={{ boxShadow: `0 4px 16px rgba(71,184,255,0.25)` }}>
                            <div style={{
                                padding: '8px 18px',
                                fontSize: 12, fontWeight: 800,
                                color: CYAN, textTransform: 'uppercase', letterSpacing: 1,
                            }}>
                                {selectedStudents.length} selecionado{selectedStudents.length > 1 ? 's' : ''}
                            </div>
                        </GlassPanel>
                    )}
                </div>
            </header>

            {/* ── MAIN: LEFT keyboard | RIGHT results ─────────────────────────── */}
            <div
                className="ts-main"
                style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', overflow: 'hidden' }}
            >
                {/* LEFT: input display + keypad */}
                <form
                    className="ts-left"
                    style={{
                        display: 'flex', flexDirection: 'column',
                        width: '45%', minWidth: 400, flexShrink: 0,
                        padding: '20px 24px',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        gap: 16,
                    }}
                    autoComplete="off"
                    onSubmit={e => e.preventDefault()}
                >
                    {/* CPF Display */}
                    <GlassPanel outerStyle={{ boxShadow: `0 4px 20px rgba(71,184,255,0.12)` }}>
                        <div style={{
                            padding: '18px 24px',
                            display: 'flex', alignItems: 'center', gap: 14,
                            minHeight: 72,
                        }}>
                            <SearchIcon style={{ width: 24, height: 24, color: CYAN, flexShrink: 0, filter: `drop-shadow(0 0 6px rgba(71,184,255,0.5))` }} />
                            <span style={{
                                fontSize: 18, fontWeight: 800, color: query ? '#fff' : `${TEXT_MUTED}60`,
                                flex: 1, letterSpacing: 1,
                            }}>
                                {query || 'Digite os 11 números do CPF...'}
                            </span>
                            {loading && <Loader2 style={{ width: 22, height: 22, color: CYAN, flexShrink: 0 }} className="animate-spin" />}
                        </div>
                    </GlassPanel>

                    {/* Numeric keypad */}
                    <TotemNumericPad
                        value={query}
                        onChange={setQuery}
                        maxLength={11}
                    />
                </form>

                {/* RIGHT: results */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    padding: '20px 24px',
                    gap: 12,
                    overflowY: 'auto',
                    paddingBottom: 120,
                }}>
                    {/* Empty state */}
                    {results.length === 0 && query.trim().length < 2 && selectedStudents.length === 0 && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
                            <div style={{
                                width: 88, height: 88, borderRadius: 24,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'grid', placeItems: 'center',
                            }}>
                                <UserIcon style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.12)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: 17, fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', fontStyle: 'italic' }}>
                                    Digite para buscar
                                </p>
                                <p style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 }}>
                                    Insira os 11 dígitos do CPF
                                </p>
                            </div>
                        </div>
                    )}

                    {/* No results */}
                    {results.length === 0 && query.trim().length >= 2 && !loading && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <p style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', fontStyle: 'italic' }}>
                                Nenhum aluno encontrado
                            </p>
                        </div>
                    )}

                    {/* Student cards */}
                    {results.map(student => {
                        const isSelected = selectedStudents.some(s => s.id === student.id);
                        return (
                            <button
                                key={student.id}
                                className={`ts-student-card${isSelected ? ' selected' : ''}`}
                                onClick={() => toggleStudent(student)}
                            >
                                {/* Avatar */}
                                <div style={{
                                    width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                                    border: `2px solid ${isSelected ? CYAN : 'rgba(255,255,255,0.1)'}`,
                                    transition: 'border-color 0.2s ease',
                                }}>
                                    {student.foto_url
                                        ? <img src={student.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>
                                            <UserIcon style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.2)' }} />
                                          </div>
                                    }
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase', fontStyle: 'italic', color: isSelected ? CYAN : '#fff', transition: 'color 0.2s ease' }}>
                                        {student.nome_completo}
                                    </p>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: `${CYAN}99`, textTransform: 'uppercase', letterSpacing: 2 }}>
                                        {student.turma}
                                    </span>
                                </div>

                                {/* Check circle */}
                                <div style={{
                                    width: 30, height: 30, borderRadius: '50%',
                                    border: `2px solid ${isSelected ? CYAN : 'rgba(255,255,255,0.1)'}`,
                                    background: isSelected ? CYAN : 'transparent',
                                    display: 'grid', placeItems: 'center',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isSelected ? `0 0 10px rgba(71,184,255,0.5)` : 'none',
                                    flexShrink: 0,
                                }}>
                                    {isSelected && <ChevronRight style={{ width: 16, height: 16, color: '#07111e' }} />}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Fixed Action Button */}
                {selectedStudents.length > 0 && (
                    <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 50 }}>
                        <button className="ts-action-btn" onClick={handleNext}>
                            <SearchIcon style={{ width: 22, height: 22 }} />
                            CHAMAR AGORA ({selectedStudents.length})
                            <ChevronRight style={{ width: 22, height: 22 }} />
                        </button>
                    </div>
                )}
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

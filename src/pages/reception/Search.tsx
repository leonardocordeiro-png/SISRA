import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../context/AuthContext';
import NavigationControls from '../../components/NavigationControls';
import WithdrawalQueue from '../../components/reception/WithdrawalQueue';
import QRScannerModal from '../../components/reception/QRScannerModal';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import type { Student, Guardian } from '../../types';
import {
    Search as SearchIcon,
    QrCode,
    CheckCircle2,
    LogOut,
    AlertCircle,
    Hash,
    X,
    Bell,
    User as UserIcon,
    Activity,
    ChevronRight,
    Users,
    Maximize2,
    Plus,
    PenLine,
    UserX,
    School,
} from 'lucide-react';

// ── Brand tokens (same as sala/dashboard & admin/dashboard) ──────────────────
const B = {
    navy:       '#104699',
    navyDark:   '#0a2f6b',
    navyDeep:   '#071830',
    gold:       '#fbd12d',
    goldDark:   '#e8be1a',
    red:        '#E40123',
    gray:       '#A7A7A2',
    grayLight:  '#c8c8c4',
    white:      '#FFFFFF',
    card:       '#0d2a54',
    cardBorder: 'rgba(251,209,45,0.10)',
    onGold:     '#071830',
    textSub:    'rgba(167,167,162,0.9)',
    green:      '#22C55E',
};

// ─── Code Entry Modal (brand colors) ─────────────────────────────────────────

function CodeModal({ onConfirm, onClose }: {
    onConfirm: (code: string) => void;
    onClose: () => void;
}) {
    const [code, setCode] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (code.trim().length >= 4) onConfirm(code.trim().toUpperCase());
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,24,48,0.85)', backdropFilter: 'blur(8px)', padding: 16 }}>
            <div style={{ background: B.card, borderRadius: 20, width: '100%', maxWidth: 380, overflow: 'hidden', border: `1px solid ${B.cardBorder}`, boxShadow: `0 30px 80px rgba(7,24,48,0.9)` }}>
                {/* Header */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${B.gold}, ${B.goldDark}, ${B.gold})` }} />
                <div style={{ background: B.navy, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${B.gold}22`, border: `1px solid ${B.gold}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Hash size={15} style={{ color: B.gold }} />
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 800, color: B.white, fontFamily: 'Epilogue, sans-serif' }}>Código de Acesso</p>
                            <p style={{ fontSize: 9, fontWeight: 600, color: `${B.gold}70`, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Exclusivo por responsável</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.06)', color: B.gray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={14} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '22px 22px 22px' }}>
                    <p style={{ fontSize: 12, color: B.textSub, textAlign: 'center', lineHeight: 1.65, marginBottom: 18 }}>
                        Digite o código único do responsável.<br />Este código consta no cartão QR impresso.
                    </p>
                    <input
                        ref={inputRef}
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                        placeholder="Ex: ABC123"
                        maxLength={8}
                        style={{
                            width: '100%', padding: '14px', background: 'rgba(0,0,0,0.3)',
                            border: `2px solid ${code ? B.gold + '60' : B.cardBorder}`,
                            borderRadius: 11, fontSize: 26, fontWeight: 900, color: B.white,
                            textAlign: 'center', letterSpacing: '0.4em', outline: 'none',
                            fontFamily: 'Epilogue, sans-serif', boxSizing: 'border-box',
                            transition: 'border-color 0.18s',
                        }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                        <button type="button" onClick={onClose} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${B.cardBorder}`, borderRadius: 10, color: B.gray, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Instrument Sans, sans-serif' }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={code.length < 4} style={{ padding: '12px', background: code.length >= 4 ? B.gold : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, color: code.length >= 4 ? B.onGold : B.gray, fontWeight: 800, fontSize: 12, cursor: code.length >= 4 ? 'pointer' : 'not-allowed', fontFamily: 'Epilogue, sans-serif', transition: 'all 0.18s' }}>
                            Verificar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReceptionSearch() {
    const toast = useToast();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [addMoreQuery, setAddMoreQuery] = useState('');
    const [addMoreResults, setAddMoreResults] = useState<Student[]>([]);
    const [results, setResults] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [relatedStudents, setRelatedStudents] = useState<Student[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [multiStudents, setMultiStudents] = useState<Student[]>([]);  // extra students in manual mode
    const [isAddingMore, setIsAddingMore] = useState(false);             // show "add more" search box
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
    const [useManualPickup, setUseManualPickup] = useState(false);       // no-guardian mode
    const [manualPickupName, setManualPickupName] = useState('');        // name typed manually
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const addMoreInputRef = useRef<HTMLInputElement>(null);

    // Font injection
    useEffect(() => {
        if (!document.getElementById('rec-brand-fonts')) {
            const link = document.createElement('link');
            link.id = 'rec-brand-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,700;0,800;0,900;1,700;1,800&family=Instrument+Sans:wght@400;500;600;700&display=swap';
            document.head.appendChild(link);
        }
        setTimeout(() => setMounted(true), 80);
    }, []);

    // Fetch user profile
    useEffect(() => {
        if (user) {
            supabase.from('usuarios').select('*').eq('id', user.id).single()
                .then(({ data }) => { if (data) setUserProfile(data); });
        }
    }, [user]);

    // Primary search
    useEffect(() => {
        const searchStudents = async () => {
            const cleanQuery = query.replace(/\D/g, '');
            const isCpfLookup = cleanQuery.length === 11;

            if (query.length < 3 && !isCpfLookup) { setResults([]); return; }
            setLoading(true);

            try {
                if (isCpfLookup) {
                    const { data: guardians } = await supabase
                        .from('responsaveis')
                        .select('id, nome_completo, foto_url')
                        .eq('cpf', cleanQuery);

                    if (guardians && guardians.length > 0) {
                        const guardianIds = guardians.map((g: any) => g.id);
                        await resolveByMultipleIds(guardianIds, guardians[0].nome_completo, guardians[0]);
                        setLoading(false);
                        return;
                    }
                }

                const safeQuery = query.trim().replace(/[%_\\]/g, '\\$&').slice(0, 100);
                const { data: directStudents } = await supabase
                    .from('alunos').select('*').ilike('nome_completo', `%${safeQuery}%`).limit(5);

                const { data: auths } = await supabase
                    .from('autorizacoes')
                    .select('alunos:aluno_id (*)')
                    .or(`nome_completo.ilike.%${safeQuery}%,cpf.ilike.%${safeQuery}%`, { foreignTable: 'responsaveis' })
                    .eq('ativa', true).limit(10);

                let combined: Student[] = directStudents || [];
                auths?.forEach((a: any) => {
                    const student = Array.isArray(a.alunos) ? a.alunos[0] : a.alunos;
                    if (student && !combined.some(s => s.id === student.id)) combined.push(student);
                });
                setResults(combined.slice(0, 8));
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setLoading(false);
            }
        };

        const t = setTimeout(searchStudents, 300);
        return () => clearTimeout(t);
    }, [query]);

    // "Add more" search (for multi-student in manual mode)
    useEffect(() => {
        if (addMoreQuery.length < 2) { setAddMoreResults([]); return; }
        const safeQ = addMoreQuery.trim().replace(/[%_\\]/g, '\\$&').slice(0, 100);
        const t = setTimeout(async () => {
            const { data } = await supabase.from('alunos').select('*').ilike('nome_completo', `%${safeQ}%`).limit(6);
            if (data) {
                const excluded = new Set([selectedStudent?.id, ...multiStudents.map(s => s.id)].filter(Boolean));
                setAddMoreResults(data.filter((s: Student) => !excluded.has(s.id)));
            }
        }, 250);
        return () => clearTimeout(t);
    }, [addMoreQuery, selectedStudent, multiStudents]);

    // Focus "add more" input when shown
    useEffect(() => {
        if (isAddingMore) setTimeout(() => addMoreInputRef.current?.focus(), 80);
    }, [isAddingMore]);

    // Fetch guardians when student selected (manual mode)
    useEffect(() => {
        if (!selectedStudent || relatedStudents.length > 0) {
            if (!selectedStudent) setGuardians([]);
            return;
        }

        supabase
            .from('autorizacoes')
            .select(`tipo_autorizacao, parentesco, responsaveis(id, nome_completo, foto_url, codigo_acesso)`)
            .eq('aluno_id', selectedStudent.id)
            .eq('ativa', true)
            .then(({ data, error }) => {
                if (!error && data) {
                    setGuardians(data.map((item: { responsaveis: any; parentesco: string | null; tipo_autorizacao: string }) => ({
                        ...item.responsaveis,
                        parentesco: item.parentesco || item.tipo_autorizacao
                    })));
                }
            });
    }, [selectedStudent, relatedStudents]);

    const handleCallStudents = async () => {
        const isRelatedMode = relatedStudents.length > 0;

        // Build student list for the call
        const allStudents: Student[] = isRelatedMode
            ? relatedStudents.filter(s => selectedStudentIds.has(s.id))
            : [selectedStudent, ...multiStudents].filter(Boolean) as Student[];

        const studentIds = allStudents.map(s => s.id);

        if (studentIds.length === 0 || !user) return;

        setSending(true);
        try {
            // ── Step 1: check for already-open requests (prevents unique constraint failure) ──
            const { data: existing, error: checkError } = await supabase
                .from('solicitacoes_retirada')
                .select('aluno_id, status')
                .in('aluno_id', studentIds)
                .not('status', 'in', '(ENTREGUE,CANCELADO)');

            if (checkError) {
                console.warn('Pre-check warning (non-fatal):', checkError.message);
                // Non-fatal — proceed; DB will reject duplicates if any
            } else if (existing && existing.length > 0) {
                const activeIds = new Set(existing.map((r: any) => r.aluno_id));
                const dupNames = allStudents
                    .filter(s => activeIds.has(s.id))
                    .map(s => s.nome_completo.split(' ')[0]);
                toast.error(
                    'Solicitação já ativa',
                    `${dupNames.join(', ')} já possui${dupNames.length > 1 ? 'm' : ''} uma solicitação em aberto. Aguarde a conclusão.`
                );
                return;
            }

            // ── Step 2: build request payload ──
            const requests = allStudents.map(student => {
                const escolaId = student.escola_id || userProfile?.escola_id || null;
                const req: any = {
                    escola_id: escolaId,
                    aluno_id: student.id,
                    responsavel_id: selectedGuardianId || null,
                    recepcionista_id: user.id,
                    status: 'SOLICITADO',
                    tipo_solicitacao: 'RECEPCAO',
                    status_geofence: 'CHEGOU',
                };
                if (useManualPickup && manualPickupName.trim()) {
                    req.mensagem_recepcao = `Retirada avulsa — ${manualPickupName.trim()}`;
                }
                return req;
            });

            // ── Step 3: insert ──
            const { error } = await supabase.from('solicitacoes_retirada').insert(requests);
            if (error) throw error;

            // ── Step 4: audit log ──
            const selectedGuardianLocal = guardians.find(g => g.id === selectedGuardianId);
            const guardianName = useManualPickup && manualPickupName.trim()
                ? `[Avulso] ${manualPickupName.trim()}`
                : selectedGuardianLocal?.nome_completo;

            for (const student of allStudents) {
                await logAudit('SOLICITACAO_RETIRADA', 'solicitacoes_retirada', undefined, {
                    aluno_nome: student.nome_completo,
                    aluno_id: student.id,
                    responsavel_nome: guardianName,
                    responsavel_id: selectedGuardianId,
                    tipo: useManualPickup ? 'RECEPCAO_AVULSA' : 'RECEPCAO'
                }, undefined, student.escola_id || userProfile?.escola_id || undefined);
            }

            toast.success(
                studentIds.length === 1 ? 'Aluno chamado!' : `${studentIds.length} alunos chamados!`,
                guardianName ? `Responsável: ${guardianName}` : 'Notificação enviada às salas.'
            );

            // ── Step 5: reset all state ──
            resetAll();
        } catch (error: any) {
            console.error('Error calling students:', error);
            const detail = error?.message || error?.details || error?.hint || 'Verifique o console para detalhes.';
            toast.error('Erro ao chamar alunos', detail);
        } finally {
            setSending(false);
        }
    };

    const resetAll = () => {
        setQuery(''); setSelectedStudent(null); setRelatedStudents([]);
        setSelectedStudentIds(new Set()); setResults([]); setSelectedGuardianId(null);
        setGuardians([]); setMultiStudents([]); setIsAddingMore(false);
        setAddMoreQuery(''); setAddMoreResults([]);
        setUseManualPickup(false); setManualPickupName('');
    };

    const handleLogout = async () => { await signOut(); navigate('/login'); };

    const handleQRScan = async (qrData: string) => {
        setIsScannerOpen(false);
        setLoading(true);
        try {
            let responsavelId = '';
            const { data: cardData } = await supabase
                .from('parent_qr_cards').select('responsavel_id')
                .eq('qr_code', qrData).eq('active', true).maybeSingle();

            if (cardData?.responsavel_id) {
                responsavelId = cardData.responsavel_id;
            } else if (qrData.startsWith('LaSalleCheguei-')) {
                const parts = qrData.split('-');
                const uuidCandidate = parts.slice(1, -1).join('-');
                if (uuidCandidate.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
                    responsavelId = uuidCandidate;
            }
            if (!responsavelId && qrData.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
                responsavelId = qrData;
            if (!responsavelId) throw new Error('QR Code não reconhecido.');

            await resolveByResponsavelId(responsavelId);
        } catch (err: any) {
            toast.error('Erro no QR Code', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeLookup = async (code: string) => {
        setIsCodeModalOpen(false);
        setLoading(true);
        try {
            const { data: resp, error } = await supabase
                .from('responsaveis').select('id, nome_completo')
                .eq('codigo_acesso', code.toUpperCase()).maybeSingle();

            if (error || !resp) throw new Error('Código não encontrado. Verifique e tente novamente.');
            await resolveByResponsavelId(resp.id, resp.nome_completo);
        } catch (err: any) {
            toast.error('Código inválido', err.message);
        } finally {
            setLoading(false);
        }
    };

    const resolveByMultipleIds = async (responsavelIds: string[], guardianName?: string, primaryGuardian?: any) => {
        // Reset any previous manual-search state before loading QR/Code result
        setSelectedStudent(null); setMultiStudents([]);
        setIsAddingMore(false); setAddMoreQuery(''); setAddMoreResults([]);
        setUseManualPickup(false); setManualPickupName('');

        // Query both link tables; gracefully handle if alunos_responsaveis doesn't exist
        const [authsRes, junctionRes] = await Promise.all([
            supabase.from('autorizacoes').select('aluno_id').in('responsavel_id', responsavelIds).eq('ativa', true),
            supabase.from('alunos_responsaveis').select('aluno_id').in('responsavel_id', responsavelIds),
        ]);

        const alunoIds = new Set<string>([
            ...(authsRes.data?.map((a: any) => a.aluno_id) || []),
            // Only use junction result if query succeeded (table may not exist in all deployments)
            ...(!junctionRes.error ? (junctionRes.data?.map((j: any) => j.aluno_id) || []) : []),
        ]);

        if (alunoIds.size === 0) throw new Error('Nenhum aluno vinculado a este responsável.');

        const { data: alunosData, error: alunosError } = await supabase
            .from('alunos').select('*').in('id', Array.from(alunoIds));

        if (alunosError) throw new Error(`Erro ao buscar alunos: ${alunosError.message}`);
        if (!alunosData || alunosData.length === 0) throw new Error('Nenhum aluno encontrado para este responsável.');

        let guard = primaryGuardian;
        if (!guard) {
            const { data } = await supabase
                .from('responsaveis').select('id, nome_completo, foto_url').eq('id', responsavelIds[0]).single();
            guard = data;
        }

        if (guard) {
            setGuardians([{ id: guard.id, nome_completo: guard.nome_completo, foto_url: guard.foto_url, parentesco: 'Responsável' }]);
            setSelectedGuardianId(guard.id);
        }
        setRelatedStudents(alunosData);
        setSelectedStudentIds(new Set(alunosData.map((s: Student) => s.id)));
        setResults([]); setQuery('');

        toast.success('Responsável identificado', guardianName || guard?.nome_completo || 'Responsável encontrado');
    };

    const resolveByResponsavelId = async (responsavelId: string, guardianName?: string) => {
        const { data: guardian, error: gError } = await supabase
            .from('responsaveis').select('id, cpf, nome_completo, foto_url').eq('id', responsavelId).single();

        if (gError || !guardian) throw new Error('Responsável não encontrado no sistema.');

        let responsavelIds = [responsavelId];
        if (guardian.cpf) {
            const cleanCpf = guardian.cpf.replace(/\D/g, '');
            if (cleanCpf.length >= 11) {
                const { data: sames } = await supabase.from('responsaveis').select('id').eq('cpf', cleanCpf);
                if (sames && sames.length > 0)
                    responsavelIds = [...new Set([responsavelId, ...sames.map((s: any) => s.id)])];
            }
        }
        await resolveByMultipleIds(responsavelIds, guardianName || guardian.nome_completo, guardian);
    };

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        setRelatedStudents([]); setQuery(''); setResults([]);
        setSelectedGuardianId(null); setMultiStudents([]);
        setIsAddingMore(false); setAddMoreQuery(''); setAddMoreResults([]);
        setUseManualPickup(false); setManualPickupName('');
    };

    const handleAddMoreStudent = (student: Student) => {
        setMultiStudents(prev => [...prev, student]);
        setAddMoreQuery(''); setAddMoreResults([]);
        setIsAddingMore(false);
    };

    const handleRemoveMultiStudent = (id: string) => {
        setMultiStudents(prev => prev.filter(s => s.id !== id));
    };

    const toggleStudentSelection = (id: string) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleClearSelection = () => resetAll();

    const selectedGuardian = guardians.find(g => g.id === selectedGuardianId);
    const isRelatedMode = relatedStudents.length > 0;
    const hasSelection = selectedStudent !== null || isRelatedMode;

    // All students in call (manual mode)
    const allManualStudents = selectedStudent ? [selectedStudent, ...multiStudents] : [];
    const totalManualCount = allManualStudents.length;

    const canCall = (() => {
        if (isRelatedMode) return selectedStudentIds.size > 0;
        if (hasSelection) {
            if (useManualPickup) return manualPickupName.trim().length >= 2;
            return selectedGuardianId !== null;
        }
        return false;
    })();

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            background: B.navyDeep,
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
            opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease',
        }}>

            {/* ══════════ HEADER ══════════ */}
            <header style={{
                background: B.navy, position: 'sticky', top: 0, zIndex: 60,
                boxShadow: `0 4px 24px rgba(7,24,48,0.7)`,
            }}>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${B.gold} 0%, ${B.goldDark} 50%, ${B.gold} 100%)` }} />
                <div style={{ padding: '0 20px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>

                    {/* Left */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                        <NavigationControls />
                        <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.15)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: B.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 10px ${B.gold}45`, flexShrink: 0 }}>
                                <Activity size={17} style={{ color: B.onGold }} />
                            </div>
                            <div>
                                <p style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: `${B.gold}80`, marginBottom: 1 }}>
                                    La Salle, Cheguei! · Recepção
                                </p>
                                <h1 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 16, fontWeight: 800, color: B.white, letterSpacing: '-0.02em', lineHeight: 1 }}>
                                    Hub de Identificação
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Center: operator */}
                    <div className="hidden md:flex" style={{ alignItems: 'center', gap: 9, background: 'rgba(0,0,0,0.2)', border: `1px solid ${B.gold}18`, borderRadius: 8, padding: '5px 13px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: B.green, boxShadow: `0 0 6px ${B.green}` }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: B.grayLight, letterSpacing: '0.1em' }}>
                            {userProfile?.nome_completo?.split(' ')[0] || 'Operador'}
                        </span>
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => setIsCodeModalOpen(true)} style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                            background: `${B.gold}18`, border: `1px solid ${B.gold}35`, borderRadius: 7,
                            color: B.gold, fontSize: 10, fontWeight: 700, fontFamily: 'Instrument Sans, sans-serif',
                            letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.18s',
                        }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.gold}30`; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.gold}18`; }}
                        >
                            <Hash size={13} />
                            <span className="hidden sm:inline">Código</span>
                        </button>
                        <button onClick={() => setIsScannerOpen(true)} style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                            background: B.gold, border: 'none', borderRadius: 7,
                            color: B.onGold, fontSize: 10, fontWeight: 800, fontFamily: 'Epilogue, sans-serif',
                            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.18s',
                            boxShadow: `0 3px 14px ${B.gold}40`,
                        }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = B.goldDark; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = B.gold; }}
                        >
                            <QrCode size={13} />
                            <span className="hidden sm:inline">Escanear QR</span>
                        </button>
                        <button onClick={handleLogout} style={{
                            width: 36, height: 36, borderRadius: 7, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${B.red}18`, color: '#ff7b8a',
                            outline: `1px solid ${B.red}35`, transition: 'all 0.18s',
                        }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}35`; el.style.color = '#fff'; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}18`; el.style.color = '#ff7b8a'; }}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ══════════ BODY ══════════ */}
            <main className="rec-main-grid" style={{
                flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px',
                gap: 0, minHeight: 0, overflow: 'hidden',
            }}>

                {/* ── Left: Search + Detail ── */}
                <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '22px 22px 48px' }}>

                    {/* Search bar */}
                    <div style={{ position: 'relative', marginBottom: 16 }}>
                        <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                            {loading ? (
                                <div style={{ width: 18, height: 18, border: `2px solid ${B.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'rec-spin 0.7s linear infinite' }} />
                            ) : (
                                <SearchIcon size={18} style={{ color: B.gray }} />
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="CPF, nome ou RA do aluno / responsável…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '14px 16px 14px 48px', boxSizing: 'border-box',
                                background: B.card, border: `1.5px solid ${query ? B.gold + '55' : B.cardBorder}`,
                                borderRadius: 13, fontSize: 15, fontWeight: 600, color: B.white,
                                outline: 'none', transition: 'border-color 0.18s',
                                fontFamily: 'Instrument Sans, sans-serif',
                            }}
                            onFocus={e => (e.target as HTMLInputElement).style.borderColor = `${B.gold}55`}
                            onBlur={e => (e.target as HTMLInputElement).style.borderColor = query ? `${B.gold}55` : B.cardBorder}
                        />
                    </div>

                    {/* Search results dropdown */}
                    {results.length > 0 && !selectedStudent && (
                        <div style={{ background: B.card, border: `1px solid ${B.cardBorder}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16, boxShadow: `0 16px 48px rgba(7,24,48,0.7)` }}>
                            {results.map((student, idx) => (
                                <button
                                    key={student.id}
                                    onClick={() => handleSelectStudent(student)}
                                    style={{
                                        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        borderBottom: idx < results.length - 1 ? `1px solid ${B.cardBorder}` : 'none',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${B.gold}10`; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', border: `2px solid ${B.cardBorder}`, flexShrink: 0, background: B.navy }}>
                                        {student.foto_url
                                            ? <img src={student.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={22} style={{ color: `${B.gold}45` }} /></div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 14, fontWeight: 700, color: B.white, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.nome_completo}</p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: B.gold, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{student.turma}</span>
                                            <span style={{ fontSize: 10, color: B.gray }}>·</span>
                                            <span style={{ fontSize: 10, fontWeight: 600, color: B.gray, letterSpacing: '0.08em' }}>{student.sala}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} style={{ color: B.gray, flexShrink: 0 }} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Active: Student Detail Panel ── */}
                    {hasSelection ? (
                        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.4s, transform 0.4s' }}>

                            {/* ════ RELATED MODE (from QR/Code) ════ */}
                            {isRelatedMode ? (
                                <div style={{ background: B.card, borderRadius: 18, overflow: 'hidden', border: `1px solid ${B.cardBorder}`, boxShadow: `0 8px 40px rgba(7,24,48,0.6)` }}>
                                    {/* Gold rule */}
                                    <div style={{ height: 3, background: `linear-gradient(90deg, ${B.gold}, ${B.navy}80, transparent)` }} />

                                    {/* Guardian hero */}
                                    <div style={{ padding: '22px 22px 18px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${B.cardBorder}` }}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', border: `3px solid ${B.gold}`, boxShadow: `0 0 0 5px ${B.gold}14`, background: B.navy }}>
                                                {selectedGuardian?.foto_url
                                                    ? <img src={selectedGuardian.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setIsPhotoZoomed(true)} />
                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={30} style={{ color: `${B.gold}45` }} /></div>}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: `${B.gold}70` }}>Responsável Identificado</span>
                                            <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 22, fontWeight: 900, color: B.white, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 3 }}>
                                                {selectedGuardian?.nome_completo || 'Grupo Familiar'}
                                            </h2>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: B.green, boxShadow: `0 0 6px ${B.green}` }} />
                                                <span style={{ fontSize: 10, fontWeight: 600, color: B.green }}>{relatedStudents.length} aluno{relatedStudents.length > 1 ? 's' : ''} vinculado{relatedStudents.length > 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                        <button onClick={handleClearSelection} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: `${B.red}18`, color: '#ff7b8a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: `1px solid ${B.red}30`, transition: 'all 0.18s' }}
                                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}35`; el.style.color = '#fff'; }}
                                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}18`; el.style.color = '#ff7b8a'; }}
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    {/* Students grid */}
                                    <div style={{ padding: '16px 22px 18px' }}>
                                        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: `${B.gold}65`, marginBottom: 12 }}>
                                            Selecionar alunos para chamar
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                                            {relatedStudents.map(student => {
                                                const isSel = selectedStudentIds.has(student.id);
                                                return (
                                                    <button key={student.id} onClick={() => toggleStudentSelection(student.id)} style={{
                                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                                        background: isSel ? `${B.gold}14` : 'rgba(255,255,255,0.03)',
                                                        border: `1.5px solid ${isSel ? B.gold + '55' : B.cardBorder}`,
                                                        borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
                                                    }}>
                                                        <div style={{ width: 42, height: 42, borderRadius: 9, overflow: 'hidden', border: `2px solid ${isSel ? B.gold : B.cardBorder}`, flexShrink: 0, background: B.navy, transition: 'border-color 0.18s' }}>
                                                            {student.foto_url ? <img src={student.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={18} style={{ color: `${B.gold}40` }} /></div>}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: 11.5, fontWeight: 700, color: isSel ? B.white : B.grayLight, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 2 }}>{student.nome_completo}</p>
                                                            <p style={{ fontSize: 9.5, color: B.gray }}>{student.turma}</p>
                                                        </div>
                                                        <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: isSel ? B.gold : 'rgba(255,255,255,0.05)', border: `1.5px solid ${isSel ? B.gold : B.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
                                                            {isSel && <CheckCircle2 size={13} style={{ color: B.onGold }} />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Call button */}
                                    <div style={{ padding: '0 22px 22px' }}>
                                        <button onClick={handleCallStudents}
                                            disabled={sending || selectedStudentIds.size === 0}
                                            style={{
                                                width: '100%', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                                background: selectedStudentIds.size > 0 ? `linear-gradient(135deg, ${B.gold} 0%, ${B.goldDark} 100%)` : 'rgba(255,255,255,0.05)',
                                                border: 'none', borderRadius: 13, cursor: selectedStudentIds.size > 0 ? 'pointer' : 'not-allowed',
                                                color: selectedStudentIds.size > 0 ? B.onGold : B.gray,
                                                fontFamily: 'Epilogue, sans-serif', fontSize: 14, fontWeight: 800, letterSpacing: '0.04em',
                                                boxShadow: selectedStudentIds.size > 0 ? `0 6px 24px ${B.gold}38` : 'none',
                                                transition: 'all 0.2s',
                                            }}>
                                            {sending
                                                ? <div style={{ width: 20, height: 20, border: `2px solid ${B.onGold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'rec-spin 0.7s linear infinite' }} />
                                                : <><Bell size={16} /> {selectedStudentIds.size > 1 ? `Chamar ${selectedStudentIds.size} Alunos` : 'Chamar Aluno'}</>}
                                        </button>
                                    </div>
                                </div>

                            ) : (
                                /* ════ MANUAL MODE (from search) ════ */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                                    {/* Student hero card */}
                                    <div style={{ background: B.card, borderRadius: 18, overflow: 'hidden', border: `1px solid ${B.cardBorder}`, boxShadow: `0 8px 40px rgba(7,24,48,0.6)` }}>
                                        <div style={{ height: 3, background: `linear-gradient(90deg, ${B.gold}, transparent)` }} />
                                        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                            {/* Photo */}
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <div style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', border: `3px solid ${B.gold}`, boxShadow: `0 0 0 5px ${B.gold}14`, background: B.navy, cursor: selectedStudent?.foto_url ? 'pointer' : 'default' }} onClick={() => selectedStudent?.foto_url && setIsPhotoZoomed(true)}>
                                                    {selectedStudent?.foto_url ? <img src={selectedStudent.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={30} style={{ color: `${B.gold}45` }} /></div>}
                                                </div>
                                                {selectedStudent?.foto_url && <button onClick={() => setIsPhotoZoomed(true)} style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 6, background: B.gold, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={10} style={{ color: B.onGold }} /></button>}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: `${B.gold}70` }}>Aluno Identificado</span>
                                                <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 20, fontWeight: 900, color: B.white, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                                                    {selectedStudent?.nome_completo}
                                                </h2>
                                                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: B.gold, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{selectedStudent?.turma}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: B.gray, letterSpacing: '0.08em' }}>{selectedStudent?.sala}</span>
                                                </div>
                                            </div>
                                            <button onClick={handleClearSelection} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: `${B.red}18`, color: '#ff7b8a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: `1px solid ${B.red}30`, flexShrink: 0, transition: 'all 0.18s' }}
                                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}35`; el.style.color = '#fff'; }}
                                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}18`; el.style.color = '#ff7b8a'; }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>

                                        {/* Extra students chips */}
                                        {multiStudents.length > 0 && (
                                            <div style={{ padding: '0 20px 14px' }}>
                                                <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: `${B.gold}65`, marginBottom: 8 }}>
                                                    Também serão chamados
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                    {multiStudents.map(s => (
                                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', background: `${B.gold}12`, border: `1px solid ${B.gold}38`, borderRadius: 8 }}>
                                                            <div style={{ width: 26, height: 26, borderRadius: 6, overflow: 'hidden', background: B.navy, border: `1px solid ${B.gold}30`, flexShrink: 0 }}>
                                                                {s.foto_url ? <img src={s.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={12} style={{ color: `${B.gold}45` }} /></div>}
                                                            </div>
                                                            <span style={{ fontSize: 11.5, fontWeight: 700, color: B.white }}>{s.nome_completo.split(' ')[0]}</span>
                                                            <span style={{ fontSize: 9, color: B.gray }}>{s.turma}</span>
                                                            <button onClick={() => handleRemoveMultiStudent(s.id)} style={{ width: 18, height: 18, borderRadius: 4, border: 'none', background: `${B.red}22`, color: '#ff7b8a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Add more students button / search */}
                                        <div style={{ padding: '0 20px 18px' }}>
                                            {!isAddingMore ? (
                                                <button onClick={() => setIsAddingMore(true)} style={{
                                                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
                                                    background: 'rgba(255,255,255,0.04)', border: `1px dashed ${B.cardBorder}`,
                                                    borderRadius: 9, cursor: 'pointer', color: B.gray,
                                                    fontSize: 11, fontWeight: 600, fontFamily: 'Instrument Sans, sans-serif',
                                                    transition: 'all 0.18s',
                                                }}
                                                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.gold}10`; el.style.borderColor = `${B.gold}40`; el.style.color = B.gold; }}
                                                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = B.cardBorder; el.style.color = B.gray; }}
                                                >
                                                    <Plus size={13} /> Adicionar outro aluno a esta chamada
                                                </button>
                                            ) : (
                                                <div>
                                                    <div style={{ position: 'relative' }}>
                                                        <SearchIcon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: B.gray, pointerEvents: 'none' }} />
                                                        <input
                                                            ref={addMoreInputRef}
                                                            type="text"
                                                            placeholder="Nome do aluno…"
                                                            value={addMoreQuery}
                                                            onChange={e => setAddMoreQuery(e.target.value)}
                                                            style={{
                                                                width: '100%', padding: '9px 36px 9px 35px', boxSizing: 'border-box',
                                                                background: 'rgba(0,0,0,0.25)', border: `1.5px solid ${B.gold}40`,
                                                                borderRadius: 9, fontSize: 12, fontWeight: 600, color: B.white, outline: 'none',
                                                                fontFamily: 'Instrument Sans, sans-serif',
                                                            }}
                                                        />
                                                        <button onClick={() => { setIsAddingMore(false); setAddMoreQuery(''); setAddMoreResults([]); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.06)', color: B.gray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <X size={11} />
                                                        </button>
                                                    </div>
                                                    {addMoreResults.length > 0 && (
                                                        <div style={{ background: B.navyDark, border: `1px solid ${B.cardBorder}`, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                                                            {addMoreResults.map((s, idx) => (
                                                                <button key={s.id} onClick={() => handleAddMoreStudent(s)} style={{
                                                                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                                                                    background: 'transparent', border: 'none', borderBottom: idx < addMoreResults.length - 1 ? `1px solid ${B.cardBorder}` : 'none',
                                                                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                                                                }}
                                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${B.gold}10`; }}
                                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                >
                                                                    <div style={{ width: 36, height: 36, borderRadius: 7, overflow: 'hidden', background: B.navy, border: `1px solid ${B.cardBorder}`, flexShrink: 0 }}>
                                                                        {s.foto_url ? <img src={s.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={16} style={{ color: `${B.gold}40` }} /></div>}
                                                                    </div>
                                                                    <div>
                                                                        <p style={{ fontSize: 12, fontWeight: 700, color: B.white }}>{s.nome_completo}</p>
                                                                        <p style={{ fontSize: 9.5, color: B.gray }}>{s.turma} · {s.sala}</p>
                                                                    </div>
                                                                    <Plus size={12} style={{ color: B.gold, marginLeft: 'auto' }} />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Guardian selection ── */}
                                    {!useManualPickup && (
                                        <div style={{ background: B.card, borderRadius: 16, padding: '18px 20px', border: `1px solid ${B.cardBorder}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: `${B.gold}65` }}>
                                                    Responsável Autorizado
                                                </p>
                                                {guardians.length === 0 && (
                                                    <span style={{ fontSize: 9, fontWeight: 600, color: B.gray, letterSpacing: '0.1em' }}>Nenhum cadastrado</span>
                                                )}
                                            </div>

                                            {guardians.length > 0 ? (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    {guardians.map(g => {
                                                        const isSel = g.id === selectedGuardianId;
                                                        return (
                                                            <button key={g.id} onClick={() => setSelectedGuardianId(isSel ? null : g.id)} style={{
                                                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                                                background: isSel ? `${B.gold}14` : 'rgba(255,255,255,0.03)',
                                                                border: `1.5px solid ${isSel ? B.gold + '55' : B.cardBorder}`,
                                                                borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
                                                            }}>
                                                                <div style={{ width: 42, height: 42, borderRadius: 9, overflow: 'hidden', border: `2px solid ${isSel ? B.gold : B.cardBorder}`, flexShrink: 0, background: B.navy }}>
                                                                    {g.foto_url ? <img src={g.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={18} style={{ color: `${B.gold}40` }} /></div>}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <p style={{ fontSize: 11.5, fontWeight: 700, color: isSel ? B.white : B.grayLight, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 2 }}>{g.nome_completo}</p>
                                                                    <span style={{ fontSize: 8.5, fontWeight: 700, color: isSel ? `${B.gold}90` : B.gray, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{g.parentesco || 'Autorizado'}</span>
                                                                </div>
                                                                <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: isSel ? B.gold : 'rgba(255,255,255,0.05)', border: `1.5px solid ${isSel ? B.gold : B.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
                                                                    {isSel && <CheckCircle2 size={12} style={{ color: B.onGold }} />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'rgba(228,1,35,0.06)', border: `1px solid ${B.red}28`, borderRadius: 10, marginBottom: 4 }}>
                                                    <UserX size={16} style={{ color: '#ff7b8a', flexShrink: 0 }} />
                                                    <p style={{ fontSize: 12, color: '#ff7b8a', fontWeight: 600 }}>Aluno sem responsável cadastrado no sistema</p>
                                                </div>
                                            )}

                                            {/* Switch to manual */}
                                            <button onClick={() => { setUseManualPickup(true); setSelectedGuardianId(null); }} style={{
                                                display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '8px 12px',
                                                background: 'transparent', border: `1px dashed ${B.red}35`, borderRadius: 9,
                                                cursor: 'pointer', color: '#ff7b8a', fontSize: 11, fontWeight: 600,
                                                fontFamily: 'Instrument Sans, sans-serif', transition: 'all 0.18s',
                                            }}
                                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${B.red}10`; el.style.borderColor = `${B.red}55`; }}
                                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = `${B.red}35`; }}
                                            >
                                                <PenLine size={12} /> Responsável não cadastrado — inserir nome manualmente
                                            </button>
                                        </div>
                                    )}

                                    {/* ── Manual pickup name panel ── */}
                                    {useManualPickup && (
                                        <div style={{ background: B.card, borderRadius: 16, padding: '18px 20px', border: `1.5px solid ${B.red}35`, boxShadow: `0 4px 20px rgba(228,1,35,0.12)` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                    <div style={{ width: 30, height: 30, borderRadius: 7, background: `${B.red}18`, border: `1px solid ${B.red}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <PenLine size={13} style={{ color: '#ff7b8a' }} />
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: '#ff7b8a' }}>Retirada Avulsa</p>
                                                        <p style={{ fontSize: 10.5, fontWeight: 600, color: B.gray, marginTop: 1 }}>Responsável não cadastrado no sistema</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => { setUseManualPickup(false); setManualPickupName(''); }} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.05)', color: B.gray, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <X size={12} />
                                                </button>
                                            </div>

                                            <label style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: `${B.gold}70`, display: 'block', marginBottom: 8 }}>
                                                Nome de quem está retirando *
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Nome completo do responsável presente"
                                                value={manualPickupName}
                                                onChange={e => setManualPickupName(e.target.value)}
                                                autoFocus
                                                style={{
                                                    width: '100%', padding: '12px 15px', boxSizing: 'border-box',
                                                    background: 'rgba(0,0,0,0.25)',
                                                    border: `1.5px solid ${manualPickupName.length >= 2 ? B.gold + '55' : 'rgba(255,255,255,0.1)'}`,
                                                    borderRadius: 10, fontSize: 14, fontWeight: 600, color: B.white, outline: 'none',
                                                    fontFamily: 'Instrument Sans, sans-serif', transition: 'border-color 0.18s',
                                                }}
                                                onFocus={e => (e.target as HTMLInputElement).style.borderColor = `${B.gold}55`}
                                                onBlur={e => (e.target as HTMLInputElement).style.borderColor = manualPickupName.length >= 2 ? `${B.gold}55` : 'rgba(255,255,255,0.1)'}
                                            />
                                            <p style={{ fontSize: 10, color: B.gray, marginTop: 8, lineHeight: 1.5 }}>
                                                Este nome ficará registrado na solicitação como <span style={{ color: '#ff7b8a', fontWeight: 700 }}>Retirada Avulsa</span> para fins de auditoria.
                                            </p>
                                        </div>
                                    )}

                                    {/* Status feedback */}
                                    <div style={{ padding: '10px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, background: canCall ? `${B.green}10` : `rgba(251,209,45,0.07)`, border: `1px solid ${canCall ? B.green + '30' : B.gold + '25'}` }}>
                                        {canCall
                                            ? <><CheckCircle2 size={15} style={{ color: B.green, flexShrink: 0 }} /><div><p style={{ fontSize: 11, fontWeight: 700, color: B.green }}>Pronto para chamar</p><p style={{ fontSize: 9.5, color: B.textSub }}>{totalManualCount} aluno{totalManualCount > 1 ? 's' : ''} · {useManualPickup ? manualPickupName.trim() : selectedGuardian?.nome_completo}</p></div></>
                                            : <><AlertCircle size={15} style={{ color: B.gold, flexShrink: 0 }} /><p style={{ fontSize: 11, fontWeight: 600, color: B.gold }}>{useManualPickup ? 'Digite o nome de quem está retirando' : 'Selecione um responsável ou use retirada avulsa'}</p></>
                                        }
                                    </div>

                                    {/* Call button (manual mode) */}
                                    <button onClick={handleCallStudents} disabled={sending || !canCall} style={{
                                        width: '100%', padding: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                        background: canCall ? `linear-gradient(135deg, ${B.gold} 0%, ${B.goldDark} 100%)` : 'rgba(255,255,255,0.05)',
                                        border: 'none', borderRadius: 14, cursor: canCall ? 'pointer' : 'not-allowed',
                                        color: canCall ? B.onGold : B.gray,
                                        fontFamily: 'Epilogue, sans-serif', fontSize: 15, fontWeight: 800, letterSpacing: '0.02em',
                                        boxShadow: canCall ? `0 6px 24px ${B.gold}38` : 'none',
                                        transition: 'all 0.2s',
                                    }}>
                                        {sending
                                            ? <div style={{ width: 20, height: 20, border: `2px solid ${B.onGold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'rec-spin 0.7s linear infinite' }} />
                                            : <><Bell size={17} /> {totalManualCount > 1 ? `Chamar ${totalManualCount} Alunos` : 'Chamar Aluno'}</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ════ EMPTY STATE ════ */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 440, textAlign: 'center', gap: 24, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.15s', position: 'relative' }}>
                            {/* Decorative rings */}
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 360, height: 360, borderRadius: '50%', border: `1px solid ${B.gold}07`, animation: 'rec-ring 4s ease-in-out infinite', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 260, height: 260, borderRadius: '50%', border: `1px solid ${B.gold}10`, animation: 'rec-ring 4s ease-in-out infinite 0.5s', pointerEvents: 'none' }} />

                            <div style={{ position: 'relative', width: 130, height: 130 }}>
                                <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: `1.5px solid ${B.gold}20`, animation: 'rec-ring 3.5s ease-in-out infinite 0.8s' }} />
                                <div style={{ width: 130, height: 130, borderRadius: '50%', background: `radial-gradient(circle at 38% 35%, ${B.navy}, ${B.navyDark})`, border: `2.5px solid ${B.gold}38`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 48px ${B.gold}12, 0 12px 48px rgba(7,24,48,0.8)` }}>
                                    <School size={44} style={{ color: B.gold, filter: `drop-shadow(0 0 10px ${B.gold}60)` }} />
                                </div>
                            </div>

                            <div>
                                <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 22, fontWeight: 800, color: B.white, letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15 }}>
                                    Identificação Pendente
                                </h2>
                                <p style={{ fontSize: 12.5, color: B.gray, maxWidth: 300, lineHeight: 1.65, margin: '0 auto' }}>
                                    Busque um aluno pelo nome, ou escaneie o QR / código do responsável para vinculação rápida.
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 20px', background: `${B.gold}12`, border: `1px solid ${B.gold}28`, borderRadius: 30 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: B.gold, boxShadow: `0 0 8px ${B.gold}`, animation: 'rec-glow 1.5s ease-in-out infinite' }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: B.gold, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Monitoramento Ativo</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right: Withdrawal Queue ── */}
                <div style={{ borderLeft: `1px solid ${B.cardBorder}`, position: 'sticky', top: 64, height: 'calc(100vh - 64px)', overflowY: 'auto', background: `linear-gradient(180deg, ${B.navyDark} 0%, ${B.navyDeep} 100%)` }}>
                    <WithdrawalQueue />
                </div>
            </main>

            {/* Modals */}
            <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleQRScan} />
            {isCodeModalOpen && <CodeModal onConfirm={handleCodeLookup} onClose={() => setIsCodeModalOpen(false)} />}

            {/* Photo zoom modal */}
            {isPhotoZoomed && (selectedStudent?.foto_url || selectedGuardian?.foto_url) && (
                <div onClick={() => setIsPhotoZoomed(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(7,24,48,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <div style={{ position: 'relative', maxWidth: 640, width: '100%', aspectRatio: '1', borderRadius: 28, overflow: 'hidden', border: `3px solid ${B.gold}30`, boxShadow: `0 0 80px ${B.gold}18` }}>
                        <img src={(isRelatedMode ? selectedGuardian?.foto_url : selectedStudent?.foto_url) || undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => setIsPhotoZoomed(false)} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 10, background: 'rgba(7,24,48,0.7)', border: `1px solid ${B.cardBorder}`, color: B.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                            <X size={18} />
                        </button>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 20px 20px', background: 'linear-gradient(to top, rgba(7,24,48,0.9), transparent)' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: `${B.gold}80`, marginBottom: 4 }}>Identificação SISRA</p>
                            <p style={{ fontFamily: 'Epilogue, sans-serif', fontSize: 22, fontWeight: 900, color: B.white }}>
                                {isRelatedMode ? selectedGuardian?.nome_completo : selectedStudent?.nome_completo}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes rec-spin  { to { transform: rotate(360deg); } }
                @keyframes rec-glow  { 0%,100%{opacity:1;box-shadow:0 0 8px ${B.gold};} 50%{opacity:.6;box-shadow:0 0 18px ${B.gold};} }
                @keyframes rec-ring  { 0%{opacity:.2;transform:translate(-50%,-50%) scale(1);} 50%{opacity:.5;transform:translate(-50%,-50%) scale(1.04);} 100%{opacity:.2;transform:translate(-50%,-50%) scale(1);} }

                /* Responsive */
                @media (max-width: 1024px) {
                    .rec-main-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}

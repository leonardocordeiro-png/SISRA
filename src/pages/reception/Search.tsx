import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAuth } from '../../context/AuthContext';
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
    ArrowLeft,
    Home,
} from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
    bg:          '#070a14',
    gold:        '#C79E61',
    goldDark:    '#a07a3d',
    red:         '#E40123',
    green:       '#34D399',
    muted:       '#8491A2',
    white:       '#FFFFFF',
    panelBg:     'rgba(17,24,43,0.6)',
    panelBorder: 'rgba(199,158,97,0.3)',
    panelBorderSub: 'rgba(199,158,97,0.1)',
    onGold:      '#070a14',
    navyDark:    '#0a2f6b',
    navyDeep:    '#071830',
    card:        'rgba(17,24,43,0.6)',
};

// ─── Code Entry Modal ─────────────────────────────────────────────────────────

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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,10,20,0.9)', backdropFilter: 'blur(8px)', padding: 16 }}>
            <div style={{ background: 'rgba(17,24,43,0.95)', borderRadius: 20, width: '100%', maxWidth: 380, overflow: 'hidden', border: `1px solid ${D.panelBorder}`, boxShadow: `0 30px 80px rgba(0,0,0,0.7)` }}>
                {/* Gold top rule */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${D.gold}, ${D.goldDark}, ${D.gold})` }} />
                <div style={{ background: 'rgba(199,158,97,0.08)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: `rgba(199,158,97,0.15)`, border: `1px solid ${D.panelBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Hash size={15} style={{ color: D.gold }} />
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 800, color: D.white, fontFamily: "'Inter', sans-serif" }}>Código de Acesso</p>
                            <p style={{ fontSize: 9, fontWeight: 600, color: `${D.gold}70`, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Exclusivo por responsável</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.06)', color: D.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={14} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '22px 22px 22px' }}>
                    <p style={{ fontSize: 12, color: D.muted, textAlign: 'center', lineHeight: 1.65, marginBottom: 18 }}>
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
                            border: `2px solid ${code ? D.panelBorder : 'rgba(199,158,97,0.1)'}`,
                            borderRadius: 11, fontSize: 26, fontWeight: 900, color: D.white,
                            textAlign: 'center', letterSpacing: '0.4em', outline: 'none',
                            fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                            transition: 'border-color 0.18s',
                        }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                        <button type="button" onClick={onClose} style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${D.panelBorderSub}`, borderRadius: 10, color: D.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={code.length < 4} style={{ padding: '12px', background: code.length >= 4 ? D.gold : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, color: code.length >= 4 ? D.onGold : D.muted, fontWeight: 800, fontSize: 12, cursor: code.length >= 4 ? 'pointer' : 'not-allowed', fontFamily: "'Inter', sans-serif", transition: 'all 0.18s' }}>
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
    const [multiStudents, setMultiStudents] = useState<Student[]>([]);
    const [isAddingMore, setIsAddingMore] = useState(false);
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
    const [useManualPickup, setUseManualPickup] = useState(false);
    const [manualPickupName, setManualPickupName] = useState('');
    const [isEmergency, setIsEmergency] = useState(false);
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
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
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

        const allStudents: Student[] = isRelatedMode
            ? relatedStudents.filter(s => selectedStudentIds.has(s.id))
            : [selectedStudent, ...multiStudents].filter(Boolean) as Student[];

        const studentIds = allStudents.map(s => s.id);

        if (studentIds.length === 0 || !user) return;

        setSending(true);
        try {
            const escolaId = userProfile?.escola_id
                || allStudents.find(s => s.escola_id)?.escola_id
                || null;

            if (escolaId) {
                await supabase
                    .from('solicitacoes_retirada')
                    .update({ status: 'CANCELADO', horario_confirmacao: new Date().toISOString() })
                    .in('aluno_id', studentIds)
                    .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
                    .is('horario_confirmacao', null)
                    .is('escola_id', null);
                await supabase
                    .from('solicitacoes_retirada')
                    .update({ status: 'CANCELADO', horario_confirmacao: new Date().toISOString() })
                    .in('aluno_id', studentIds)
                    .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
                    .is('horario_confirmacao', null)
                    .neq('escola_id', escolaId);
            }

            let preCheckQuery = supabase
                .from('solicitacoes_retirada')
                .select('aluno_id, status')
                .in('aluno_id', studentIds)
                .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
                .is('horario_confirmacao', null);

            if (escolaId) preCheckQuery = preCheckQuery.eq('escola_id', escolaId);

            const { data: existing, error: checkError } = await preCheckQuery;

            if (checkError) {
                console.warn('Pre-check warning:', checkError.code, checkError.message);
            } else if (existing && existing.length > 0) {
                const activeIds = new Set(existing.map((r: any) => r.aluno_id));
                const dupNames = allStudents
                    .filter(s => activeIds.has(s.id))
                    .map(s => s.nome_completo.split(' ')[0]);
                toast.error(
                    'Solicitação já ativa',
                    `${dupNames.join(', ')} já possui${dupNames.length > 1 ? 'm' : ''} uma solicitação em aberto visível na Fila de Retirada.`
                );
                return;
            }

            const requests = allStudents.map(student => {
                const req: any = {
                    escola_id: student.escola_id || escolaId,
                    aluno_id: student.id,
                    responsavel_id: selectedGuardianId || null,
                    recepcionista_id: user.id,
                    status: 'SOLICITADO',
                    tipo_solicitacao: isEmergency ? 'EMERGENCIA' : 'RECEPCAO',
                    status_geofence: 'CHEGOU',
                };
                if (useManualPickup && manualPickupName.trim()) {
                    req.mensagem_recepcao = `Retirada avulsa — ${manualPickupName.trim()}`;
                }
                return req;
            });

            let { error } = await supabase.from('solicitacoes_retirada').insert(requests);

            if (error && (error.code === '23505' || error.message?.toLowerCase().includes('unique') || error.message?.toLowerCase().includes('duplicate'))) {
                console.warn('Unique constraint on insert — auto-closing stale records and retrying:', error.message);
                await supabase
                    .from('solicitacoes_retirada')
                    .update({ status: 'CANCELADO', horario_confirmacao: new Date().toISOString() })
                    .in('aluno_id', studentIds)
                    .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
                    .is('horario_confirmacao', null);

                const retry = await supabase.from('solicitacoes_retirada').insert(requests);
                error = retry.error;
            }

            if (error) throw error;

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

            resetAll();
        } catch (error: any) {
            console.error('Error calling students:', error);
            const detail = error?.details || error?.message || error?.hint
                || (typeof error === 'string' ? error : 'Verifique o console para detalhes.');
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
        setUseManualPickup(false); setManualPickupName(''); setIsEmergency(false);
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
        setSelectedStudent(null); setMultiStudents([]);
        setIsAddingMore(false); setAddMoreQuery(''); setAddMoreResults([]);
        setUseManualPickup(false); setManualPickupName('');

        const [authsRes, junctionRes] = await Promise.all([
            supabase.from('autorizacoes').select('aluno_id').in('responsavel_id', responsavelIds).eq('ativa', true),
            supabase.from('alunos_responsaveis').select('aluno_id').in('responsavel_id', responsavelIds),
        ]);

        const alunoIds = new Set<string>([
            ...(authsRes.data?.map((a: any) => a.aluno_id) || []),
            ...(!junctionRes.error ? (junctionRes.data?.map((j: any) => j.aluno_id) || []) : []),
        ]);

        if (alunoIds.size === 0) {
            const authErr = authsRes.error ? ` (autorizacoes: ${authsRes.error.message})` : '';
            throw new Error(`Nenhum aluno vinculado a este responsável.${authErr}`);
        }

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

    // Shared glass button style for header nav
    const glassBtn: React.CSSProperties = {
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(199,158,97,0.1)',
        borderRadius: 8,
        color: D.muted,
        padding: '10px 18px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 600,
        transition: 'all 0.3s',
        fontFamily: "'Inter', sans-serif",
    };

    return (
        <div style={{
            height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            background: D.bg,
            backgroundImage: 'radial-gradient(circle at 10% 10%, #1a2540 0%, transparent 40%), radial-gradient(circle at 90% 90%, #0d121f 0%, transparent 40%)',
            fontFamily: "'Inter', system-ui, sans-serif",
            color: D.white,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s',
        }}>

            <style>{`
                @keyframes rec-spin   { to { transform: rotate(360deg); } }
                @keyframes rec-pulse  { 0%,100%{ box-shadow: 0 0 10px #52D399, 0 0 20px rgba(82,211,153,0.8); } 50%{ box-shadow: 0 0 15px #52D399, 0 0 25px rgba(82,211,153,1.0); } }
                @keyframes rec-glow   { 0%,100%{ opacity:1; box-shadow:0 0 8px #C79E61; } 50%{ opacity:.6; box-shadow:0 0 18px #C79E61; } }
                @keyframes rec-ring   { 0%{ opacity:.2; transform:translate(-50%,-50%) scale(1); } 50%{ opacity:.5; transform:translate(-50%,-50%) scale(1.04); } 100%{ opacity:.2; transform:translate(-50%,-50%) scale(1); } }
                @media (max-width: 1280px) {
                    .rec-search-panel { width: 340px !important; padding: 24px 18px !important; }
                    .rec-queue-main { padding: 24px 28px !important; }
                }
                @media (max-width: 1024px) {
                    .rec-body { flex-direction: column !important; overflow-y: auto !important; overflow-x: hidden !important; }
                    .rec-search-panel { width: 100% !important; max-height: 50vh; border-right: none !important; border-bottom: 1px solid rgba(199,158,97,0.08) !important; }
                    .rec-queue-main { padding: 20px !important; min-height: 0; }
                }
                @media (max-width: 640px) {
                    header { padding: 0 16px !important; }
                    .rec-search-panel { padding: 20px 16px !important; }
                    .rec-queue-main { padding: 16px !important; }
                }
            `}</style>

            {/* ══════════ FIXED HEADER 80px ══════════ */}
            <header style={{
                height: 80,
                position: 'fixed',
                top: 0, left: 0, right: 0,
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 40px',
                boxSizing: 'border-box',
                borderBottom: '1px solid rgba(199,158,97,0.05)',
                background: 'rgba(7,10,20,0.8)',
                backdropFilter: 'blur(10px)',
            }}>
                {/* Left: Voltar + Início */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={glassBtn}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = D.gold; (e.currentTarget as HTMLElement).style.borderColor = D.panelBorder; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = D.muted; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(199,158,97,0.1)'; }}
                    >
                        <ArrowLeft size={15} />
                        <span>Voltar</span>
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        style={glassBtn}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = D.gold; (e.currentTarget as HTMLElement).style.borderColor = D.panelBorder; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = D.muted; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(199,158,97,0.1)'; }}
                    >
                        <Home size={15} />
                        <span>Início</span>
                    </button>
                </div>

                {/* Center: brand name */}
                <div style={{ marginRight: 'auto', marginLeft: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `rgba(199,158,97,0.15)`, border: `1px solid ${D.panelBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Activity size={17} style={{ color: D.gold }} />
                    </div>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: D.gold, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>La Salle, Cheguei!</p>
                        <h1 style={{ fontSize: 18, fontWeight: 800, color: D.white, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>Hub de Identificação</h1>
                    </div>
                </div>

                {/* Right: operator + action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Operator name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(199,158,97,0.08)', borderRadius: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: D.green, boxShadow: `0 0 8px ${D.green}`, animation: 'rec-pulse 2s infinite ease-in-out' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: D.muted }}>
                            {userProfile?.nome_completo?.split(' ')[0] || 'Operador'}
                        </span>
                    </div>

                    {/* Código button */}
                    <button
                        onClick={() => setIsCodeModalOpen(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
                            background: 'rgba(255,255,255,0.03)',
                            backdropFilter: 'blur(10px)',
                            border: `1px solid ${D.panelBorderSub}`,
                            borderRadius: 8, color: D.gold,
                            fontSize: 14, fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.3s', fontFamily: "'Inter', sans-serif",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(199,158,97,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = D.panelBorder; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = D.panelBorderSub; }}
                    >
                        <Hash size={14} />
                        <span>Código</span>
                    </button>

                    {/* Escanear QR button - gold filled */}
                    <button
                        onClick={() => setIsScannerOpen(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
                            background: `linear-gradient(135deg, ${D.gold} 0%, ${D.goldDark} 100%)`,
                            border: 'none', borderRadius: 8,
                            color: D.onGold,
                            fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            transition: 'all 0.3s', fontFamily: "'Inter', sans-serif",
                            boxShadow: `0 4px 16px rgba(199,158,97,0.4)`,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    >
                        <QrCode size={14} />
                        <span>Escanear QR</span>
                    </button>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        style={{
                            width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(228,1,35,0.1)', color: '#ff7b8a',
                            outline: '1px solid rgba(228,1,35,0.25)', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(228,1,35,0.25)'; el.style.color = '#fff'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(228,1,35,0.1)'; el.style.color = '#ff7b8a'; }}
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </header>

            {/* ══════════ BODY (below fixed header) ══════════ */}
            <div className="rec-body" style={{ display: 'flex', flex: 1, marginTop: 80, overflow: 'hidden' }}>

                {/* ══ LEFT PANEL: Search & Student Identification ══ */}
                <aside
                    className="rec-search-panel"
                    style={{
                        width: 400,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        padding: '32px 24px',
                        borderRight: '1px solid rgba(199,158,97,0.08)',
                        gap: 0,
                    }}
                >
                    {/* Search bar */}
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                        <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                            {loading ? (
                                <div style={{ width: 18, height: 18, border: `2px solid ${D.gold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'rec-spin 0.7s linear infinite' }} />
                            ) : (
                                <SearchIcon size={18} style={{ color: D.muted }} />
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="CPF, nome ou RA do aluno / responsável..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '14px 16px 14px 48px', borderRadius: 14, boxSizing: 'border-box',
                                border: `1px solid ${query ? D.panelBorder : 'rgba(199,158,97,0.1)'}`,
                                background: 'rgba(11,16,29,0.7)',
                                color: D.white, fontSize: 15, outline: 'none',
                                transition: 'all 0.3s',
                                fontFamily: "'Inter', sans-serif",
                            }}
                            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(71,184,255,0.6)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 16px rgba(71,184,255,0.4)'; }}
                            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = query ? D.panelBorder : 'rgba(199,158,97,0.1)'; (e.target as HTMLInputElement).style.boxShadow = 'none'; }}
                        />
                    </div>

                    {/* Search results dropdown */}
                    {results.length > 0 && !selectedStudent && (
                        <div style={{
                            background: D.panelBg,
                            backdropFilter: 'blur(20px)',
                            border: `1px solid ${D.panelBorder}`,
                            borderRadius: 12,
                            overflow: 'hidden',
                            marginBottom: 16,
                            boxShadow: `0 16px 48px rgba(0,0,0,0.5)`,
                        }}>
                            {results.map((student, idx) => (
                                <button
                                    key={student.id}
                                    onClick={() => handleSelectStudent(student)}
                                    style={{
                                        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        borderBottom: idx < results.length - 1 ? `1px solid rgba(199,158,97,0.1)` : 'none',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(199,158,97,0.06)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', border: `2px solid ${D.panelBorderSub}`, flexShrink: 0, background: 'rgba(17,24,43,0.8)' }}>
                                        {student.foto_url
                                            ? <img src={student.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={20} style={{ color: `rgba(199,158,97,0.4)` }} /></div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 14, fontWeight: 700, color: D.white, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.nome_completo}</p>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: D.gold, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{student.turma}</span>
                                            <span style={{ fontSize: 10, color: D.muted }}>·</span>
                                            <span style={{ fontSize: 10, fontWeight: 600, color: D.muted }}>{student.sala}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} style={{ color: D.muted, flexShrink: 0 }} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Active: Student Detail Panel ── */}
                    {hasSelection ? (
                        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.4s, transform 0.4s' }}>

                            {/* ════ RELATED MODE (from QR/Code) ════ */}
                            {isRelatedMode ? (
                                <div style={{
                                    background: D.panelBg,
                                    backdropFilter: 'blur(20px)',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    border: `1px solid ${D.panelBorder}`,
                                    boxShadow: `0 8px 40px rgba(0,0,0,0.4)`,
                                }}>
                                    <div style={{ height: 3, background: `linear-gradient(90deg, ${D.gold}, rgba(160,122,61,0.4), transparent)` }} />

                                    {/* Guardian hero */}
                                    <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${D.panelBorderSub}` }}>
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', border: `3px solid ${D.gold}`, boxShadow: `0 0 0 4px rgba(199,158,97,0.12)`, background: D.panelBg }}>
                                                {selectedGuardian?.foto_url
                                                    ? <img src={selectedGuardian.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setIsPhotoZoomed(true)} />
                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={26} style={{ color: `rgba(199,158,97,0.4)` }} /></div>}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: `rgba(199,158,97,0.6)` }}>Responsável Identificado</span>
                                            <h2 style={{ fontSize: 18, fontWeight: 900, color: D.white, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 2 }}>
                                                {selectedGuardian?.nome_completo || 'Grupo Familiar'}
                                            </h2>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: D.green, boxShadow: `0 0 6px ${D.green}` }} />
                                                <span style={{ fontSize: 10, fontWeight: 600, color: D.green }}>{relatedStudents.length} aluno{relatedStudents.length > 1 ? 's' : ''} vinculado{relatedStudents.length > 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleClearSelection}
                                            style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'rgba(228,1,35,0.12)', color: '#ff7b8a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: '1px solid rgba(228,1,35,0.25)', transition: 'all 0.18s', flexShrink: 0 }}
                                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(228,1,35,0.3)'; el.style.color = '#fff'; }}
                                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(228,1,35,0.12)'; el.style.color = '#ff7b8a'; }}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>

                                    {/* Students grid */}
                                    <div style={{ padding: '14px 18px' }}>
                                        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: `rgba(199,158,97,0.6)`, marginBottom: 10 }}>
                                            Selecionar alunos para chamar
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                                            {relatedStudents.map(student => {
                                                const isSel = selectedStudentIds.has(student.id);
                                                return (
                                                    <button key={student.id} onClick={() => toggleStudentSelection(student.id)} style={{
                                                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                                        background: isSel ? 'rgba(199,158,97,0.12)' : 'rgba(255,255,255,0.02)',
                                                        border: `1.5px solid ${isSel ? D.panelBorder : 'rgba(199,158,97,0.1)'}`,
                                                        borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
                                                    }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', border: `2px solid ${isSel ? D.gold : 'rgba(199,158,97,0.15)'}`, flexShrink: 0, background: D.panelBg, transition: 'border-color 0.18s' }}>
                                                            {student.foto_url ? <img src={student.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={16} style={{ color: 'rgba(199,158,97,0.35)' }} /></div>}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ fontSize: 11, fontWeight: 700, color: isSel ? D.white : D.muted, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 1 }}>{student.nome_completo}</p>
                                                            <p style={{ fontSize: 9, color: D.muted }}>{student.turma}</p>
                                                        </div>
                                                        <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: isSel ? D.gold : 'rgba(255,255,255,0.05)', border: `1.5px solid ${isSel ? D.gold : 'rgba(199,158,97,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
                                                            {isSel && <CheckCircle2 size={12} style={{ color: D.onGold }} />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Emergency toggle (QR/Code mode) */}
                                    <div style={{ padding: '0 18px 12px' }}>
                                        <button onClick={() => setIsEmergency(v => !v)} style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                            background: isEmergency ? 'rgba(228,1,35,0.1)' : 'rgba(255,255,255,0.02)',
                                            border: `1.5px solid ${isEmergency ? 'rgba(228,1,35,0.5)' : 'rgba(199,158,97,0.1)'}`,
                                            borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
                                        }}>
                                            <div style={{
                                                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                                background: isEmergency ? D.red : 'rgba(255,255,255,0.05)',
                                                border: `1.5px solid ${isEmergency ? D.red : 'rgba(199,158,97,0.15)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s',
                                            }}>
                                                {isEmergency && <CheckCircle2 size={11} style={{ color: '#fff' }} />}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: 11, fontWeight: 700, color: isEmergency ? '#ff7b8a' : D.muted, transition: 'color 0.18s' }}>Chamada de Emergência</p>
                                                <p style={{ fontSize: 9, color: D.muted, marginTop: 1 }}>Marca como prioridade crítica na sala</p>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Call button */}
                                    <div style={{ padding: '0 18px 18px' }}>
                                        <button
                                            onClick={handleCallStudents}
                                            disabled={sending || selectedStudentIds.size === 0}
                                            style={{
                                                width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                                background: selectedStudentIds.size > 0 ? `linear-gradient(135deg, ${D.gold} 0%, ${D.goldDark} 100%)` : 'rgba(255,255,255,0.05)',
                                                border: 'none', borderRadius: 9, cursor: selectedStudentIds.size > 0 ? 'pointer' : 'not-allowed',
                                                color: selectedStudentIds.size > 0 ? D.onGold : D.muted,
                                                fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: '0.04em',
                                                boxShadow: selectedStudentIds.size > 0 ? `0 6px 24px rgba(199,158,97,0.35)` : 'none',
                                                transition: 'all 0.2s',
                                            }}>
                                            {sending
                                                ? <div style={{ width: 18, height: 18, border: `2px solid ${D.onGold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'rec-spin 0.7s linear infinite' }} />
                                                : <><Bell size={15} /> {selectedStudentIds.size > 1 ? `Chamar ${selectedStudentIds.size} Alunos` : 'Chamar Aluno'}</>}
                                        </button>
                                    </div>
                                </div>

                            ) : (
                                /* ════ MANUAL MODE (from search) ════ */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                                    {/* Student hero card */}
                                    <div style={{
                                        background: D.panelBg,
                                        backdropFilter: 'blur(20px)',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        border: `1px solid ${D.panelBorder}`,
                                        boxShadow: `0 8px 40px rgba(0,0,0,0.4)`,
                                    }}>
                                        <div style={{ height: 3, background: `linear-gradient(90deg, ${D.gold}, transparent)` }} />
                                        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {/* Photo */}
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <div style={{ width: 62, height: 62, borderRadius: 12, overflow: 'hidden', border: `3px solid ${D.gold}`, boxShadow: `0 0 0 4px rgba(199,158,97,0.12)`, background: D.panelBg, cursor: selectedStudent?.foto_url ? 'pointer' : 'default' }} onClick={() => selectedStudent?.foto_url && setIsPhotoZoomed(true)}>
                                                    {selectedStudent?.foto_url ? <img src={selectedStudent.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={26} style={{ color: 'rgba(199,158,97,0.4)' }} /></div>}
                                                </div>
                                                {selectedStudent?.foto_url && <button onClick={() => setIsPhotoZoomed(true)} style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 5, background: D.gold, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={9} style={{ color: D.onGold }} /></button>}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(199,158,97,0.6)' }}>Aluno Identificado</span>
                                                <h2 style={{ fontSize: 16, fontWeight: 900, color: D.white, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 2 }}>
                                                    {selectedStudent?.nome_completo}
                                                </h2>
                                                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: D.gold, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{selectedStudent?.turma}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: D.muted }}>{selectedStudent?.sala}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleClearSelection}
                                                style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'rgba(228,1,35,0.12)', color: '#ff7b8a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: '1px solid rgba(228,1,35,0.25)', flexShrink: 0, transition: 'all 0.18s' }}
                                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(228,1,35,0.3)'; el.style.color = '#fff'; }}
                                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(228,1,35,0.12)'; el.style.color = '#ff7b8a'; }}
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>

                                        {/* Extra students chips */}
                                        {multiStudents.length > 0 && (
                                            <div style={{ padding: '0 16px 12px' }}>
                                                <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(199,158,97,0.6)', marginBottom: 6 }}>
                                                    Também serão chamados
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {multiStudents.map(s => (
                                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(199,158,97,0.08)', border: `1px solid ${D.panelBorderSub}`, borderRadius: 7 }}>
                                                            <div style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', background: D.panelBg, border: `1px solid rgba(199,158,97,0.2)`, flexShrink: 0 }}>
                                                                {s.foto_url ? <img src={s.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={10} style={{ color: 'rgba(199,158,97,0.4)' }} /></div>}
                                                            </div>
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: D.white }}>{s.nome_completo.split(' ')[0]}</span>
                                                            <span style={{ fontSize: 9, color: D.muted }}>{s.turma}</span>
                                                            <button onClick={() => handleRemoveMultiStudent(s.id)} style={{ width: 16, height: 16, borderRadius: 4, border: 'none', background: 'rgba(228,1,35,0.18)', color: '#ff7b8a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                                                <X size={9} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Add more students button / search */}
                                        <div style={{ padding: '0 16px 14px' }}>
                                            {!isAddingMore ? (
                                                <button onClick={() => setIsAddingMore(true)} style={{
                                                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                                                    background: 'rgba(255,255,255,0.03)', border: `1px dashed rgba(199,158,97,0.2)`,
                                                    borderRadius: 8, cursor: 'pointer', color: D.muted,
                                                    fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif",
                                                    transition: 'all 0.18s',
                                                }}
                                                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(199,158,97,0.08)'; el.style.borderColor = D.panelBorder; el.style.color = D.gold; }}
                                                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.03)'; el.style.borderColor = 'rgba(199,158,97,0.2)'; el.style.color = D.muted; }}
                                                >
                                                    <Plus size={12} /> Adicionar outro aluno a esta chamada
                                                </button>
                                            ) : (
                                                <div>
                                                    <div style={{ position: 'relative' }}>
                                                        <SearchIcon size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: D.muted, pointerEvents: 'none' }} />
                                                        <input
                                                            ref={addMoreInputRef}
                                                            type="text"
                                                            placeholder="Nome do aluno..."
                                                            value={addMoreQuery}
                                                            onChange={e => setAddMoreQuery(e.target.value)}
                                                            style={{
                                                                width: '100%', padding: '8px 32px 8px 32px', boxSizing: 'border-box',
                                                                background: 'rgba(0,0,0,0.25)', border: `1.5px solid ${D.panelBorder}`,
                                                                borderRadius: 8, fontSize: 12, fontWeight: 600, color: D.white, outline: 'none',
                                                                fontFamily: "'Inter', sans-serif",
                                                            }}
                                                        />
                                                        <button onClick={() => { setIsAddingMore(false); setAddMoreQuery(''); setAddMoreResults([]); }} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.06)', color: D.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                    {addMoreResults.length > 0 && (
                                                        <div style={{ background: 'rgba(11,16,29,0.9)', backdropFilter: 'blur(12px)', border: `1px solid ${D.panelBorderSub}`, borderRadius: 9, marginTop: 5, overflow: 'hidden' }}>
                                                            {addMoreResults.map((s, idx) => (
                                                                <button key={s.id} onClick={() => handleAddMoreStudent(s)} style={{
                                                                    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                                                    background: 'transparent', border: 'none', borderBottom: idx < addMoreResults.length - 1 ? `1px solid rgba(199,158,97,0.08)` : 'none',
                                                                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                                                                }}
                                                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(199,158,97,0.06)'; }}
                                                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                                                >
                                                                    <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', background: D.panelBg, border: `1px solid rgba(199,158,97,0.15)`, flexShrink: 0 }}>
                                                                        {s.foto_url ? <img src={s.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={14} style={{ color: 'rgba(199,158,97,0.35)' }} /></div>}
                                                                    </div>
                                                                    <div>
                                                                        <p style={{ fontSize: 12, fontWeight: 700, color: D.white }}>{s.nome_completo}</p>
                                                                        <p style={{ fontSize: 9, color: D.muted }}>{s.turma} · {s.sala}</p>
                                                                    </div>
                                                                    <Plus size={11} style={{ color: D.gold, marginLeft: 'auto' }} />
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
                                        <div style={{
                                            background: D.panelBg,
                                            backdropFilter: 'blur(20px)',
                                            borderRadius: 12,
                                            padding: '14px 16px',
                                            border: `1px solid ${D.panelBorder}`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(199,158,97,0.6)' }}>
                                                    Responsável Autorizado
                                                </p>
                                                {guardians.length === 0 && (
                                                    <span style={{ fontSize: 9, fontWeight: 600, color: D.muted, letterSpacing: '0.1em' }}>Nenhum cadastrado</span>
                                                )}
                                            </div>

                                            {guardians.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {guardians.map(g => {
                                                        const isSel = g.id === selectedGuardianId;
                                                        return (
                                                            <button key={g.id} onClick={() => setSelectedGuardianId(isSel ? null : g.id)} style={{
                                                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                                                background: isSel ? 'rgba(199,158,97,0.12)' : 'rgba(255,255,255,0.02)',
                                                                border: `1.5px solid ${isSel ? D.panelBorder : 'rgba(199,158,97,0.1)'}`,
                                                                borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
                                                            }}>
                                                                <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', border: `2px solid ${isSel ? D.gold : 'rgba(199,158,97,0.15)'}`, flexShrink: 0, background: D.panelBg }}>
                                                                    {g.foto_url ? <img src={g.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={16} style={{ color: 'rgba(199,158,97,0.35)' }} /></div>}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <p style={{ fontSize: 11, fontWeight: 700, color: isSel ? D.white : D.muted, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 1 }}>{g.nome_completo}</p>
                                                                    <span style={{ fontSize: 8, fontWeight: 700, color: isSel ? D.gold : D.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{g.parentesco || 'Autorizado'}</span>
                                                                </div>
                                                                <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: isSel ? D.gold : 'rgba(255,255,255,0.05)', border: `1.5px solid ${isSel ? D.gold : 'rgba(199,158,97,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
                                                                    {isSel && <CheckCircle2 size={11} style={{ color: D.onGold }} />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(228,1,35,0.06)', border: '1px solid rgba(228,1,35,0.2)', borderRadius: 9, marginBottom: 4 }}>
                                                    <UserX size={15} style={{ color: '#ff7b8a', flexShrink: 0 }} />
                                                    <p style={{ fontSize: 12, color: '#ff7b8a', fontWeight: 600 }}>Sem responsável cadastrado no sistema</p>
                                                </div>
                                            )}

                                            {/* Switch to manual */}
                                            <button onClick={() => { setUseManualPickup(true); setSelectedGuardianId(null); }} style={{
                                                display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '7px 10px',
                                                background: 'transparent', border: '1px dashed rgba(228,1,35,0.3)', borderRadius: 8,
                                                cursor: 'pointer', color: '#ff7b8a', fontSize: 11, fontWeight: 600,
                                                fontFamily: "'Inter', sans-serif", transition: 'all 0.18s',
                                            }}
                                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(228,1,35,0.08)'; el.style.borderColor = 'rgba(228,1,35,0.5)'; }}
                                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'rgba(228,1,35,0.3)'; }}
                                            >
                                                <PenLine size={11} /> Responsável não cadastrado — inserir nome manualmente
                                            </button>
                                        </div>
                                    )}

                                    {/* ── Manual pickup name panel ── */}
                                    {useManualPickup && (
                                        <div style={{
                                            background: D.panelBg,
                                            backdropFilter: 'blur(20px)',
                                            borderRadius: 12,
                                            padding: '14px 16px',
                                            border: '1.5px solid rgba(228,1,35,0.35)',
                                            boxShadow: '0 4px 20px rgba(228,1,35,0.1)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(228,1,35,0.12)', border: '1px solid rgba(228,1,35,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <PenLine size={12} style={{ color: '#ff7b8a' }} />
                                                    </div>
                                                    <div>
                                                        <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.26em', textTransform: 'uppercase', color: '#ff7b8a' }}>Retirada Avulsa</p>
                                                        <p style={{ fontSize: 10, fontWeight: 600, color: D.muted, marginTop: 1 }}>Responsável não cadastrado</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => { setUseManualPickup(false); setManualPickupName(''); }} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.05)', color: D.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <X size={11} />
                                                </button>
                                            </div>

                                            <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(199,158,97,0.65)', display: 'block', marginBottom: 7 }}>
                                                Nome de quem está retirando *
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Nome completo do responsável presente"
                                                value={manualPickupName}
                                                onChange={e => setManualPickupName(e.target.value)}
                                                autoFocus
                                                style={{
                                                    width: '100%', padding: '10px 13px', boxSizing: 'border-box',
                                                    background: 'rgba(0,0,0,0.25)',
                                                    border: `1.5px solid ${manualPickupName.length >= 2 ? D.panelBorder : 'rgba(255,255,255,0.1)'}`,
                                                    borderRadius: 9, fontSize: 13, fontWeight: 600, color: D.white, outline: 'none',
                                                    fontFamily: "'Inter', sans-serif", transition: 'border-color 0.18s',
                                                }}
                                                onFocus={e => (e.target as HTMLInputElement).style.borderColor = D.panelBorder}
                                                onBlur={e => (e.target as HTMLInputElement).style.borderColor = manualPickupName.length >= 2 ? D.panelBorder : 'rgba(255,255,255,0.1)'}
                                            />
                                            <p style={{ fontSize: 10, color: D.muted, marginTop: 6, lineHeight: 1.5 }}>
                                                Registrado como <span style={{ color: '#ff7b8a', fontWeight: 700 }}>Retirada Avulsa</span> para fins de auditoria.
                                            </p>
                                        </div>
                                    )}

                                    {/* Status feedback */}
                                    <div style={{ padding: '9px 14px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 9, background: canCall ? 'rgba(52,211,153,0.06)' : 'rgba(199,158,97,0.06)', border: `1px solid ${canCall ? 'rgba(52,211,153,0.25)' : 'rgba(199,158,97,0.2)'}` }}>
                                        {canCall
                                            ? <><CheckCircle2 size={15} style={{ color: D.green, flexShrink: 0 }} /><div><p style={{ fontSize: 11, fontWeight: 700, color: D.green }}>Pronto para chamar</p><p style={{ fontSize: 9, color: D.muted }}>{totalManualCount} aluno{totalManualCount > 1 ? 's' : ''} · {useManualPickup ? manualPickupName.trim() : selectedGuardian?.nome_completo}</p></div></>
                                            : <><AlertCircle size={15} style={{ color: D.gold, flexShrink: 0 }} /><p style={{ fontSize: 11, fontWeight: 600, color: D.gold }}>{useManualPickup ? 'Digite o nome de quem está retirando' : 'Selecione um responsável ou use retirada avulsa'}</p></>
                                        }
                                    </div>

                                    {/* Emergency toggle (manual mode) */}
                                    <button onClick={() => setIsEmergency(v => !v)} style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                        background: isEmergency ? 'rgba(228,1,35,0.1)' : 'rgba(255,255,255,0.02)',
                                        border: `1.5px solid ${isEmergency ? 'rgba(228,1,35,0.5)' : 'rgba(199,158,97,0.1)'}`,
                                        borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
                                    }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                            background: isEmergency ? D.red : 'rgba(255,255,255,0.05)',
                                            border: `1.5px solid ${isEmergency ? D.red : 'rgba(199,158,97,0.15)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s',
                                        }}>
                                            {isEmergency && <CheckCircle2 size={12} style={{ color: '#fff' }} />}
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 11, fontWeight: 700, color: isEmergency ? '#ff7b8a' : D.muted, transition: 'color 0.18s' }}>Chamada de Emergência</p>
                                            <p style={{ fontSize: 9, color: D.muted, marginTop: 1 }}>Marca como prioridade crítica na sala</p>
                                        </div>
                                    </button>

                                    {/* Call button (manual mode) */}
                                    <button onClick={handleCallStudents} disabled={sending || !canCall} style={{
                                        width: '100%', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                        background: canCall ? `linear-gradient(135deg, ${D.gold} 0%, ${D.goldDark} 100%)` : 'rgba(255,255,255,0.05)',
                                        border: 'none', borderRadius: 11, cursor: canCall ? 'pointer' : 'not-allowed',
                                        color: canCall ? D.onGold : D.muted,
                                        fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: '0.02em',
                                        boxShadow: canCall ? `0 6px 24px rgba(199,158,97,0.35)` : 'none',
                                        transition: 'all 0.2s',
                                    }}>
                                        {sending
                                            ? <div style={{ width: 18, height: 18, border: `2px solid ${D.onGold}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'rec-spin 0.7s linear infinite' }} />
                                            : <><Bell size={16} /> {totalManualCount > 1 ? `Chamar ${totalManualCount} Alunos` : 'Chamar Aluno'}</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : results.length === 0 ? (
                        /* ════ COMPACT EMPTY STATE ════ */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 16px', opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.15s' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(199,158,97,0.08)', border: `1px solid rgba(199,158,97,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <SearchIcon size={22} style={{ color: D.gold }} />
                            </div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: D.white, marginBottom: 6 }}>Identificação Pendente</p>
                            <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, maxWidth: 240 }}>Pesquise por nome, CPF ou RA para localizar o aluno ou responsável</p>
                            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 20 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52D399', animation: 'rec-pulse 2s infinite ease-in-out', boxShadow: '0 0 8px #52D399' }} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#A3E6D0', textTransform: 'uppercase', letterSpacing: 1 }}>Monitoramento Ativo</span>
                            </div>
                        </div>
                    ) : null}
                </aside>

                {/* ══ MAIN PANEL: Withdrawal Queue (expanded) ══ */}
                <main
                    className="rec-queue-main"
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        padding: '32px 40px',
                    }}
                >
                    <WithdrawalQueue />
                </main>
            </div>

            {/* ══════════ MODALS ══════════ */}
            <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleQRScan} />
            {isCodeModalOpen && <CodeModal onConfirm={handleCodeLookup} onClose={() => setIsCodeModalOpen(false)} />}

            {/* Photo zoom modal */}
            {isPhotoZoomed && (selectedStudent?.foto_url || selectedGuardian?.foto_url) && (
                <div onClick={() => setIsPhotoZoomed(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(7,10,20,0.95)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <div style={{ position: 'relative', maxWidth: 640, width: '100%', aspectRatio: '1', borderRadius: 28, overflow: 'hidden', border: `3px solid ${D.panelBorder}`, boxShadow: `0 0 80px rgba(199,158,97,0.15)` }}>
                        <img src={(isRelatedMode ? selectedGuardian?.foto_url : selectedStudent?.foto_url) || undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => setIsPhotoZoomed(false)} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 10, background: 'rgba(7,10,20,0.7)', border: `1px solid ${D.panelBorderSub}`, color: D.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                            <X size={18} />
                        </button>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 20px 20px', background: 'linear-gradient(to top, rgba(7,10,20,0.9), transparent)' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: `rgba(199,158,97,0.7)`, marginBottom: 4 }}>Identificação SISRA</p>
                            <p style={{ fontSize: 22, fontWeight: 900, color: D.white }}>
                                {isRelatedMode ? selectedGuardian?.nome_completo : selectedStudent?.nome_completo}
                            </p>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { User, ArrowRight, ShieldCheck, Loader2, Smartphone, Lock, CheckCircle2, Bell } from 'lucide-react';
import { logAudit } from '../../lib/audit';

// ── Design tokens matching the reference design ────────────────────────────
const token = {
    bgDeep: '#070a13',
    bgGlass: 'rgba(17, 24, 43, 0.65)',
    bgBadge: 'rgba(17, 24, 43, 0.85)',
    cyan: '#47b8ff',
    gold: '#c79e61',
    bluePrimary: '#3174f1',
    blueHover: '#4e8eff',
    textMain: '#FFFFFF',
    textMuted: '#8491A2',
    borderMuted: 'rgba(255,255,255,0.05)',
    cyanBorder: 'rgba(71,184,255,0.55)',
    goldBorder: 'rgba(199,158,97,0.55)',
} as const;

// ── Shared style helpers ───────────────────────────────────────────────────
const glassPanel: React.CSSProperties = {
    background: token.bgGlass,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: 'inset 0 0 10px rgba(255,255,255,0.02), 0 4px 15px rgba(0,0,0,0.25)',
};

const badgeStyle: React.CSSProperties = {
    background: token.bgBadge,
    border: `1px solid ${token.borderMuted}`,
    borderRadius: '30px',
    padding: '10px 20px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: token.textMuted,
    boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
};

export default function ParentLogin() {
    const toast = useToast();
    const navigate = useNavigate();
    const [cpf, setCpf] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'CPF' | 'SELECT_STUDENT' | 'SUCCESS'>('CPF');
    const [students, setStudents] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [guardianName, setGuardianName] = useState('');
    const [guardianId, setGuardianId] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const cleanCpf = cpf.replace(/\D/g, '');

            const { data: responsavel, error: respError } = await supabase
                .from('responsaveis')
                .select('id, nome_completo')
                .eq('cpf', cleanCpf)
                .single();

            if (respError || !responsavel) {
                throw new Error('Responsável não encontrado. Verifique o CPF informado.');
            }

            setGuardianId(responsavel.id);
            setGuardianName(responsavel.nome_completo);

            const { data: links, error: linkError } = await supabase
                .from('alunos_responsaveis')
                .select(`
                    aluno:alunos (
                        id,
                        nome_completo,
                        turma,
                        foto_url,
                        escola_id
                    )
                `)
                .eq('responsavel_id', responsavel.id);

            if (linkError) throw linkError;

            if (!links || links.length === 0) {
                throw new Error('Identificamos seu CPF, mas não há estudantes vinculados a ele. Por favor, entre em contato com a secretaria da escola para regularizar seu cadastro.');
            }

            const foundStudents = links.map((l: any) => l.aluno);
            setStudents(foundStudents);
            setSelectedIds(new Set(foundStudents.map((s: any) => s.id)));
            setStep('SELECT_STUDENT');

            localStorage.setItem('sisra_parent_session', JSON.stringify({
                id: responsavel.id,
                nome: responsavel.nome_completo,
            }));

            logAudit(
                'LOGIN_SUCESSO',
                'responsaveis',
                responsavel.id,
                {
                    metodo: 'PORTAL_GUARDIÃO_CPF',
                    nome: responsavel.nome_completo,
                    alunos_vinculados: links.length
                },
                responsavel.id
            );

        } catch (err: any) {
            setError(err.message || 'Falha na verificação de sinal.');
        } finally {
            setLoading(false);
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedIds((prev: Set<string>) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleCallStudents = async () => {
        if (selectedIds.size === 0 || sending) return;
        setSending(true);

        try {
            const requests = Array.from(selectedIds).map((id: string) => {
                const student = students.find((s: any) => s.id === id);
                if (!student) throw new Error('Falha de segurança: Tentativa de retirar aluno não vinculado.');

                return {
                    escola_id: student.escola_id || 'e6328325-1845-420a-b333-87a747953259',
                    aluno_id: id,
                    responsavel_id: guardianId,
                    recepcionista_id: null,
                    status: 'SOLICITADO',
                    tipo_solicitacao: 'ROTINA'
                };
            });

            const { error } = await supabase
                .from('solicitacoes_retirada')
                .insert(requests);

            if (error) throw error;

            logAudit(
                'SOLICITACAO_RETIRADA',
                'solicitacoes_retirada',
                undefined,
                {
                    responsavel_id: guardianId,
                    qtd_alunos: selectedIds.size,
                    alunos_ids: Array.from(selectedIds),
                    origem: 'PORTAL_GUARDIÃO'
                },
                guardianId
            );

            toast.success(
                selectedIds.size === 1 ? 'Solicitação enviada!' : `${selectedIds.size} solicitações enviadas!`,
                'Acompanhando sua chegada em tempo real.'
            );

            const firstId = Array.from(selectedIds)[0];
            navigate(`/parent/status/${firstId}`);
        } catch (err: any) {
            toast.error('Erro ao solicitar', err.message || 'Tente novamente.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div
            className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: token.bgDeep, fontFamily: "'Inter', sans-serif" }}
        >
            {/* Radial gradient blobs */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage: `
                        radial-gradient(circle at 10% 10%, #1a2540 0%, transparent 40%),
                        radial-gradient(circle at 90% 90%, #0d121f 0%, transparent 40%)
                    `,
                    zIndex: 0,
                }}
            />
            {/* Micro-grid */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage: `repeating-linear-gradient(rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 15px)`,
                    backgroundSize: '15px 15px',
                    zIndex: 0,
                }}
            />

            {/* Content wrapper */}
            <div className="relative z-10 w-full flex flex-col items-center" style={{ padding: '32px 20px', gap: '32px', maxWidth: '520px', margin: '0 auto' }}>

                {/* Header Badge */}
                <header style={badgeStyle}>
                    <Smartphone style={{ color: token.cyan, width: 18, height: 18 }} />
                    <span>PORTAL DO GUARDIÃO&nbsp;<strong style={{ color: token.textMain }}>V{__APP_VERSION__}</strong></span>
                </header>

                {/* Title */}
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: 'clamp(26px, 6vw, 40px)', fontWeight: 700, color: token.textMain, marginBottom: 8, letterSpacing: '-0.5px' }}>
                        IDENTIFICAÇÃO DE ACESSO
                    </h1>
                    <p style={{ fontSize: 13, color: token.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1.5px' }}>
                        • PROTOCOLO DE RETIRADA SEGURO
                    </p>
                </div>

                {/* Auth Panel — gradient border trick */}
                <div className="w-full relative" style={{ borderRadius: 14 }}>
                    {/* Glowing gradient border layer */}
                    <div
                        className="absolute"
                        style={{
                            inset: -2,
                            borderRadius: 14,
                            background: `linear-gradient(135deg, ${token.cyanBorder} 0%, ${token.goldBorder} 100%)`,
                            filter: 'blur(4px)',
                            opacity: 0.65,
                            zIndex: 0,
                        }}
                    />
                    {/* Glass panel */}
                    <div
                        className="relative w-full flex flex-col items-center"
                        style={{
                            ...glassPanel,
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.07)',
                            zIndex: 1,
                            padding: 'clamp(24px, 5vw, 44px) clamp(20px, 5vw, 36px)',
                            gap: 28,
                        }}
                    >
                        {/* ── STEP: CPF ── */}
                        {step === 'CPF' && (
                            <form onSubmit={handleSearch} className="w-full flex flex-col items-center" style={{ gap: 24 }}>

                                {/* Label */}
                                <div className="w-full flex items-center" style={{ gap: 10 }}>
                                    <Lock style={{ color: token.cyan, width: 16, height: 16 }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                        CPF DO RESPONSÁVEL
                                    </span>
                                </div>

                                {/* CPF Input */}
                                <div
                                    className="w-full"
                                    style={{
                                        background: 'rgba(11,16,29,0.7)',
                                        border: '1px solid rgba(199,158,97,0.22)',
                                        borderRadius: 8,
                                        padding: '16px 20px',
                                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.12), 0 0 10px rgba(199,158,97,0.08)',
                                    }}
                                >
                                    <input
                                        id="cpf-input"
                                        type="text"
                                        value={cpf}
                                        onChange={(e) => setCpf(e.target.value)}
                                        placeholder="000.000.000-00"
                                        required
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            fontSize: 'clamp(22px, 6vw, 32px)',
                                            fontWeight: 700,
                                            color: token.cyan,
                                            letterSpacing: '3px',
                                            textAlign: 'center',
                                            fontFamily: "'Inter', monospace",
                                        }}
                                    />
                                </div>

                                {/* Security badge */}
                                <div style={{ ...badgeStyle, padding: '7px 16px', fontSize: 11 }}>
                                    <ShieldCheck style={{ color: token.cyan, width: 15, height: 15 }} />
                                    <span>PROTOCOLO DE SEGURANÇA SSL/TLS ATIVO</span>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div
                                        className="w-full"
                                        style={{
                                            background: 'rgba(239,68,68,0.08)',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            borderRadius: 8,
                                            padding: '14px 18px',
                                        }}
                                    >
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {error}
                                        </p>
                                    </div>
                                )}

                                {/* Submit button */}
                                <button
                                    id="verify-button"
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex items-center justify-center transition-all"
                                    style={{
                                        borderRadius: 30,
                                        background: `linear-gradient(135deg, ${token.bluePrimary} 0%, ${token.blueHover} 100%)`,
                                        border: 'none',
                                        padding: '16px 24px',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: token.textMain,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.2px',
                                        gap: 12,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.6 : 1,
                                        boxShadow: '0 4px 18px rgba(49,116,241,0.32)',
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                                            VERIFICANDO...
                                        </>
                                    ) : (
                                        <>
                                            VERIFICAR IDENTIDADE
                                            <ArrowRight style={{ width: 18, height: 18 }} />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* ── STEP: SELECT STUDENT ── */}
                        {step === 'SELECT_STUDENT' && (
                            <div className="w-full flex flex-col" style={{ gap: 24 }}>
                                {/* Header */}
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: token.cyan, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>
                                        IDENTIDADE CONFIRMADA
                                    </p>
                                    <h3 style={{ fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 700, color: token.textMain, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
                                        {guardianName.split(' ')[0]}, quem você vai buscar?
                                    </h3>
                                </div>

                                {/* Student list */}
                                <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '38vh', overflowY: 'auto' }}>
                                    {students.map((student) => {
                                        const isSelected = selectedIds.has(student.id);
                                        return (
                                            <button
                                                id={`student-${student.id}`}
                                                key={student.id}
                                                onClick={() => toggleStudent(student.id)}
                                                className="w-full flex items-center text-left transition-all"
                                                style={{
                                                    gap: 16,
                                                    padding: '16px 18px',
                                                    borderRadius: 12,
                                                    border: isSelected ? `2px solid ${token.cyan}` : '2px solid rgba(255,255,255,0.06)',
                                                    background: isSelected ? 'rgba(71,184,255,0.08)' : 'rgba(255,255,255,0.02)',
                                                    cursor: 'pointer',
                                                    boxShadow: isSelected ? `0 0 12px rgba(71,184,255,0.12)` : 'none',
                                                }}
                                            >
                                                {/* Avatar */}
                                                <div
                                                    style={{
                                                        width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                                                        border: isSelected ? `2px solid ${token.cyan}` : '2px solid rgba(255,255,255,0.08)',
                                                    }}
                                                >
                                                    {student.foto_url ? (
                                                        <img src={student.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <User style={{ width: 22, height: 22, color: '#4b5563' }} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontWeight: 700, color: isSelected ? token.cyan : token.textMain, textTransform: 'uppercase', fontSize: 15, letterSpacing: '-0.3px' }}>
                                                        {student.nome_completo}
                                                    </p>
                                                    <p style={{ fontSize: 10, fontWeight: 600, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 3 }}>
                                                        Turma: {student.turma}
                                                    </p>
                                                </div>

                                                {/* Checkbox */}
                                                <div
                                                    style={{
                                                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: isSelected ? token.cyan : 'transparent',
                                                        border: isSelected ? `2px solid ${token.cyan}` : '2px solid rgba(255,255,255,0.1)',
                                                        transition: 'all 0.25s ease',
                                                    }}
                                                >
                                                    {isSelected && <CheckCircle2 style={{ width: 16, height: 16, color: '#000' }} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Divider */}
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                                {/* Call button */}
                                <button
                                    onClick={handleCallStudents}
                                    disabled={selectedIds.size === 0 || sending}
                                    className="w-full flex items-center justify-center transition-all"
                                    style={{
                                        borderRadius: 30,
                                        background: `linear-gradient(135deg, ${token.bluePrimary} 0%, ${token.blueHover} 100%)`,
                                        border: 'none',
                                        padding: '18px 24px',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: token.textMain,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.2px',
                                        gap: 12,
                                        cursor: (selectedIds.size === 0 || sending) ? 'not-allowed' : 'pointer',
                                        opacity: (selectedIds.size === 0 || sending) ? 0.4 : 1,
                                        boxShadow: '0 4px 18px rgba(49,116,241,0.32)',
                                    }}
                                >
                                    {sending ? (
                                        <>
                                            <Loader2 style={{ width: 20, height: 20 }} className="animate-spin" />
                                            PROCESSANDO...
                                        </>
                                    ) : (
                                        <>
                                            <Bell style={{ width: 20, height: 20 }} />
                                            {selectedIds.size > 1 ? `CHAMAR ${selectedIds.size} ALUNOS` : 'CHAMAR AGORA'}
                                        </>
                                    )}
                                </button>

                                {/* Back */}
                                <button
                                    onClick={() => setStep('CPF')}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: token.textMuted,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '2px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        padding: '8px 0',
                                    }}
                                >
                                    Alterar Protocolo / Não sou eu
                                </button>
                            </div>
                        )}

                        {/* ── STEP: SUCCESS ── */}
                        {step === 'SUCCESS' && (
                            <div className="w-full flex flex-col items-center" style={{ gap: 24, padding: '16px 0', textAlign: 'center' }}>
                                <div style={{ position: 'relative', width: 88, height: 88 }}>
                                    <div style={{ position: 'absolute', inset: -8, background: 'rgba(52,211,153,0.18)', borderRadius: '50%', filter: 'blur(18px)' }} />
                                    <div style={{ position: 'relative', width: 88, height: 88, background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(16,185,129,0.4)' }}>
                                        <CheckCircle2 style={{ width: 44, height: 44, color: '#fff' }} />
                                    </div>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 28, fontWeight: 700, color: token.textMain, textTransform: 'uppercase', letterSpacing: '-0.5px', marginBottom: 8 }}>
                                        Solicitação Concluída!
                                    </h3>
                                    <p style={{ color: token.textMuted, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1.7 }}>
                                        Notificações enviadas.<br />Aguarde na área de saída.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setStep('CPF')}
                                    style={{
                                        marginTop: 8,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 12,
                                        padding: '14px 28px',
                                        color: token.textMuted,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1.5px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Iniciar Nova Retirada
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <footer
                    className="w-full flex flex-wrap items-center justify-between"
                    style={{ gap: 16, fontSize: 11, fontWeight: 600, color: token.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: token.gold, fontSize: 15 }}>⚙</span>
                        <span>SISTEMA DE RETIRADA SISRA // V{__APP_VERSION__}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: token.gold, fontSize: 15 }}>⬡</span>
                        <span>STATUS DO LINK:</span>
                        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                                style={{ display: 'inline-block', width: 7, height: 7, background: '#34d399', borderRadius: '50%' }}
                                className="animate-pulse"
                            />
                            ESTÁVEL
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    );
}

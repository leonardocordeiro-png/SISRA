import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { User as UserIcon, Check, Search, ArrowDownNarrowWide, Clock, ChevronDown, ChevronUp, MapPin, Building2 } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface Aluno {
    id: string;
    nome_completo: string;
    turma: string;
    sala: string;
    foto_url: string | null;
    observacoes: string | null;
}

interface RequestItem {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    aluno: Aluno;
    responsavel: {
        nome_completo: string;
        foto_url: string | null;
    } | null;
    mensagem_recepcao: string | null;
    mensagem_sala: string | null;
    status_geofence: string | null;
    distancia_estimada_metros: number | null;
}

interface PriorityPipelineProps {
    selectedClass: string;
    activeRequestId?: string;
    onSelectRequest: (request: RequestItem) => void;
    onQueueChange?: (requests: RequestItem[]) => void;
    userId: string;
    escolaId?: string;
}

// ── Geofence helper ────────────────────────────────────────────────────────────
const isAtReception = (req: RequestItem) => req.status_geofence === 'CHEGOU';

export default function PriorityPipeline({
    selectedClass,
    activeRequestId,
    onSelectRequest,
    onQueueChange,
    userId,
    escolaId
}: PriorityPipelineProps) {
    const toast = useToast();
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    async function fetchRequests() {
        let query = supabase
            .from('solicitacoes_retirada')
            .select(`
                id,
                status,
                tipo_solicitacao,
                horario_solicitacao,
                aluno:alunos!inner (
                    id,
                    nome_completo,
                    turma,
                    sala,
                    foto_url,
                    observacoes
                ),
                responsavel:responsaveis (
                    nome_completo,
                    foto_url
                ),
                mensagem_recepcao,
                mensagem_sala,
                status_geofence,
                distancia_estimada_metros
            `)
            .in('status', ['SOLICITADO', 'AGUARDANDO']);

        if (selectedClass !== 'TODAS') {
            if (selectedClass.startsWith('Sala ')) {
                query = query.eq('alunos.sala', selectedClass);
            } else {
                query = query.eq('alunos.turma', selectedClass);
            }
        }

        if (escolaId) {
            query = query.eq('escola_id', escolaId);
        }

        const { data, error } = await query.order('horario_solicitacao', { ascending: true });

        if (!error && data) {
            const typedData = data as unknown as RequestItem[];
            setRequests(typedData);
            if (onQueueChange) onQueueChange(typedData);
        }
        setLoading(false);
    }

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return requests;
        return requests.filter(req =>
            req.aluno.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.aluno.turma.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [requests, searchTerm]);

    // ── Split into two priority groups ────────────────────────────────────────
    const atReceptionGroup = useMemo(() => filteredRequests.filter(isAtReception), [filteredRequests]);
    const inTransitGroup   = useMemo(() => filteredRequests.filter(r => !isAtReception(r)), [filteredRequests]);

    async function handleLiberarTodos() {
        if (requests.length === 0) return;

        const ids = requests.map(r => r.id);

        const { error } = await supabase
            .from('solicitacoes_retirada')
            .update({
                status: 'LIBERADO',
                professor_id: userId,
                horario_liberacao: new Date().toISOString()
            })
            .in('id', ids);

        if (!error) {
            fetchRequests();
            toast.success('Todos os alunos liberados com sucesso!');
        } else {
            toast.error('Erro ao liberar alunos', error.message);
        }
    }

    useEffect(() => {
        if (!userId) return;

        fetchRequests();

        const interval = setInterval(() => {
            fetchRequests();
        }, 1500);

        const channel = supabase
            .channel(`pipeline_room_${selectedClass}_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'solicitacoes_retirada'
                },
                () => {
                    fetchRequests();
                }
            )
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [selectedClass, userId, escolaId]);

    // ── Request card ───────────────────────────────────────────────────────────
    const renderCard = (req: RequestItem, idx: number, globalOffset = 0) => {
        const isActive   = activeRequestId === req.id;
        const atRecep    = isAtReception(req);
        const isWaiting  = req.status === 'AGUARDANDO';

        // Border color when inactive: green for at reception, amber for in transit
        const inactiveBorder = atRecep
            ? 'border-emerald-500/40 hover:border-emerald-400/70'
            : 'border-amber-500/20 hover:border-amber-400/50';

        const inactiveBg = atRecep
            ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]'
            : 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]';

        return (
            <button
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className={`w-72 md:w-full group relative p-4 rounded-[1.5rem] border-2 transition-all duration-500 flex items-start gap-4 text-left shrink-0 overflow-hidden ${
                    isActive
                        ? 'bg-emerald-500 border-emerald-400 shadow-[0_15px_40px_rgba(16,185,129,0.25)] scale-[1.02] z-10'
                        : `${inactiveBg} ${inactiveBorder} hover:translate-x-1`
                }`}
            >
                {/* Active shimmer */}
                {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
                )}

                {/* Left priority stripe */}
                {!isActive && (
                    <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${atRecep ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`} />
                )}

                {/* Avatar */}
                <div className="relative shrink-0 ml-1">
                    <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all duration-500 ${
                        isActive
                            ? 'border-white/50 scale-110 shadow-lg'
                            : atRecep
                                ? 'border-emerald-500/40 group-hover:border-emerald-400/80'
                                : 'border-amber-500/30 group-hover:border-amber-400/60'
                    }`}>
                        {req.aluno.foto_url ? (
                            <img src={req.aluno.foto_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center ${
                                isActive ? 'bg-emerald-600' : 'bg-slate-900 shadow-inner'
                            }`}>
                                <UserIcon className={`w-7 h-7 ${
                                    isActive ? 'text-white/80' : atRecep ? 'text-emerald-600/50 group-hover:text-emerald-500/70' : 'text-amber-600/40 group-hover:text-amber-500/60'
                                }`} />
                            </div>
                        )}
                    </div>

                    {/* Position badge */}
                    <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border-2 transition-all duration-500 ${
                        isActive
                            ? 'bg-white text-emerald-600 border-emerald-600 scale-110 shadow-lg'
                            : atRecep
                                ? 'bg-slate-900 text-emerald-400 border-white/10 group-hover:bg-emerald-500 group-hover:text-slate-900 group-hover:border-emerald-400'
                                : 'bg-slate-900 text-amber-400 border-white/10 group-hover:bg-amber-500 group-hover:text-slate-900 group-hover:border-amber-400'
                    }`}>
                        {globalOffset + idx + 1}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p
                        className={`font-black uppercase italic tracking-tighter leading-snug mb-1.5 text-sm ${isActive ? 'text-slate-950' : 'text-white'}`}
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    >
                        {req.aluno.nome_completo}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Turma badge */}
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md shrink-0 ${isActive ? 'bg-slate-950/20' : 'bg-white/5'}`}>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-slate-950' : 'text-slate-400'}`}>
                                {req.aluno.turma}
                            </span>
                        </div>

                        {/* NA RECEPÇÃO badge — green */}
                        {atRecep && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0 ${
                                isActive
                                    ? 'bg-slate-950/20'
                                    : 'bg-emerald-500/15 border border-emerald-500/40'
                            }`}>
                                <Building2 className={`w-2.5 h-2.5 ${isActive ? 'text-slate-950' : 'text-emerald-400'}`} />
                                <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-slate-950' : 'text-emerald-400'}`}>
                                    NA RECEPÇÃO
                                </span>
                                {!isActive && <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse ml-0.5" />}
                            </div>
                        )}

                        {/* EM DESLOCAMENTO badge — amber */}
                        {!atRecep && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0 ${
                                isActive
                                    ? 'bg-slate-950/20'
                                    : 'bg-amber-500/10 border border-amber-500/30'
                            }`}>
                                <MapPin className={`w-2.5 h-2.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                                <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-slate-950' : 'text-amber-400'}`}>
                                    EM DESLOCAMENTO
                                </span>
                            </div>
                        )}

                        {/* EM ESPERA badge */}
                        {isWaiting && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md shrink-0 ${isActive ? 'bg-slate-950/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                                <Clock className={`w-3 h-3 ${isActive ? 'text-slate-950' : 'text-blue-400'}`} />
                                <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-slate-950' : 'text-blue-400'}`}>EM ESPERA</span>
                            </div>
                        )}
                    </div>
                </div>

                {isActive && (
                    <div className="shrink-0 animate-in fade-in zoom-in duration-500">
                        <div className="w-8 h-8 rounded-full bg-slate-950/20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-slate-950 rounded-full animate-ping" />
                        </div>
                    </div>
                )}
            </button>
        );
    };

    // ── Section header ─────────────────────────────────────────────────────────
    const SectionHeader = ({
        label, count, colorClass, dotClass,
    }: { label: string; count: number; colorClass: string; dotClass: string }) => (
        <div className="flex items-center gap-2 px-1 py-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${colorClass}`}>{label}</span>
            <div className={`flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-black ${dotClass.replace('bg-', 'bg-').replace('animate-pulse', '')} bg-opacity-20 ${colorClass}`}>
                {count}
            </div>
            <div className="flex-1 h-px bg-white/5" />
        </div>
    );

    return (
        <div className="w-full md:w-[400px] border-b md:border-b-0 md:border-r border-white/10 bg-slate-950/40 backdrop-blur-3xl flex flex-col z-20 shrink-0 relative overflow-hidden">

            {/* Mobile toggle bar */}
            <button
                className="md:hidden flex items-center justify-between px-5 py-3 border-b border-white/10 w-full text-left"
                onClick={() => setIsMobileOpen(prev => !prev)}
                aria-expanded={isMobileOpen}
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Fila</span>
                    </div>
                    <span className="text-sm font-black text-white tabular-nums">{requests.length} aluno{requests.length !== 1 ? 's' : ''}</span>
                </div>
                {isMobileOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Main content */}
            <div className={`md:flex md:flex-col md:flex-1 md:min-h-0 md:overflow-hidden ${isMobileOpen ? 'flex flex-col max-h-[60vh] overflow-hidden' : 'hidden'}`}>

                {/* HUD Header */}
                <div className="p-6 border-b border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.25em] mb-1">Gestão de Fila</h3>
                            <p className="text-lg font-black italic text-white tracking-tighter uppercase leading-none">Fila de Prioridade</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">AO VIVO</span>
                        </div>
                    </div>

                    {/* Legend */}
                    {requests.length > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Na Recepção ({atReceptionGroup.length})</span>
                            </div>
                            <div className="w-px h-3 bg-white/10" />
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                                <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Em Deslocamento ({inTransitGroup.length})</span>
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="LOCALIZAR ALUNO NO CICLO..."
                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                        />
                    </div>
                </div>

                {/* List area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative">
                    {loading && requests.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-40">
                            <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizando Dados...</p>
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <ArrowDownNarrowWide className="w-10 h-10 text-slate-600" />
                            </div>
                            <h4 className="text-sm font-black text-white uppercase italic mb-2">Ciclo de Espera Vazio</h4>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Nenhum aluno aguardando transmissão no momento.</p>
                        </div>
                    ) : (
                        <div className="flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0">

                            {/* ── Group 1: NA RECEPÇÃO (priority) ──────────────── */}
                            {atReceptionGroup.length > 0 && (
                                <>
                                    <SectionHeader
                                        label="Na Recepção — Aguardando Liberação"
                                        count={atReceptionGroup.length}
                                        colorClass="text-emerald-400"
                                        dotClass="bg-emerald-400 animate-pulse"
                                    />
                                    {atReceptionGroup.map((req, idx) =>
                                        renderCard(req, idx, 0)
                                    )}
                                </>
                            )}

                            {/* ── Divider between groups ───────────────────────── */}
                            {atReceptionGroup.length > 0 && inTransitGroup.length > 0 && (
                                <div className="hidden md:flex items-center gap-2 px-1 my-1">
                                    <div className="flex-1 h-px bg-white/5" />
                                </div>
                            )}

                            {/* ── Group 2: EM DESLOCAMENTO ─────────────────────── */}
                            {inTransitGroup.length > 0 && (
                                <>
                                    <SectionHeader
                                        label="Em Deslocamento"
                                        count={inTransitGroup.length}
                                        colorClass="text-amber-400"
                                        dotClass="bg-amber-400"
                                    />
                                    {inTransitGroup.map((req, idx) =>
                                        renderCard(req, idx, atReceptionGroup.length)
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Batch action */}
                {requests.length > 1 && (
                    <div className="p-6 bg-emerald-500/5 border-t border-white/10 backdrop-blur-md">
                        <button
                            onClick={handleLiberarTodos}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.2rem] font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-[0_10px_30px_rgba(16,185,129,0.2)] active:scale-95 flex items-center justify-center gap-3 group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                            <Check className="w-5 h-5 relative z-10" />
                            <span className="relative z-10">LIBERAÇÃO EM LOTE</span>
                        </button>
                    </div>
                )}

                {/* System status */}
                <div className="px-6 py-4 bg-slate-950 border-t border-white/10 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">CARGA ATIVA</span>
                        <span className="text-sm font-black italic text-emerald-500">{requests.length} <span className="text-[10px] text-slate-500 not-italic ml-1">ALUNOS</span></span>
                    </div>
                    <div className="text-right">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5 flex items-center gap-2">
                            <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" /> SINCRONISMO OK
                        </span>
                        <span className="text-[10px] font-black text-white italic">v{__APP_VERSION__}</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
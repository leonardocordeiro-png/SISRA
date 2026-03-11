import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Activity, CheckCircle2, Clock, AlertTriangle,
    User as UserIcon, MapPin, School,
} from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
    bg: '#0d131f',
    glassBg: 'rgba(255,255,255,0.03)',
    glassBorder: 'rgba(255,255,255,0.1)',
    glassHighlight: 'rgba(255,255,255,0.15)',
    textMain: '#f8fafc',
    textMuted: '#64748b',
    gold: '#d4af37',
    green: '#2dd4bf',
    red: '#E40123',
};

const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: D.glassBg,
    backdropFilter: 'blur(12px)',
    border: `1px solid ${D.glassBorder}`,
    borderTop: `1px solid ${D.glassHighlight}`,
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    ...extra,
});

// ── Types ─────────────────────────────────────────────────────────────────────
type ActiveRequest = {
    id: string;
    status: string;
    tipo_solicitacao: string;
    horario_solicitacao: string;
    status_geofence: string | null;
    aluno: { id: string; nome_completo: string; turma: string; sala: string; foto_url: string | null };
    responsavel: { nome_completo: string; foto_url: string | null } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function elapsed(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h`;
}

function LiveClock() {
    const [time, setTime] = useState('');
    useEffect(() => {
        const tick = () =>
            setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <span style={{ fontSize: '1.8rem', fontWeight: 300, color: D.gold, fontVariantNumeric: 'tabular-nums' }}>
            {time}
        </span>
    );
}

// ── Student Card ──────────────────────────────────────────────────────────────
function StudentCard({ req, large = false }: { req: ActiveRequest; large?: boolean }) {
    const isEmergency = req.tipo_solicitacao === 'EMERGENCIA';
    const atDoor = req.status_geofence === 'CHEGOU';
    const photoSize = large ? 72 : 52;

    const borderColor = isEmergency ? D.red
        : req.status === 'CONFIRMADO' ? D.green
        : req.status === 'LIBERADO' ? D.gold
        : D.glassBorder;

    return (
        <div style={{
            ...glass({ borderRadius: 12, border: `1.5px solid ${borderColor}` }),
            background: isEmergency ? 'rgba(228,1,35,0.08)' : D.glassBg,
            display: 'flex', alignItems: 'flex-start', gap: large ? 16 : 12,
            padding: large ? '16px 18px' : '12px 14px',
            position: 'relative', overflow: 'hidden',
            animation: isEmergency ? 'board-pulse 1.5s infinite' : 'none',
        }}>
            {isEmergency && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: `repeating-linear-gradient(90deg, ${D.red} 0, ${D.red} 10px, transparent 10px, transparent 20px)`,
                    animation: 'board-stripe 0.5s linear infinite',
                }} />
            )}

            {/* Photo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                    width: photoSize, height: photoSize, borderRadius: large ? 14 : 11,
                    overflow: 'hidden', border: `2px solid ${borderColor}`, background: 'rgba(16,70,153,0.3)',
                }}>
                    {req.aluno.foto_url
                        ? <img src={req.aluno.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserIcon size={photoSize * 0.45} style={{ color: `${D.gold}50` }} />
                          </div>
                    }
                </div>
                {(req.status === 'CONFIRMADO' || atDoor) && (
                    <div style={{
                        position: 'absolute', bottom: -4, right: -4, width: 18, height: 18,
                        borderRadius: '50%', background: D.green, border: `2px solid ${D.bg}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <CheckCircle2 size={10} style={{ color: '#fff' }} />
                    </div>
                )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: large ? 15 : 12, fontWeight: 700, color: D.textMain,
                    lineHeight: 1.25, marginBottom: 5,
                    wordBreak: 'break-word', overflowWrap: 'anywhere',
                }}>
                    {req.aluno.nome_completo}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 5 }}>
                    <span style={{
                        fontSize: 9, fontWeight: 700, color: D.gold, background: `${D.gold}18`,
                        padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.12em',
                    }}>{req.aluno.turma}</span>
                    <span style={{ fontSize: 9, color: D.textMuted, fontWeight: 600 }}>SALA {req.aluno.sala}</span>
                    {atDoor && !isEmergency && (
                        <span style={{
                            fontSize: 8, fontWeight: 700, color: D.green, background: `${D.green}15`,
                            padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase',
                            display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                            <MapPin size={8} /> Na Portaria
                        </span>
                    )}
                    {isEmergency && (
                        <span style={{
                            fontSize: 8, fontWeight: 800, color: '#fff', background: D.red,
                            padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase',
                        }}>⚠ URGENTE</span>
                    )}
                </div>
                {req.responsavel && (
                    <p style={{ fontSize: 9, color: D.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.responsavel.nome_completo}
                    </p>
                )}
            </div>

            {/* Elapsed */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: D.textMuted, fontFamily: 'monospace' }}>
                    {elapsed(req.horario_solicitacao)}
                </span>
                <Clock size={10} style={{ color: D.textMuted, opacity: 0.5 }} />
            </div>
        </div>
    );
}

// ── Stage Column ──────────────────────────────────────────────────────────────
function StageColumn({
    title, subtitle, icon, accentColor, requests, emptyText, emptyIcon,
}: {
    title: string; subtitle: string; icon: React.ReactNode; emptyIcon: React.ReactNode;
    accentColor: string; requests: ActiveRequest[]; emptyText: string;
}) {
    return (
        <div style={{
            ...glass({ borderRadius: 16 }),
            display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1.25rem 1.25rem',
                borderBottom: `1px solid ${D.glassBorder}`,
                background: 'rgba(255,255,255,0.02)',
                flexShrink: 0,
            }}>
                <div style={{
                    width: 40, height: 40,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${D.glassBorder}`, borderRadius: '50%', flexShrink: 0,
                }}>
                    {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.06em', color: D.textMain, textTransform: 'uppercase' }}>
                            {title}
                        </h3>
                        {requests.length > 0 && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, color: D.bg,
                                background: accentColor, padding: '1px 8px',
                                borderRadius: 20, minWidth: 22, textAlign: 'center',
                            }}>{requests.length}</span>
                        )}
                    </div>
                    <p style={{ fontSize: '0.65rem', color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
                        {subtitle}
                    </p>
                </div>
            </div>

            {/* Cards */}
            <div
                className="board-scrollbar"
                style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}
            >
                {requests.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', flex: 1, opacity: 0.35, gap: 10, paddingBlock: '2rem',
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.03)', border: `1px solid ${D.glassBorder}`,
                        }}>
                            {emptyIcon}
                        </div>
                        <p style={{ fontSize: '0.8rem', fontWeight: 500, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
                            {emptyText}
                        </p>
                    </div>
                ) : (
                    requests.map(req => <StudentCard key={req.id} req={req} large={requests.length === 1} />)
                )}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReceptionBoard() {
    const [requests, setRequests] = useState<ActiveRequest[]>([]);
    const [completedToday, setCompletedToday] = useState(0);
    const [connected, setConnected] = useState(true);
    const escolaId = new URLSearchParams(window.location.search).get('escola');

    const fetchData = useCallback(async () => {
        try {
            let q = supabase
                .from('solicitacoes_retirada')
                .select(`
                    id, status, tipo_solicitacao, horario_solicitacao, status_geofence,
                    aluno:alunos(id, nome_completo, turma, sala, foto_url),
                    responsavel:responsaveis(nome_completo, foto_url)
                `)
                .in('status', ['SOLICITADO', 'NOTIFICADO', 'CONFIRMADO', 'AGUARDANDO', 'LIBERADO'])
                .is('horario_confirmacao', null)
                .order('horario_solicitacao', { ascending: true });

            if (escolaId) q = q.eq('escola_id', escolaId);
            const { data, error } = await q;
            if (!error && data) { setRequests(data as unknown as ActiveRequest[]); setConnected(true); }

            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            let cq = supabase
                .from('solicitacoes_retirada')
                .select('*', { count: 'exact', head: true })
                .not('horario_confirmacao', 'is', null)
                .gte('horario_solicitacao', todayStart.toISOString());
            if (escolaId) cq = cq.eq('escola_id', escolaId);
            const { count } = await cq;
            if (count !== null) setCompletedToday(count);
        } catch {
            setConnected(false);
        }
    }, [escolaId]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 2000);
        const channel = supabase
            .channel('board_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_retirada' }, fetchData)
            .subscribe(status => setConnected(status === 'SUBSCRIBED'));
        return () => { clearInterval(interval); supabase.removeChannel(channel); };
    }, [fetchData]);

    const atReception = requests.filter(r => r.status === 'CONFIRMADO');
    const onTheWay = requests.filter(r => r.status === 'LIBERADO');
    const waiting = requests.filter(r => ['SOLICITADO', 'NOTIFICADO', 'AGUARDANDO'].includes(r.status));
    const emergency = requests.filter(r => r.tipo_solicitacao === 'EMERGENCIA');

    return (
        <div style={{
            height: '100vh', background: D.bg,
            backgroundImage: 'radial-gradient(circle at 50% 0%, #1e293b 0%, transparent 50%)',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            overflow: 'hidden', color: D.textMain,
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                @keyframes board-pulse  { 0%,100%{opacity:1} 50%{opacity:0.7} }
                @keyframes board-stripe { 0%{background-position:0 0} 100%{background-position:40px 0} }
                @keyframes board-ticker { 0%{transform:translateX(100vw)} 100%{transform:translateX(-100%)} }
                @keyframes pulse-anim   { 0%{box-shadow:0 0 0 0 rgba(45,212,191,0.7)} 70%{box-shadow:0 0 0 6px rgba(45,212,191,0)} 100%{box-shadow:0 0 0 0 rgba(45,212,191,0)} }
                @keyframes ping-anim    { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.5} }
                .board-scrollbar::-webkit-scrollbar { width: 3px }
                .board-scrollbar::-webkit-scrollbar-track { background: transparent }
                .board-scrollbar::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 2px }
            `}</style>

            {/* ── Header ── */}
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '1.5rem 2rem',
                borderBottom: `1px solid ${D.glassBorder}`,
                flexShrink: 0,
            }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        color: D.gold, padding: '0.5rem',
                        border: `1px dashed ${D.gold}`, borderRadius: 8,
                        width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <School size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: D.gold, textTransform: 'uppercase', fontWeight: 500 }}>
                            La Salle — SISRA
                        </p>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 300, letterSpacing: '0.05em', color: D.textMain }}>
                            PAINEL DE RETIRADAS
                        </h1>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {[
                        { label: 'Fila Ativa',       value: requests.length },
                        { label: 'Na Recepção',      value: atReception.length },
                        { label: 'A Caminho',        value: onTheWay.length },
                        { label: 'Concluídos Hoje',  value: completedToday },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            ...glass(),
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '0.5rem 1.5rem', minWidth: 110,
                        }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 600, color: D.gold, lineHeight: 1 }}>
                                {stat.value}
                            </span>
                            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: D.textMuted, marginTop: 4 }}>
                                {stat.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Clock + Live badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <LiveClock />
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: connected ? 'rgba(45,212,191,0.1)' : 'rgba(228,1,35,0.1)',
                        border: `1px solid ${connected ? D.green : D.red}`,
                        color: connected ? D.green : D.red,
                        padding: '0.4rem 1rem', borderRadius: 20,
                        fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em',
                        boxShadow: connected ? '0 0 15px rgba(45,212,191,0.2)' : 'none',
                    }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: connected ? D.green : D.red,
                            animation: connected ? 'pulse-anim 1.5s infinite' : 'none',
                        }} />
                        {connected ? 'AO VIVO' : 'OFFLINE'}
                    </div>
                </div>
            </header>

            {/* ── Emergency Banner ── */}
            {emergency.length > 0 && (
                <div style={{
                    background: D.red, padding: '10px 2rem', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 12,
                    animation: 'board-pulse 1s infinite',
                }}>
                    <AlertTriangle size={16} style={{ color: '#fff', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        ⚠ ATENÇÃO: {emergency.length} solicitação{emergency.length > 1 ? 'ões' : ''} de emergência — Atendimento imediato necessário
                    </span>
                    <div style={{ flex: 1 }} />
                    {emergency.map(r => (
                        <span key={r.id} style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#fff' }}>
                            {r.aluno.nome_completo.split(' ')[0]}
                        </span>
                    ))}
                </div>
            )}

            {/* ── 3-column Grid ── */}
            <main style={{
                flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.5rem', padding: '1.5rem 2rem', minHeight: 0,
            }}>
                <StageColumn
                    title="Na Recepção" subtitle="Aguardando entrega"
                    icon={<CheckCircle2 size={18} style={{ color: D.green }} />}
                    emptyIcon={<Activity size={20} style={{ color: D.textMuted }} />}
                    accentColor={D.green} requests={atReception}
                    emptyText="Nenhum aluno na recepção"
                />
                <StageColumn
                    title="A Caminho" subtitle="Liberado pela sala"
                    icon={<MapPin size={18} style={{ color: D.gold }} />}
                    emptyIcon={<MapPin size={20} style={{ color: D.textMuted }} />}
                    accentColor={D.gold} requests={onTheWay}
                    emptyText="Nenhum aluno a caminho"
                />
                <StageColumn
                    title="Aguardando" subtitle="Em processamento"
                    icon={<Clock size={18} style={{ color: D.textMuted }} />}
                    emptyIcon={<Clock size={20} style={{ color: D.textMuted }} />}
                    accentColor={D.textMuted} requests={waiting}
                    emptyText="Fila vazia"
                />
            </main>

            {/* ── Footer ── */}
            <footer style={{
                padding: '0.8rem 2rem',
                borderTop: `1px solid ${D.glassBorder}`,
                background: 'rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center',
                fontSize: '0.75rem', color: D.textMuted,
                gap: '1rem', flexShrink: 0, overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: D.green, animation: 'ping-anim 1s infinite' }} />
                    <span style={{ color: D.gold, fontWeight: 600, whiteSpace: 'nowrap' }}>| SISTEMA ATIVO</span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: 80, animation: 'board-ticker 40s linear infinite', whiteSpace: 'nowrap' }}>
                        {[...Array(4)].map((_, i) => (
                            <span key={i}>
                                Sistema de Retirada Segura — La Salle&nbsp;&nbsp;·&nbsp;&nbsp;
                                Atualização em tempo real via SISRA&nbsp;&nbsp;·&nbsp;&nbsp;
                                {completedToday} retiradas concluídas hoje&nbsp;&nbsp;·&nbsp;&nbsp;
                                {requests.length} solicitações ativas no momento
                            </span>
                        ))}
                    </div>
                </div>
                <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {completedToday} concluídas hoje&nbsp;·&nbsp;{requests.length} ativas
                </span>
            </footer>
        </div>
    );
}

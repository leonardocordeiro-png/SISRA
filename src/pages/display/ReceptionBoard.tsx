import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Activity, CheckCircle2, Clock, AlertTriangle,
    User as UserIcon, MapPin, School, Wifi, WifiOff,
} from 'lucide-react';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const B = {
    navy: '#104699', navyDark: '#0a2f6b', navyDeep: '#071830',
    gold: '#fbd12d', goldDark: '#e8be1a', onGold: '#071830',
    red: '#E40123', gray: '#A7A7A2', grayLight: '#c8c8c4',
    green: '#22C55E', white: '#FFFFFF',
    card: 'rgba(16,70,153,0.18)', cardBorder: 'rgba(251,209,45,0.12)',
};

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
        const tick = () => setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color: B.gold, letterSpacing: '0.12em' }}>
            {time}
        </span>
    );
}

// ── Student Card ──────────────────────────────────────────────────────────────

function StudentCard({ req, large = false }: { req: ActiveRequest; large?: boolean }) {
    const isEmergency = req.tipo_solicitacao === 'EMERGENCIA';
    const atDoor = req.status_geofence === 'CHEGOU';

    const borderColor = isEmergency ? B.red
        : req.status === 'CONFIRMADO' ? B.green
        : req.status === 'LIBERADO' ? B.gold
        : 'rgba(255,255,255,0.08)';

    const photoSize = large ? 72 : 52;

    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', gap: large ? 16 : 12,
            padding: large ? '16px 18px' : '12px 14px',
            background: isEmergency ? `rgba(228,1,35,0.10)` : B.card,
            border: `1.5px solid ${borderColor}`,
            borderRadius: 16,
            boxShadow: isEmergency ? `0 0 0 1px ${B.red}30, 0 8px 24px rgba(228,1,35,0.18)`
                : req.status === 'CONFIRMADO' ? `0 4px 20px rgba(34,197,94,0.15)`
                : req.status === 'LIBERADO' ? `0 4px 20px rgba(251,209,45,0.12)` : 'none',
            position: 'relative', overflow: 'hidden',
            animation: isEmergency ? 'board-pulse 1.5s infinite' : 'none',
        }}>
            {/* Emergency stripe */}
            {isEmergency && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: `repeating-linear-gradient(90deg, ${B.red} 0, ${B.red} 10px, transparent 10px, transparent 20px)`,
                    animation: 'board-stripe 0.5s linear infinite',
                }} />
            )}

            {/* Photo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                    width: photoSize, height: photoSize, borderRadius: large ? 14 : 11,
                    overflow: 'hidden', border: `2px solid ${borderColor}`,
                    background: B.navyDark, flexShrink: 0,
                }}>
                    {req.aluno.foto_url
                        ? <img src={req.aluno.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserIcon size={photoSize * 0.45} style={{ color: `${B.gold}35` }} />
                        </div>
                    }
                </div>
                {(req.status === 'CONFIRMADO' || atDoor) && (
                    <div style={{
                        position: 'absolute', bottom: -4, right: -4, width: 18, height: 18,
                        borderRadius: '50%', background: B.green, border: `2px solid ${B.navyDeep}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <CheckCircle2 size={10} style={{ color: '#fff' }} />
                    </div>
                )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: large ? 17 : 13, fontWeight: 900, color: B.white,
                    fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em', lineHeight: 1.2,
                    wordBreak: 'break-word', overflowWrap: 'anywhere', marginBottom: 4,
                }}>
                    {req.aluno.nome_completo}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{
                        fontSize: 9, fontWeight: 800, color: B.gold, background: `${B.gold}18`,
                        padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.14em',
                    }}>{req.aluno.turma}</span>
                    <span style={{ fontSize: 9, color: B.gray, fontWeight: 600 }}>SALA {req.aluno.sala}</span>
                    {atDoor && !isEmergency && (
                        <span style={{
                            fontSize: 8, fontWeight: 800, color: B.green, background: `${B.green}18`,
                            padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.12em',
                            display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                            <MapPin size={8} /> Na Portaria
                        </span>
                    )}
                    {isEmergency && (
                        <span style={{
                            fontSize: 8, fontWeight: 900, color: '#fff', background: B.red,
                            padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.12em',
                        }}>⚠ URGENTE</span>
                    )}
                </div>
                {req.responsavel && (
                    <p style={{ fontSize: 9, color: B.grayLight, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.responsavel.nome_completo}
                    </p>
                )}
            </div>

            {/* Elapsed time */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: B.grayLight, fontFamily: 'monospace' }}>
                    {elapsed(req.horario_solicitacao)}
                </span>
                <Clock size={10} style={{ color: B.gray, opacity: 0.6 }} />
            </div>
        </div>
    );
}

// ── Stage Column ──────────────────────────────────────────────────────────────

function StageColumn({
    title, subtitle, icon, accentColor, requests, emptyText,
}: {
    title: string; subtitle: string; icon: React.ReactNode;
    accentColor: string; requests: ActiveRequest[]; emptyText: string;
}) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', minHeight: 0,
            border: `1px solid ${accentColor}25`, borderRadius: 20,
            background: `rgba(7,24,48,0.55)`, backdropFilter: 'blur(12px)',
            overflow: 'hidden',
        }}>
            {/* Column header */}
            <div style={{
                padding: '16px 18px', borderBottom: `1px solid ${accentColor}20`,
                background: `linear-gradient(90deg, ${accentColor}12, transparent)`,
                display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
                <div style={{
                    width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${accentColor}22`, border: `1.5px solid ${accentColor}40`,
                }}>
                    {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ fontSize: 11, fontWeight: 900, color: B.white, textTransform: 'uppercase', letterSpacing: '0.2em' }}>{title}</p>
                        {requests.length > 0 && (
                            <span style={{
                                fontSize: 10, fontWeight: 900, color: B.onGold,
                                background: accentColor, padding: '1px 8px', borderRadius: 20,
                                minWidth: 22, textAlign: 'center',
                            }}>{requests.length}</span>
                        )}
                    </div>
                    <p style={{ fontSize: 9, color: `${accentColor}90`, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1 }}>{subtitle}</p>
                </div>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {requests.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.3, gap: 10, paddingBlock: 32 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Activity size={18} style={{ color: B.gray }} />
                        </div>
                        <p style={{ fontSize: 9, fontWeight: 700, color: B.gray, textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}>{emptyText}</p>
                    </div>
                ) : (
                    requests.map(req => (
                        <StudentCard key={req.id} req={req} large={requests.length === 1} />
                    ))
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
            if (!error && data) {
                setRequests(data as unknown as ActiveRequest[]);
                setConnected(true);
            }

            // Count completed today
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
            minHeight: '100vh', background: `linear-gradient(160deg, ${B.navyDeep} 0%, #040e20 100%)`,
            display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif',
            overflow: 'hidden',
        }}>
            {/* Inline styles for animations */}
            <style>{`
                @keyframes board-pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
                @keyframes board-stripe { 0%{background-position:0 0} 100%{background-position:40px 0} }
                @keyframes board-ticker { 0%{transform:translateX(100vw)} 100%{transform:translateX(-100%)} }
                @keyframes board-ping { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.5} }
                .board-scrollbar::-webkit-scrollbar{width:3px} .board-scrollbar::-webkit-scrollbar-track{background:transparent} .board-scrollbar::-webkit-scrollbar-thumb{background:rgba(251,209,45,0.2);border-radius:2px}
            `}</style>

            {/* Gold top rule */}
            <div style={{ height: 4, background: `linear-gradient(90deg, ${B.gold}, ${B.goldDark}, ${B.gold}, transparent)`, flexShrink: 0 }} />

            {/* ── Header ── */}
            <header style={{
                padding: '14px 28px', borderBottom: `1px solid rgba(255,255,255,0.07)`,
                background: `rgba(7,24,48,0.7)`, backdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                {/* Left: branding */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: `linear-gradient(135deg, ${B.navy}, ${B.navyDark})`,
                        border: `2px solid ${B.gold}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <School size={20} style={{ color: B.gold }} />
                    </div>
                    <div>
                        <p style={{ fontSize: 9, fontWeight: 700, color: `${B.gold}80`, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 1 }}>La Salle — SISRA</p>
                        <p style={{ fontSize: 17, fontWeight: 900, color: B.white, letterSpacing: '-0.02em', fontStyle: 'italic', textTransform: 'uppercase' }}>Painel de Retiradas</p>
                    </div>
                </div>

                {/* Center: stats */}
                <div style={{ display: 'flex', gap: 12 }}>
                    {[
                        { label: 'Fila Ativa', value: requests.length, color: B.navy },
                        { label: 'Na Recepção', value: atReception.length, color: B.green },
                        { label: 'A Caminho', value: onTheWay.length, color: B.gold },
                        { label: 'Concluídos Hoje', value: completedToday, color: '#818CF8' },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '8px 18px', borderRadius: 12,
                            background: `${stat.color}15`, border: `1px solid ${stat.color}30`,
                            minWidth: 80,
                        }}>
                            <span style={{ fontSize: 22, fontWeight: 900, color: stat.color, fontFamily: 'monospace', lineHeight: 1 }}>{stat.value}</span>
                            <span style={{ fontSize: 8, fontWeight: 700, color: B.gray, textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 2 }}>{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Right: clock + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <LiveClock />
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                        background: connected ? `${B.green}18` : `${B.red}18`,
                        border: `1px solid ${connected ? B.green : B.red}35`, borderRadius: 20,
                    }}>
                        {connected
                            ? <Wifi size={12} style={{ color: B.green }} />
                            : <WifiOff size={12} style={{ color: B.red }} />
                        }
                        <span style={{ fontSize: 9, fontWeight: 800, color: connected ? B.green : B.red, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                            {connected ? 'Ao Vivo' : 'Offline'}
                        </span>
                    </div>
                </div>
            </header>

            {/* ── Emergency Banner ── */}
            {emergency.length > 0 && (
                <div style={{
                    background: B.red, padding: '10px 28px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 12,
                    animation: 'board-pulse 1s infinite',
                }}>
                    <AlertTriangle size={16} style={{ color: '#fff', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', letterSpacing: '0.24em', textTransform: 'uppercase' }}>
                        ⚠ ATENÇÃO: {emergency.length} solicitação{emergency.length > 1 ? 'ões' : ''} de emergência — Atendimento imediato necessário
                    </span>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        {emergency.map(r => (
                            <span key={r.id} style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, color: '#fff' }}>
                                {r.aluno.nome_completo.split(' ')[0]}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Main Grid ── */}
            <main style={{
                flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr',
                gap: 16, padding: '16px 20px', minHeight: 0,
            }}>
                <StageColumn
                    title="Na Recepção"
                    subtitle="Aguardando entrega"
                    icon={<CheckCircle2 size={16} style={{ color: B.green }} />}
                    accentColor={B.green}
                    requests={atReception}
                    emptyText="Nenhum aluno na recepção"
                />
                <StageColumn
                    title="A Caminho"
                    subtitle="Liberado pela sala"
                    icon={<MapPin size={16} style={{ color: B.gold }} />}
                    accentColor={B.gold}
                    requests={onTheWay}
                    emptyText="Nenhum aluno a caminho"
                />
                <StageColumn
                    title="Aguardando"
                    subtitle="Em processamento"
                    icon={<Clock size={16} style={{ color: B.grayLight }} />}
                    accentColor={B.grayLight}
                    requests={waiting}
                    emptyText="Fila vazia"
                />
            </main>

            {/* ── Footer ticker ── */}
            <footer style={{
                height: 38, background: `${B.navy}40`, borderTop: `1px solid ${B.cardBorder}`,
                display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
                position: 'relative',
            }}>
                <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 120,
                    background: `linear-gradient(90deg, ${B.navyDeep} 60%, transparent)`, zIndex: 1,
                    display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16,
                }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: B.green, animation: 'board-ping 1s infinite' }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: B.gold, textTransform: 'uppercase', letterSpacing: '0.2em', whiteSpace: 'nowrap' }}>Sistema Ativo</span>
                </div>
                <div style={{
                    display: 'flex', gap: 80, animation: 'board-ticker 40s linear infinite',
                    paddingLeft: 140, whiteSpace: 'nowrap',
                }}>
                    {[...Array(4)].map((_, i) => (
                        <span key={i} style={{ fontSize: 10, color: B.grayLight, fontWeight: 600, letterSpacing: '0.08em', opacity: 0.7 }}>
                            {completedToday} retiradas concluídas hoje&nbsp;&nbsp;·&nbsp;&nbsp;
                            {requests.length} solicitações ativas no momento&nbsp;&nbsp;·&nbsp;&nbsp;
                            Sistema de Retirada Segura — La Salle&nbsp;&nbsp;·&nbsp;&nbsp;
                            Atualização em tempo real via SISRA
                        </span>
                    ))}
                </div>
                <div style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 100,
                    background: `linear-gradient(270deg, ${B.navyDeep} 60%, transparent)`, zIndex: 1,
                }} />
            </footer>
        </div>
    );
}

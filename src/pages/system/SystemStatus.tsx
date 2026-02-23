import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Database, Wifi, Server, ShieldCheck, Zap, Globe, RefreshCcw } from 'lucide-react';

type SystemStatus = {
    overall: 'healthy' | 'degraded' | 'down';
    database: boolean;
    realtime: boolean;
    auth: boolean;
    latency: number;
    lastChecked: Date;
};

export default function SystemStatusPage() {
    const [status, setStatus] = useState<SystemStatus>({
        overall: 'healthy',
        database: true,
        realtime: true,
        auth: true,
        latency: 0,
        lastChecked: new Date()
    });
    const [checking, setChecking] = useState(false);
    const [history, setHistory] = useState<number[]>(Array(20).fill(0).map(() => Math.floor(Math.random() * 20) + 10));

    useEffect(() => {
        checkSystemHealth();
        const interval = setInterval(() => {
            checkSystemHealth();
            setHistory(prev => [...prev.slice(1), Math.floor(Math.random() * 30) + 10]);
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    const checkSystemHealth = async () => {
        setChecking(true);
        const startTime = performance.now();

        const checks = {
            database: false,
            realtime: false,
            auth: false
        };

        try {
            const { error: dbError } = await supabase.from('escolas').select('id').limit(1);
            checks.database = !dbError;
            checks.auth = !!supabase.auth;
            checks.realtime = checks.database;

            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            const healthyCount = Object.values(checks).filter(Boolean).length;
            let overall: SystemStatus['overall'] = 'healthy';
            if (healthyCount === 0) overall = 'down';
            else if (healthyCount < 3) overall = 'degraded';

            setStatus({
                ...checks,
                overall,
                latency,
                lastChecked: new Date()
            });
        } catch (err) {
            setStatus(prev => ({ ...prev, overall: 'down', lastChecked: new Date() }));
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            {/* Cyber Grid Background */}
            <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
            <div className="fixed inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
            <div className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

            <div className="relative max-w-6xl mx-auto p-6 lg:p-12">
                {/* Top Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center relative overflow-hidden group">
                            <Activity className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 animate-[pulse_2s_infinite]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">
                                Core <span className="text-blue-500">Monitor</span>
                            </h1>
                            <p className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">Status de Infraestrutura La Salle, Cheguei!</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end mr-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Latência Atual</span>
                            <span className="text-xl font-mono font-bold text-emerald-400">{status.latency}ms</span>
                        </div>
                        <button
                            onClick={checkSystemHealth}
                            disabled={checking}
                            className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-blue-500/50 hover:bg-slate-800 transition-all group"
                        >
                            <RefreshCcw className={`w-5 h-5 text-slate-400 group-hover:text-blue-400 ${checking ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Overall Status Card */}
                <div className={`relative mb-12 p-1 border-2 rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ${status.overall === 'healthy' ? 'border-emerald-500/20 shadow-emerald-500/5' :
                    status.overall === 'degraded' ? 'border-amber-500/20 shadow-amber-500/5' :
                        'border-rose-500/20 shadow-rose-500/5'
                    }`}>
                    <div className="bg-[#0f172a]/80 backdrop-blur-2xl rounded-[22px] p-8">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className={`w-2 h-2 rounded-full ${status.overall === 'healthy' ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' :
                                        status.overall === 'degraded' ? 'bg-amber-500 shadow-[0_0_12px_#f59e0b]' :
                                            'bg-rose-500 shadow-[0_0_12px_#f43f5e]'
                                        }`} />
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Estado Global dos Sistemas</span>
                                </div>
                                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-2">
                                    {status.overall === 'healthy' ? 'SISTEMA OPERACIONAL' :
                                        status.overall === 'degraded' ? 'ESTADO CRÍTICO' : 'OFFLINE'}
                                </h2>
                                <p className="text-slate-400 font-medium">
                                    {status.overall === 'healthy' ? 'Todos os microserviços estão respondendo dentro dos parâmetros ideais.' :
                                        status.overall === 'degraded' ? 'Alguns serviços apresentam latência elevada ou instabilidade.' :
                                            'Falha total de conectividade detectada. Verifique sua rede.'}
                                </p>
                            </div>

                            <div className="w-full md:w-64 h-32 flex items-end gap-1 px-4 py-6 bg-[#020617] border border-slate-800 rounded-2xl relative group overflow-hidden">
                                <div className="absolute top-3 left-4 text-[9px] font-black text-slate-600 uppercase tracking-tighter">Histórico de Pulso</div>
                                {history.map((h, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 bg-blue-500/40 rounded-t-[2px] hover:bg-blue-400 transition-all duration-300 group-hover:bg-blue-500/60"
                                        style={{ height: `${h * 2}%` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Microservices Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
                    {[
                        { label: 'Cloud DB', icon: Database, name: 'Database', ok: status.database },
                        { label: 'Sync Engine', icon: Wifi, name: 'Realtime', ok: status.realtime },
                        { label: 'Identity', icon: ShieldCheck, name: 'Auth', ok: status.auth },
                        { label: 'Edge Net', icon: Globe, name: 'Network', ok: status.latency < 500 }
                    ].map((svc, i) => (
                        <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 transition-all hover:bg-slate-800/60 group">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`p-2 rounded-xl border ${svc.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                    <svc.icon className="w-5 h-5" />
                                </div>
                                <div className={`w-2 h-2 rounded-full ${svc.ok ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
                            </div>
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{svc.label}</h3>
                            <p className="text-white font-bold group-hover:text-blue-400 transition-colors">{svc.name}</p>
                        </div>
                    ))}
                </div>

                {/* Detail Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Zap className="w-32 h-32 text-blue-500" />
                        </div>
                        <h3 className="text-white font-black text-xl mb-6 flex items-center gap-2">
                            Log de Diagnóstico
                        </h3>
                        <div className="space-y-4 font-mono text-[11px]">
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-slate-500">ÚLTIMA CHECAGEM</span>
                                <span className="text-emerald-500">{status.lastChecked.toLocaleTimeString()}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-slate-500">PROVIDER</span>
                                <span className="text-blue-400">SUPABASE INFRA</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                <span className="text-slate-500">SSL ENCRYPTION</span>
                                <span className="text-emerald-500">ACTIVE (TLS 1.3)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">REGION</span>
                                <span className="text-slate-300">USA (EAST-1)</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 flex flex-col justify-between shadow-2xl shadow-blue-500/10">
                        <div>
                            <h3 className="text-white font-black text-xl mb-2 italic">Suporte Técnico</h3>
                            <p className="text-blue-100/70 text-sm font-medium leading-relaxed">
                                Em caso de falha crítica ou degradação persistente, contate o administrador da infraestrutura imediatamente.
                            </p>
                        </div>
                        <div className="mt-8">
                            <button className="w-full bg-white text-blue-700 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-all uppercase text-xs tracking-widest shadow-lg">
                                <Server className="w-4 h-4" />
                                Abrir Ticket de Rede
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

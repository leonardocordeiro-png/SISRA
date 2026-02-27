import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, QrCode, Search, Hash, Wifi } from 'lucide-react';

export default function TotemHome() {
    const navigate = useNavigate();
    const [time, setTime] = useState(new Date());
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const p = setInterval(() => setPulse(v => !v), 2000);
        return () => clearInterval(p);
    }, []);

    const formatTime = (d: Date) =>
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formatDate = (d: Date) =>
        d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

    return (
        <div
            className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col select-none cursor-pointer"
            onClick={() => navigate('/totem/identificar')}
        >
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[80%] bg-emerald-500/[0.05] blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[70%] bg-blue-500/[0.04] blur-[150px] rounded-full animate-pulse" />
                {/* Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:48px_48px]" />
                {/* Scan line */}
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent animate-[scan_4s_linear_infinite]" />
            </div>

            {/* Header bar */}
            <div className="relative z-10 flex items-center justify-between px-12 py-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${pulse ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-emerald-500/30'} transition-all duration-700`} />
                    <span className="text-[11px] font-black uppercase tracking-[0.4em] text-emerald-500/70">Sistema Ativo — SISRA</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                    <Wifi className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Online</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-0 px-16">

                {/* Logo Icon */}
                <div className="relative mb-8 group">
                    <div className="absolute -inset-8 bg-emerald-500/10 blur-3xl rounded-full animate-pulse" />
                    <div className="relative w-32 h-32 bg-white/[0.04] border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                        <School className="w-16 h-16 text-emerald-500" />
                        {/* Orbiting dot */}
                        <div className="absolute inset-0 animate-[spin_6s_linear_infinite]">
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-2">
                    <h1 className="text-7xl font-black italic tracking-tighter text-white uppercase leading-none mb-3">
                        La Salle,{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400">
                            Cheguei!
                        </span>
                    </h1>
                    <p className="text-slate-500 text-base font-bold uppercase tracking-[0.3em]">
                        Terminal de Auto-Atendimento
                    </p>
                </div>

                {/* Clock */}
                <div className="my-8 text-center">
                    <div className="text-7xl font-black tabular-nums text-white/90 leading-none tracking-tight">
                        {formatTime(time)}
                    </div>
                    <div className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2 capitalize">
                        {formatDate(time)}
                    </div>
                </div>

                {/* Quick method hint pills */}
                <div className="flex items-center gap-4 mb-10">
                    {[
                        { icon: Search, label: 'Buscar por Nome', color: 'emerald' },
                        { icon: Hash, label: 'Código de Acesso', color: 'violet' },
                        { icon: QrCode, label: 'Escanear QR Code', color: 'blue' },
                    ].map(({ icon: Icon, label, color }) => (
                        <div key={label} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-${color}-500/20 bg-${color}-500/10 text-${color}-400`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">{label}</span>
                        </div>
                    ))}
                </div>

                {/* Touch prompt */}
                <div className={`flex flex-col items-center gap-3 transition-opacity duration-700 ${pulse ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="w-16 h-16 rounded-3xl border-2 border-white/20 flex items-center justify-center">
                        <span className="text-3xl">👆</span>
                    </div>
                    <p className="text-white/50 text-sm font-black uppercase tracking-[0.4em]">
                        Toque para começar
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 flex items-center justify-between px-12 py-5 border-t border-white/5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">© La Salle — SISRA</span>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Terminal Quiosque v1.0</span>
            </div>
        </div>
    );
}

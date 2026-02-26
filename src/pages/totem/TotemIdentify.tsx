import { useNavigate } from 'react-router-dom';
import { Search, Hash, QrCode, ArrowLeft } from 'lucide-react';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';

export default function TotemIdentify() {
    const navigate = useNavigate();
    useInactivityTimer({ timeoutMs: 40000, redirectTo: '/totem' });

    const methods = [
        {
            id: 'busca',
            icon: Search,
            title: 'Buscar por Nome',
            description: 'Digite o nome do seu filho para localizar na lista de alunos.',
            color: 'emerald',
            path: '/totem/busca',
        },
        {
            id: 'codigo',
            icon: Hash,
            title: 'Código de Acesso',
            description: 'Use o código único impresso no seu cartão QR para se identificar.',
            color: 'violet',
            path: '/totem/codigo',
        },
        {
            id: 'qr',
            icon: QrCode,
            title: 'Escanear QR Code',
            description: 'Aproxime o cartão QR da câmera do terminal para leitura automática.',
            color: 'blue',
            path: '/totem/qr',
        },
    ];

    const colorMap: Record<string, { bg: string; border: string; text: string; glow: string; hover: string; iconBg: string }> = {
        emerald: {
            bg: 'bg-emerald-500/[0.06]',
            border: 'border-emerald-500/30',
            text: 'text-emerald-400',
            glow: 'shadow-[0_20px_60px_rgba(16,185,129,0.15)]',
            hover: 'hover:bg-emerald-500/[0.12] hover:border-emerald-500/60',
            iconBg: 'bg-emerald-500/20 border-emerald-500/30',
        },
        violet: {
            bg: 'bg-violet-500/[0.06]',
            border: 'border-violet-500/30',
            text: 'text-violet-400',
            glow: 'shadow-[0_20px_60px_rgba(124,58,237,0.15)]',
            hover: 'hover:bg-violet-500/[0.12] hover:border-violet-500/60',
            iconBg: 'bg-violet-500/20 border-violet-500/30',
        },
        blue: {
            bg: 'bg-blue-500/[0.06]',
            border: 'border-blue-500/30',
            text: 'text-blue-400',
            glow: 'shadow-[0_20px_60px_rgba(59,130,246,0.15)]',
            hover: 'hover:bg-blue-500/[0.12] hover:border-blue-500/60',
            iconBg: 'bg-blue-500/20 border-blue-500/30',
        },
    };

    return (
        <div
            className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col"
            style={{ width: '1280px', minHeight: '1024px' }}
        >
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[70%] bg-emerald-500/[0.04] blur-[130px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[60%] bg-violet-500/[0.04] blur-[130px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-12 py-6 border-b border-white/5">
                <button
                    onClick={() => navigate('/totem')}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all active:scale-95 text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Voltar</span>
                </button>

                <div className="text-center">
                    <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase">
                        Como deseja se identificar?
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        Escolha uma das opções abaixo
                    </p>
                </div>

                <div className="w-32" /> {/* Spacer */}
            </div>

            {/* Method Cards */}
            <div className="relative z-10 flex-1 flex items-center justify-center px-16">
                <div className="grid grid-cols-3 gap-8 w-full">
                    {methods.map(method => {
                        const c = colorMap[method.color];
                        const Icon = method.icon;
                        return (
                            <button
                                key={method.id}
                                onClick={() => navigate(method.path)}
                                className={`
                                    flex flex-col items-center text-center p-12 rounded-[2.5rem]
                                    border-2 ${c.bg} ${c.border} ${c.glow} ${c.hover}
                                    transition-all duration-300 active:scale-95 group
                                `}
                            >
                                {/* Icon */}
                                <div className={`w-28 h-28 rounded-[2rem] border-2 ${c.iconBg} flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className={`w-14 h-14 ${c.text}`} />
                                </div>

                                {/* Text */}
                                <h2 className={`text-3xl font-black italic tracking-tighter uppercase mb-4 ${c.text}`}>
                                    {method.title}
                                </h2>
                                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[220px]">
                                    {method.description}
                                </p>

                                {/* Arrow indicator */}
                                <div className={`mt-8 px-6 py-2.5 rounded-full border ${c.border} ${c.text} text-xs font-black uppercase tracking-[0.2em] group-hover:scale-105 transition-transform`}>
                                    Selecionar →
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Footer hint */}
            <div className="relative z-10 flex items-center justify-center px-12 py-5 border-t border-white/5">
                <p className="text-slate-700 text-xs font-bold uppercase tracking-widest">
                    Terminal retornará ao início automaticamente em caso de inatividade
                </p>
            </div>
        </div>
    );
}

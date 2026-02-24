import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NavigationControls() {
    const navigate = useNavigate();

    return (
        <div className="flex items-center gap-4 mb-10 no-print animate-in fade-in slide-in-from-left-4 duration-700">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-3 px-5 py-3 bg-white/[0.03] border border-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl backdrop-blur-md active:scale-95 group"
                title="Voltar para a página anterior"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Voltar</span>
            </button>
            <button
                onClick={() => navigate('/')}
                className="flex items-center gap-3 px-5 py-3 bg-white/[0.03] border border-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl backdrop-blur-md active:scale-95 group"
                title="Ir para a seleção de módulos"
            >
                <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Início</span>
            </button>
        </div>
    );
}

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NavigationControls() {
    const navigate = useNavigate();

    return (
        <div className="flex items-center gap-3 mb-6 no-print">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all font-bold text-sm shadow-sm active:scale-95"
                title="Voltar para a página anterior"
            >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
            </button>
            <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all font-bold text-sm shadow-sm active:scale-95"
                title="Ir para a seleção de módulos"
            >
                <Home className="w-4 h-4" />
                <span>Início</span>
            </button>
        </div>
    );
}

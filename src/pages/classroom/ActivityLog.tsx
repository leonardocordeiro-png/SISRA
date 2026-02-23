import { useState } from 'react';
import {
    History,
    LayoutDashboard,
    Users,
    Settings,
    Bell,
    Search,
    Download,
    CheckCircle,
    Clock,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavigationControls from '../../components/NavigationControls';

type ActivityLogEntry = {
    id: string;
    aluno: string;
    alunoIniciais: string;
    recebido: string;
    liberado: string;
    responsavel: string;
    status: 'COMPLETO' | 'EM_PROGRESSO' | 'FLAG';
};

const mockActivity: ActivityLogEntry[] = [
    {
        id: '1',
        aluno: 'Benjamin Jenkins',
        alunoIniciais: 'BJ',
        recebido: '03:15 PM',
        liberado: '03:18 PM',
        responsavel: 'Sarah Jenkins (Mãe)',
        status: 'COMPLETO'
    },
    {
        id: '2',
        aluno: 'Lucas Miller',
        alunoIniciais: 'LM',
        recebido: '03:10 PM',
        liberado: '03:14 PM',
        responsavel: 'Robert Miller (Pai)',
        status: 'COMPLETO'
    },
    {
        id: '3',
        aluno: 'Emma Santiago',
        alunoIniciais: 'ES',
        recebido: '03:02 PM',
        liberado: '03:08 PM',
        responsavel: 'Maria Santiago (Mãe)',
        status: 'COMPLETO'
    },
    {
        id: '4',
        aluno: 'Olivia Wong',
        alunoIniciais: 'OW',
        recebido: '03:22 PM',
        liberado: 'Pendente...',
        responsavel: 'David Wong (Pai)',
        status: 'EM_PROGRESSO'
    },
    {
        id: '5',
        aluno: 'James Davis',
        alunoIniciais: 'JD',
        recebido: '02:55 PM',
        liberado: '02:58 PM',
        responsavel: 'Linda Davis (Avó)',
        status: 'COMPLETO'
    }
];

export default function ClassroomActivityLog() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredActivity = mockActivity.filter(entry =>
        entry.aluno.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.responsavel.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-20 lg:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300">
                <div className="p-6 mb-10 flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <History className="text-white w-6 h-6" />
                    </div>
                    <span className="text-xl font-bold tracking-tight hidden lg:block dark:text-white">La Salle, Cheguei!</span>
                </div>

                <nav className="flex-1 w-full px-3 space-y-2">
                    <button onClick={() => navigate('/sala/dashboard')} className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-blue-600 transition-colors w-full">
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="hidden lg:block font-medium text-sm">Saídas Ativas</span>
                    </button>
                    <button className="flex items-center gap-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-r-4 border-blue-600 rounded-lg w-full">
                        <History className="w-5 h-5" />
                        <span className="hidden lg:block font-medium text-sm">Log de Atividade</span>
                    </button>
                    <button className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-blue-600 transition-colors w-full">
                        <Users className="w-5 h-5" />
                        <span className="hidden lg:block font-medium text-sm">Lista de Alunos</span>
                    </button>
                    <button className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-blue-600 transition-colors w-full">
                        <Settings className="w-5 h-5" />
                        <span className="hidden lg:block font-medium text-sm">Configurações</span>
                    </button>
                </nav>

                <div className="p-6 mt-auto">
                    <div className="flex items-center gap-3 py-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
                            MT
                        </div>
                        <div className="hidden lg:block overflow-hidden">
                            <p className="text-sm font-semibold truncate dark:text-white">Ms. Thompson</p>
                            <p className="text-xs text-slate-500">4º Ano B</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <NavigationControls />
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full lg:hidden">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-semibold dark:text-white">Log de Atividades da Sala</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full hidden sm:block">
                            Sala 204 • Ala Norte
                        </span>
                        <button className="text-slate-400 hover:text-blue-600 transition-colors relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-6">
                            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <CheckCircle className="text-blue-600 dark:text-blue-400 w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Alunos Liberados Hoje</p>
                                <h2 className="text-4xl font-bold mt-1 dark:text-white">24 <span className="text-sm font-normal text-slate-400">/ 32 Total</span></h2>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-6">
                            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                                <Clock className="text-emerald-500 w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Tempo Médio de Resposta</p>
                                <h2 className="text-4xl font-bold mt-1 dark:text-white">3.2 <span className="text-sm font-normal text-slate-400">minutos</span></h2>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full sm:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar aluno ou responsável..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm dark:text-white dark:placeholder-slate-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm shadow-lg shadow-blue-600/20">
                                <Download className="w-4 h-4" />
                                Exportar
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Nome do Aluno</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Chamada Recebida</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Hora Liberado</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Responsável Autorizado</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredActivity.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                                        {entry.alunoIniciais}
                                                    </div>
                                                    <span className="font-medium dark:text-slate-200">{entry.aluno}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{entry.recebido}</td>
                                            <td className={`px-6 py-4 text-sm ${entry.status === 'EM_PROGRESSO' ? 'italic text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {entry.liberado}
                                            </td>
                                            <td className="px-6 py-4 text-sm dark:text-slate-300">{entry.responsavel}</td>
                                            <td className="px-6 py-4">
                                                {entry.status === 'COMPLETO' && (
                                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">Completo</span>
                                                )}
                                                {entry.status === 'EM_PROGRESSO' && (
                                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 animate-pulse">Em Progresso</span>
                                                )}
                                                {entry.status === 'FLAG' && (
                                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">Atenção</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <p className="text-sm text-slate-500">Mostrando <span className="font-medium text-slate-900 dark:text-white">{filteredActivity.length}</span> de <span className="font-medium text-slate-900 dark:text-white">24</span> liberações hoje</p>
                            <div className="flex gap-2">
                                <button className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Legend */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-semibold mb-4 dark:text-white">Legendas de Histórico</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-slate-500 dark:text-slate-400">Completo: Aluno acompanhado até a saída</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                <span className="text-slate-500 dark:text-slate-400">Em Progresso: Aluno em trânsito para saída</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                                <span className="text-slate-500 dark:text-slate-400">Atenção: Requer verificação adicional</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 text-blue-600 dark:text-blue-400">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Tempo médio baseado no tempo entre "Chamada Recebida" e "Liberação".
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

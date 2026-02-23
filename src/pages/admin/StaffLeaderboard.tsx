import { useState } from 'react';
import { Trophy, Medal, ArrowLeft, Search, Download, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavigationControls from '../../components/NavigationControls';

type StaffPerformance = {
    id: string;
    nome: string;
    sala: string;
    serie: string;
    avgResponse: string;
    consistency: number;
    foto: string;
    rank: number;
};

const mockStaff: StaffPerformance[] = [
    {
        id: '1',
        nome: 'Sarah Jenkins',
        sala: 'Sala 105',
        serie: '1º Ano',
        avgResponse: '0m 54s',
        consistency: 99,
        foto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBoaXrAoIYnEiqX6jB3Za7p1AP0OOe5fM74ckhOc3xN-BGnNN9Ud-X8DPLhRaNpNMI7cAE68j52fF1LP4mU_wD12rq3sAmKhpNlZ8iYczZlTU6UtbhDaemQKtq56TQRK2ywqAlPWcqM58M4rjiZioNAm14F7bOhpiqsXwtbKGbA_N-WuCog3p5Hr2qXua5QCt1k4Xct3VCAhGUTeXu-0MkG60y8XVlcqJcX40XpD65_2qleBYIfcyodLPTn-Ifj4FHW5wgn2Ml_3QI',
        rank: 1
    },
    {
        id: '2',
        nome: 'Elena Rodriguez',
        sala: 'Sala 302',
        serie: '4º Ano',
        avgResponse: '1m 12s',
        consistency: 96,
        foto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvBV7btwzWycHl55pTJ4xA4gyC8HGxYMHS2z9D_t3VzWexzpYbjVb-iJiZ0f1syG8TS1gLOwA4Js01W2CJCUM5vYXDjzWdKKYAQhYSSe7tZWlXesfSDEUWGNxBfsth05trYyTScEqUOUYM78B7xSzBBN66Stde0_2DBttRWjqGKMcnsPePj9K5WGsuF8IVTamJXDL4IkW7D8ifA735WwZ5BW4m5uZfS3aZpPHgt31Tp2RFm_Qd_37lAodZF_I4ArW4zQuQgK_LB-4',
        rank: 2
    },
    {
        id: '3',
        nome: 'David Chen',
        sala: 'Sala 214',
        serie: '5º Ano',
        avgResponse: '1m 28s',
        consistency: 94,
        foto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-qJvz3qGeud7On1vf6hFJpOa0RmaoGqgNLFsjK3P44D1ElS6Oyjri0RtBPp_QwpQTgMHV97cPtpWv1zKlEsg4MNCTleiyQIyHBpVaSVKkwuhlweg0DzcaVmpZN8Bg5Z1GEr-mKEA444nDEjUnmf4qttNHCfV8LjlM3IMcIRK7tLAx_3fbUryZqpCIz5gUsTKxkpao9vjBDFBGxnBqf6ErG86KuGN0aZwtDHS8hzWDr8cl6ICAUr3whwxfHNkFuINnWX009D2Kb-g',
        rank: 3
    },
    {
        id: '4',
        nome: 'Marcus Thorne',
        sala: 'Sala 112',
        serie: 'Jardim de Infância',
        avgResponse: '1m 32s',
        consistency: 92,
        foto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA9jIacCmgs4KU2GbpPs70jFEYUOsyT_fhKJ0zoOF3ksnxa5nJju07g0yh75NoCMMxeMAOKfJrKORhkT1uM_5VeMXVFFEO49BgbyZ7Q9a3CfGdJu5C-nUiaZSV9J05istRTv2Ac0myAitba9oTC9-F9cCsqQwZ_f6DPdcsNIHb2Q4nNudiUhF5fk5CMCzdf6J7kf13FpF3-DDqkfYAxft9uJAdc40wc475lsPaNNulu6_yawXc9Oqa5h_QpzOEERh-YMZqzXbzqIWo',
        rank: 4
    },
    {
        id: '5',
        nome: 'Linda Wu',
        sala: 'Sala 405',
        serie: '3º Ano',
        avgResponse: '1m 45s',
        consistency: 88,
        foto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBqLSmhsJf28c7WLbpeacllIZCTPhpFX4bWXh56-5UQTkI-rQW2kMg7kQtrdC-M8BmgwgzPTgQWhoQDgwQ-8b-Es-iAVnqLE7DEu0ZE94g0qu_1vgV5rSBiyCAPxoaGV0asZh1I-vFqIDmH_uNxRm8yRu4dbiI_L_GNKpFWXa1O5sr9roBH3kfk4OLzC0p0jahBoWYDLMZb6jpBQjB3Y_of778DAGAFEleXUvMtml0NNKKrFUAl1sewP-0l_uIAYxkfLwquJDKSELM',
        rank: 5
    }
];

export default function StaffLeaderboard() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState<'WEEK' | 'MONTH' | 'ALL'>('MONTH');

    const filteredStaff = mockStaff.filter(s =>
        s.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.sala.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold">Ranking de Reconhecimento</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                            <Trophy className="w-4 h-4" />
                            Ranking de Eficiência
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <NavigationControls />
                {/* Intro Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">Desempenho da Equipe</h2>
                        <p className="text-slate-500 dark:text-slate-400">Celebrando a eficiência nos tempos de resposta para retirada de alunos.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <button
                                onClick={() => setTimeRange('WEEK')}
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${timeRange === 'WEEK' ? 'bg-green-500 text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                Esta Semana
                            </button>
                            <button
                                onClick={() => setTimeRange('MONTH')}
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${timeRange === 'MONTH' ? 'bg-green-500 text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                Este Mês
                            </button>
                            <button
                                onClick={() => setTimeRange('ALL')}
                                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${timeRange === 'ALL' ? 'bg-green-500 text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                Todo o Tempo
                            </button>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <Download className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium">Exportar</span>
                        </button>
                    </div>
                </div>

                {/* Podium Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
                    {/* Rank 2 */}
                    <div className="order-2 md:order-1">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border-b-4 border-slate-300 dark:border-slate-600 shadow-lg flex flex-col items-center text-center relative">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-700 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">2º Lugar</div>
                            <div className="w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-700 mb-4 relative">
                                <img src={mockStaff[1].foto} alt={mockStaff[1].nome} className="w-full h-full object-cover rounded-full" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800">
                                    <Medal className="w-5 h-5 text-slate-500" />
                                </div>
                            </div>
                            <h3 className="font-bold text-xl mb-1">{mockStaff[1].nome}</h3>
                            <p className="text-green-600 dark:text-green-400 font-medium text-sm mb-4 uppercase tracking-tighter">{mockStaff[1].sala} • {mockStaff[1].serie}</p>
                            <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-slate-50 dark:border-slate-700">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Resposta Méd.</p>
                                    <p className="text-lg font-bold">{mockStaff[1].avgResponse}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Consistência</p>
                                    <p className="text-lg font-bold">{mockStaff[1].consistency}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rank 1 */}
                    <div className="order-1 md:order-2">
                        <div className="bg-white dark:bg-slate-800 p-10 rounded-2xl border-b-8 border-green-500 shadow-2xl flex flex-col items-center text-center relative md:-mt-8 transform scale-105">
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-1.5 rounded-full text-sm font-bold uppercase tracking-widest shadow-lg flex items-center gap-2">
                                <Star className="w-4 h-4 fill-white" />
                                Líder
                            </div>
                            <div className="w-32 h-32 rounded-full border-4 border-green-100 dark:border-green-900/50 mb-6 relative">
                                <img src={mockStaff[0].foto} alt={mockStaff[0].nome} className="w-full h-full object-cover rounded-full" />
                                <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg" style={{ backgroundColor: '#22c55e' }}>
                                    <Trophy className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <h3 className="font-bold text-2xl mb-1">{mockStaff[0].nome}</h3>
                            <p className="text-green-600 dark:text-green-400 font-semibold text-base mb-6 uppercase tracking-tighter">{mockStaff[0].sala} • {mockStaff[0].serie}</p>
                            <div className="grid grid-cols-2 gap-6 w-full pt-6 border-t border-green-50 dark:border-green-900/30">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Resposta Méd.</p>
                                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{mockStaff[0].avgResponse}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Consistência</p>
                                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{mockStaff[0].consistency}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rank 3 */}
                    <div className="order-3">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border-b-4 border-orange-300 dark:border-orange-800 shadow-lg flex flex-col items-center text-center relative">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-100 text-orange-700 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">3º Lugar</div>
                            <div className="w-24 h-24 rounded-full border-4 border-orange-50 dark:border-orange-900/30 mb-4 relative">
                                <img src={mockStaff[2].foto} alt={mockStaff[2].nome} className="w-full h-full object-cover rounded-full" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800">
                                    <Medal className="w-5 h-5 text-orange-500" />
                                </div>
                            </div>
                            <h3 className="font-bold text-xl mb-1">{mockStaff[2].nome}</h3>
                            <p className="text-green-600 dark:text-green-400 font-medium text-sm mb-4 uppercase tracking-tighter">{mockStaff[2].sala} • {mockStaff[2].serie}</p>
                            <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-slate-50 dark:border-slate-700">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Resposta Méd.</p>
                                    <p className="text-lg font-bold">{mockStaff[2].avgResponse}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Consistência</p>
                                    <p className="text-lg font-bold">{mockStaff[2].consistency}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h4 className="font-bold text-lg">Classificação Geral</h4>
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar professor ou sala..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-green-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr className="text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-widest font-bold">
                                    <th className="px-6 py-4">Ranking</th>
                                    <th className="px-6 py-4">Professor & Sala</th>
                                    <th className="px-6 py-4">Tempo Médio</th>
                                    <th className="px-6 py-4 text-center">Consistência</th>
                                    <th className="px-6 py-4 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredStaff.map((staff) => (
                                    <tr key={staff.id} className="group hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors">
                                        <td className="px-6 py-5">
                                            <span className={`text-lg font-bold ${staff.rank <= 3 ? 'text-green-500' : 'text-slate-400'}`}>#{staff.rank}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                                    <img src={staff.foto} alt={staff.nome} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <p className="font-bold dark:text-white">{staff.nome}</p>
                                                    <p className="text-xs text-slate-500 uppercase">{staff.sala} • {staff.serie}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                <span className="font-medium dark:text-slate-200">{staff.avgResponse}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="w-full max-w-[140px] mx-auto">
                                                <div className="flex justify-between text-[10px] mb-1 font-bold">
                                                    <span className="text-green-500">EXCELENTE</span>
                                                    <span>{staff.consistency}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500"
                                                        style={{ width: `${staff.consistency}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-500 hover:text-white transition-all text-sm font-semibold">
                                                <Star className="w-4 h-4" />
                                                Enviar Elogio
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Card */}
                <div className="mt-12 p-8 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/20 dark:to-green-900/10 rounded-2xl border border-green-200 dark:border-green-900/30">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border-2 border-green-500">
                            <Trophy className="w-8 h-8 text-green-500" />
                        </div>
                        <div>
                            <h5 className="text-xl font-bold mb-1">Impacto da Resposta Rápida</h5>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                                Um tempo de resposta mais rápido reduz o congestionamento na zona de embarque e garante que os alunos sejam reunidos com suas famílias com segurança e rapidez.
                            </p>
                        </div>
                        <div className="ml-auto">
                            <button className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all">
                                Premiar Destaques
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, School, Clock, Activity, TrendingUp, QrCode, BarChart2, Shield, Settings } from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

export default function AdminDashboard() {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalStudents: 0,
        activePickups: 0,
        dailyPickups: 0,
        avgWaitTime: 0
    });

    async function fetchStats() {
        try {
            // Total Students
            const studentsCount = await supabase
                .from('alunos')
                .select('*', { count: 'exact', head: true });

            // Active Requests (not finished)
            const activeRequests = await supabase
                .from('solicitacoes_retirada')
                .select('*', { count: 'exact', head: true })
                .neq('status', 'ENTREGUE')
                .neq('status', 'CANCELADO');

            // Today's total pickups
            const today = new Date().toISOString().split('T')[0];
            const finishedToday = await supabase
                .from('solicitacoes_retirada')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'ENTREGUE')
                .gte('horario_confirmacao', today);

            setStats({
                totalStudents: studentsCount.count || 0,
                activePickups: activeRequests.count || 0,
                dailyPickups: finishedToday.count || 0,
                avgWaitTime: 8 // Mock or calculate in real scenario
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        }
    }

    useEffect(() => {
        setTimeout(() => fetchStats(), 0);

        // Refresh stats every minute
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        await signOut();
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white px-4 md:px-8 py-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-lg shrink-0">
                        <School className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h1 className="font-bold text-base md:text-lg leading-tight">Painel Administrativo</h1>
                        <p className="text-[10px] md:text-xs text-slate-400">La Salle, Cheguei! Manager</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs md:text-sm font-medium">
                    <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
                </button>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
                <NavigationControls />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                    <StatCard
                        title="Total de Alunos"
                        value={stats.totalStudents}
                        icon={<Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />}
                        color="bg-blue-50 border-blue-200"
                    />
                    <StatCard
                        title="Retiradas Hoje"
                        value={stats.dailyPickups}
                        icon={<Activity className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />}
                        color="bg-emerald-50 border-emerald-200"
                    />
                    <StatCard
                        title="Em Andamento"
                        value={stats.activePickups}
                        icon={<Clock className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />}
                        color="bg-amber-50 border-amber-200"
                    />
                    <StatCard
                        title="Tempo Médio"
                        value={`${stats.avgWaitTime} min`}
                        icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />}
                        color="bg-purple-50 border-purple-200"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col items-center text-center">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                            <School className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Visão da Sala de Aula</h2>
                        <p className="text-sm md:text-base text-slate-500 mb-6 max-w-sm">
                            Acesse o terminal dos professores para gerenciar chamadas de alunos e alertas de segurança.
                        </p>
                        <button
                            onClick={() => navigate('/sala/dashboard')}
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 text-sm md:text-base"
                        >
                            Ver Dashboard de Sala
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col items-center text-center">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                            <Activity className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Visão da Recepção</h2>
                        <p className="text-sm md:text-base text-slate-500 mb-6 max-w-sm">
                            Monitore a fila de espera ativa e realize chamadas manuais de alunos.
                        </p>
                        <button
                            onClick={() => navigate('/recepcao/busca')}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-sm md:text-base"
                        >
                            Ver Painel de Recepção
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 p-6 md:p-8 flex flex-col items-center text-center md:col-span-2 lg:col-span-1">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                            <BarChart2 className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Central de Relatórios</h2>
                        <p className="text-sm md:text-base text-slate-500 mb-6 max-w-sm">
                            Relatórios diários, semanais, mensais e anuais de retiradas com auditoria completa de responsáveis.
                        </p>
                        <button
                            onClick={() => navigate('/admin/exportar-dados')}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 text-sm md:text-base"
                        >
                            Ir para Central de Relatórios
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 text-center py-8 md:py-12">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4">Gestão de Alunos e Usuários</h2>
                    <p className="text-sm md:text-base text-slate-500 max-w-lg mx-auto mb-8">
                        Funcionalidade completa de CRUD para gerenciar o cadastro de alunos, responsáveis e permissões de usuários do sistema.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex justify-center flex-wrap gap-4">
                        <button
                            onClick={() => navigate('/admin/alunos')}
                            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors text-sm md:text-base"
                        >
                            + Cadastrar Aluno
                        </button>
                        <button
                            onClick={() => navigate('/admin/usuarios')}
                            className="px-6 py-3 bg-white text-slate-900 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors text-sm md:text-base"
                        >
                            Gerenciar Usuários
                        </button>
                        <button
                            onClick={() => navigate('/admin/turmas')}
                            className="px-6 py-3 bg-white text-slate-900 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors text-sm md:text-base"
                        >
                            Gerenciar Turmas
                        </button>
                        <button
                            onClick={() => navigate('/admin/cartoes-qr')}
                            className="px-6 py-3 bg-white text-purple-700 border border-purple-200 rounded-xl font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                            <QrCode className="w-4 h-4" /> Cartões QR
                        </button>
                        <button
                            onClick={() => navigate('/admin/auditoria-seguranca')}
                            className="px-6 py-3 bg-white text-rose-700 border border-rose-200 rounded-xl font-medium hover:bg-rose-50 transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                            <Shield className="w-4 h-4" /> Auditoria
                        </button>
                        <button
                            onClick={() => navigate('/admin/configuracoes')}
                            className="px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                            <Settings className="w-4 h-4" /> Configurações
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
    return (
        <div className={`p-4 md:p-6 rounded-2xl border ${color} shadow-sm transition-transform hover:scale-[1.02]`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[10px] md:text-sm font-medium text-slate-500 mb-1 leading-none">{title}</p>
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900">{value}</h3>
                </div>
                <div className="p-2 md:p-3 bg-white rounded-xl shadow-sm">
                    {icon}
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    LogOut, Users, School, TrendingUp, Clock, UserPlus,
    AlertCircle, Activity, FileText, QrCode, Search, ShieldCheck,
    UserCheck, LayoutGrid, Settings
} from 'lucide-react';
import NavigationControls from '../../components/NavigationControls';

type DashboardStats = {
    total_students: number;
    total_staff: number;
    total_pickups_today: number;
    pending_pickups: number;
    avg_pickup_time: string;
    active_alerts: number;
};

type RecentActivity = {
    id: string;
    type: string;
    description: string;
    timestamp: string;
};

export default function EnhancedAdminDashboard() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats>({
        total_students: 0,
        total_staff: 0,
        total_pickups_today: 0,
        pending_pickups: 0,
        avg_pickup_time: '0',
        active_alerts: 0
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            navigate('/admin/login');
            return;
        }
        fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            // Fetch all stats in parallel
            const [studentsRes, staffRes, pickupsRes, pendingRes] = await Promise.all([
                supabase.from('alunos').select('id', { count: 'exact', head: true }),
                supabase.from('usuarios').select('id', { count: 'exact', head: true }),
                supabase
                    .from('solicitacoes_retirada')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', new Date().toISOString().split('T')[0]),
                supabase
                    .from('solicitacoes_retirada')
                    .select('id', { count: 'exact', head: true })
                    .in('status', ['SOLICITADO', 'NOTIFICADO'])
            ]);

            setStats({
                total_students: studentsRes.count || 0,
                total_staff: staffRes.count || 0,
                total_pickups_today: pickupsRes.count || 0,
                pending_pickups: pendingRes.count || 0,
                avg_pickup_time: '12 min',
                active_alerts: 0
            });

            // Fetch recent activity
            const { data: logs } = await supabase
                .from('logs_auditoria')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(5);

            setRecentActivity(
                logs?.map(log => ({
                    id: log.id,
                    type: log.tipo_evento,
                    description: log.descricao,
                    timestamp: log.timestamp
                })) || []
            );
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Activity className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-6">
                        <NavigationControls />
                        <div className="flex items-center gap-2 md:gap-3">
                            <School className="w-6 h-6 md:w-8 md:h-8 text-emerald-600 shrink-0" />
                            <div className="hidden sm:block">
                                <h1 className="text-lg md:text-2xl font-bold text-slate-900 leading-tight">Dashboard Administrativo</h1>
                                <p className="text-xs md:text-sm text-slate-600">Visão geral do sistema</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2 px-3 md:px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden md:inline">Sair</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border-l-4 border-emerald-600">
                        <div className="flex items-center justify-between mb-4">
                            <Users className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
                            <span className="text-xl md:text-2xl font-bold text-slate-900">{stats.total_students}</span>
                        </div>
                        <p className="text-xs md:text-sm font-medium text-slate-600">Total de Alunos</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border-l-4 border-blue-600">
                        <div className="flex items-center justify-between mb-4">
                            <UserPlus className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                            <span className="text-xl md:text-2xl font-bold text-slate-900">{stats.total_staff}</span>
                        </div>
                        <p className="text-xs md:text-sm font-medium text-slate-600">Funcionários Ativos</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border-l-4 border-amber-600">
                        <div className="flex items-center justify-between mb-4">
                            <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-amber-600" />
                            <span className="text-xl md:text-2xl font-bold text-slate-900">{stats.total_pickups_today}</span>
                        </div>
                        <p className="text-xs md:text-sm font-medium text-slate-600">Retiradas Hoje</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border-l-4 border-purple-600">
                        <div className="flex items-center justify-between mb-4">
                            <Clock className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                            <span className="text-xl md:text-2xl font-bold text-slate-900">{stats.avg_pickup_time}</span>
                        </div>
                        <p className="text-xs md:text-sm font-medium text-slate-600">Tempo Médio</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Activity */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Atividade Recente</h2>
                        <div className="space-y-4">
                            {recentActivity.length > 0 ? (
                                recentActivity.map(activity => (
                                    <div key={activity.id} className="flex items-start gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                                            <Activity className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-900 font-medium mb-1">{activity.description}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                {new Date(activity.timestamp).toLocaleString('pt-BR')}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <Activity className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">Nenhuma atividade recente registrada.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            Ações Rápidas
                        </h2>
                        <div className="space-y-4">
                            <Link
                                to="/admin/alunos"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all group border border-transparent hover:border-emerald-100"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <Users className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Gerenciar Alunos</span>
                            </Link>
                            <Link
                                to="/admin/historico-retiradas"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all group border border-transparent hover:border-blue-100"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <FileText className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Histórico de Retiradas</span>
                            </Link>
                            <Link
                                to="/admin/auditoria-seguranca"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-all group border border-transparent hover:border-rose-100"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <ShieldCheck className="w-5 h-5 text-rose-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Auditoria de Segurança</span>
                            </Link>
                            <Link
                                to="/admin/exportar-dados"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all group border border-transparent hover:border-indigo-100"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <Search className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Relatórios e Manutenção</span>
                            </Link>
                            <Link
                                to="/admin/usuarios"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all group border border-transparent hover:border-emerald-100"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <UserCheck className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Usuários e Permissões</span>
                            </Link>
                            <Link
                                to="/admin/turmas"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all group border border-transparent hover:border-blue-100"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <LayoutGrid className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Gestão de Turmas</span>
                            </Link>
                            <Link
                                to="/admin/cartoes-qr"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-all group border border-transparent hover:border-purple-100"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <QrCode className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Gerar Cartões QR</span>
                            </Link>
                            <Link
                                to="/admin/configuracoes"
                                className="flex items-center gap-4 p-4 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all group border border-transparent hover:border-slate-200"
                            >
                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                    <Settings className="w-5 h-5 text-slate-600 group-hover:scale-110 transition-transform" />
                                </div>
                                <span className="text-sm font-bold">Configurações Gerais</span>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Pending Pickups Alert */}
                {stats.pending_pickups > 0 && (
                    <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm animate-in slide-in-from-bottom-4 duration-500">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                            <AlertCircle className="w-7 h-7 text-amber-600" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h4 className="text-lg font-bold text-amber-900 mb-1">Ação Requerida</h4>
                            <p className="text-amber-800/80 font-medium">
                                Existem {stats.pending_pickups} retirada(s) pendente(s) aguardando processamento na recepção.
                            </p>
                        </div>
                        <Link
                            to="/recepcao/busca"
                            className="px-8 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-95"
                        >
                            Ver Agora
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

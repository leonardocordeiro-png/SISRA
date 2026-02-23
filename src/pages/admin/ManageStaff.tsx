import { useState } from 'react';
import { Search, UserPlus, Settings, Edit2, RotateCcw, Bell, School } from 'lucide-react';
import AddStaffSlideOver from '../../components/admin/AddStaffSlideOver';
import NavigationControls from '../../components/NavigationControls';

// Mock Data
const MOCK_STAFF = [
    { id: 1, name: 'Sarah Johnson', email: 'sarah.j@lasallecheguei.com.br', role: 'Admin', area: 'Secretaria Principal', status: 'Ativo', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBed7yF7NoolZT23hjYC7kX-Aq1Cnoyjn5mSLVslEyA38F40Pwxci2NY1A4rjhzwBzdry0ldMcpxGNH2B2TeLOeloxnSPxjGRFIoqX2ptxKlqnbSjhKSC-yAowfaAdPPN5VyxBKnoQUSQlGOmADj7LOHI_2mJ4V9an0EG9m8D5wpUkvwsfGv0HSg64kksYDfR5MRvKILrX3jzfD-zp6hw4fi8oKLuB0OnLDZBU6u4qsUAtBGvFzd6osomKREOfYgm1svASEKmbDim4' },
    { id: 2, name: 'Marcus Chen', email: 'm.chen@lasallecheguei.com.br', role: 'Professor', area: 'Sala 4B', status: 'Ativo', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD8HHTZJ6OuwINV2dwtQa53rzAIjU_h_zhvdslVYKHFPJqA-ckK6xMa1w4ArL_lacfuQFq6dj6nHqlVsP1dszFmCrlhEy8KOM-tPnkclIK3lse8NeheUDO5mSVNU2tC_weXVpxaWVF1_THWcmKrDWsL2xw5OJ-SLLdXW9_rACkLcTLZ5mtGor66nggcpZEZh8tAacnu0dTpfmEcZrJDpF953ykjTp4YxR8_WgC_MA34dKRVJegsIO99llS-aRdsqQ4xJ3-82ABULx4' },
    { id: 3, name: 'David Miller', email: 'd.miller@lasallecheguei.com.br', role: 'Recepção', area: 'Portão Principal', status: 'Ativo', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBh-32XUWg6VISzti9ImhLsQaf9sJpfefsx24tZ40yfsbWiMtO9TGqdxE8BgtdeJV19aOYNMPGSTfvjvXvoe5Dnk_zhM1idxUOVayaHCqqJn5joNVsjGKjs9sIdFcXvDY_IKL7F8dYqe076U-aCBTnmc7_mTcp1AnxaGuWyb06QfovcL7ApKAdFe7FJhNbRkfObkY85L94AZrghIfX8wFEhhBA1bM9b8ufrpGs-rNtDI2TAJ1BTW6S80e48TjaNoOw9uhAY2deWEPs' },
    { id: 4, name: 'Elena Rossi', email: 'e.rossi@lasallecheguei.com.br', role: 'Professor', area: 'Ginásio', status: 'Inativo', photo: null },
    { id: 5, name: 'Kevin Wright', email: 'k.wright@lasallecheguei.com.br', role: 'Professor', area: 'Sala 1A', status: 'Ativo', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDH2lI41P8xzdDoTGGGyxS4DeAcNYe705yikpXVLqiH3NoNI1ufrcCPsvRgPeSevUeohV10JVXMNzkx535RhkA9BnbM461tDHmFBW3G-HfV8Fyx9vbbvntYT_ksIOyM1BzHuHiSsalcgjgwLY-kNVi9J05n141Q2FxhL13RD6nzjEKAM7DEzClOdwYarQWUDAkBwSlXZbDse9vAHk2HuXiazOgHZcb9F8NUw7psn3e6eyGczyKrNe9d_UG56y7RXW3ot6M-v_wkgAU' },
];

export default function ManageStaff() {
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState<string[]>(['Admin', 'Professor', 'Recepção']);

    const toggleFilter = (role: string) => {
        setFilterRole(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const filteredStaff = MOCK_STAFF.filter(staff =>
        (staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            staff.area.toLowerCase().includes(searchTerm.toLowerCase())) &&
        filterRole.includes(staff.role)
    );

    return (
        <div className="font-display bg-slate-50 dark:bg-[#101922] min-h-screen flex flex-col">
            {/* Top Navigation Bar */}
            <nav className="sticky top-0 z-30 bg-white dark:bg-[#1e293b]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-[#137fec] p-1.5 rounded-lg">
                        <School className="text-white w-6 h-6" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">La Salle, Cheguei!</span>
                </div>
                <div className="flex items-center gap-4">
                    <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <Bell className="w-5 h-5" />
                    </button>
                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-medium text-slate-900 dark:text-white leading-none">Usuário Admin</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Coordenador Escolar</p>
                        </div>
                        <img
                            alt="Perfil Admin"
                            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPqK4QJV-t5Ot599AEl3v7BQGuEDIVubYe2ZO7yBKqJxUfk5k6b_EskRe5ROfdWkXxIzRoJfPk6eFl8zIxUquHqCbEginOVg2CdDxoy_Mjd78Wk2KPskXOhU7m5UhSSi4ykq8-DAZ3ph3AKzNEclISnqI0BmWg4wbIEeG5SBojtFdYjt-GbFdDVferlRiaXTLjd3U2UhWc2ms3jG5pgblG1JjynF209xI4Pem0qfCSeamYNDAGXJmG2sL_JBWj-tjDA3ML5gUq1sE"
                        />
                    </div>
                </div>
            </nav>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar (Filters) */}
                <aside className="w-64 bg-white dark:bg-[#1e293b] border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col p-6 space-y-8 overflow-y-auto">
                    <div>
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Menu Principal</h2>
                        <nav className="space-y-1">
                            <a href="/admin/dashboard" className="flex items-center gap-3 px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <span className="text-sm">Painel Principal</span>
                            </a>
                            <a href="#" className="flex items-center gap-3 px-3 py-2 bg-[#137fec]/10 text-[#137fec] rounded-lg transition-colors font-medium">
                                <span className="text-sm">Gestão de Equipe</span>
                            </a>
                            <a href="/admin/alunos" className="flex items-center gap-3 px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <span className="text-sm">Grupos de Alunos</span>
                            </a>
                        </nav>
                    </div>
                    <div>
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Filtrar por Cargo</h2>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filterRole.includes('Admin')}
                                    onChange={() => toggleFilter('Admin')}
                                    className="rounded text-[#137fec] focus:ring-[#137fec] bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-[#137fec] transition-colors">Administrador</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filterRole.includes('Professor')}
                                    onChange={() => toggleFilter('Professor')}
                                    className="rounded text-[#137fec] focus:ring-[#137fec] bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-[#137fec] transition-colors">Professor</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filterRole.includes('Recepção')}
                                    onChange={() => toggleFilter('Recepção')}
                                    className="rounded text-[#137fec] focus:ring-[#137fec] bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-[#137fec] transition-colors">Recepção</span>
                            </label>
                        </div>
                    </div>

                    <div className="pt-6 mt-auto">
                        <button className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm font-medium">
                            <Settings className="w-4 h-4" />
                            Configurações
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-[#101922]">
                    <NavigationControls />
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Gestão de Equipe</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie cargos, acessos e PINs de segurança dos funcionários.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="text"
                                    className="pl-10 pr-4 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl w-full md:w-72 focus:ring-2 focus:ring-[#137fec] focus:border-transparent outline-none text-sm transition-all shadow-sm"
                                    placeholder="Buscar por nome, email ou área..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setIsSlideOverOpen(true)}
                                className="bg-[#137fec] hover:bg-[#137fec]/90 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-[#137fec]/20"
                            >
                                <UserPlus className="w-5 h-5" />
                                Adicionar Funcionário
                            </button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total de Equipe</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">48</p>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 border-l-[#137fec]">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ativos Agora</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">42</p>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Professores</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">35</p>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Recepção</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">8</p>
                        </div>
                    </div>

                    {/* Staff Table Container */}
                    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Membro da Equipe</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cargo</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Área Designada</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredStaff.map((staff) => (
                                        <tr key={staff.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${staff.status === 'Inativo' ? 'opacity-60' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    {staff.photo ? (
                                                        <img alt={staff.name} className="w-10 h-10 rounded-full" src={staff.photo} />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                                            <span className="material-icons">person</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{staff.name}</p>
                                                        <p className="text-xs text-slate-500">{staff.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                          ${staff.role === 'Admin' ? 'bg-[#137fec]/10 text-[#137fec]' :
                                                        staff.role === 'Professor' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                                            'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                    {staff.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                                {staff.area}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none 
                          ${staff.status === 'Ativo' ? 'bg-[#137fec]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out 
                            ${staff.status === 'Ativo' ? 'translate-x-5' : 'translate-x-0'}`}></span>
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="px-3 py-1.5 text-xs font-medium border border-[#137fec] text-[#137fec] hover:bg-[#137fec] hover:text-white rounded-lg transition-all flex items-center gap-1">
                                                        <RotateCcw className="w-3 h-3" /> Redefinir PIN
                                                    </button>
                                                    <button className="p-2 text-slate-400 hover:text-[#137fec] transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Area */}
                        <div className="bg-white dark:bg-[#1e293b] px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <p className="text-sm text-slate-500 dark:text-slate-400">Mostrando <span className="font-medium">1</span> de <span className="font-medium">{filteredStaff.length}</span> de <span className="font-medium">48</span> membros da equipe</p>
                            <div className="flex gap-2">
                                <button className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50" disabled>
                                    Anterior
                                </button>
                                <button className="w-8 h-8 flex items-center justify-center bg-[#137fec] text-white rounded-lg text-sm font-medium">1</button>
                                <button className="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium">2</button>
                                <button className="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium">3</button>
                                <button className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    Próximo
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <AddStaffSlideOver isOpen={isSlideOverOpen} onClose={() => setIsSlideOverOpen(false)} />
        </div>
    );
}

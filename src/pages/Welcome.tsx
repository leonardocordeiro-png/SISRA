
import { Link } from 'react-router-dom';
import { School, User, GraduationCap, Shield } from 'lucide-react';

export default function Welcome() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 md:p-8">
            <div className="w-full max-w-4xl text-center space-y-6 md:space-y-8">
                <div className="flex justify-center mb-4 md:mb-6">
                    <div className="bg-emerald-100 p-4 rounded-full border-4 border-white shadow-lg">
                        <School className="w-12 h-12 md:w-16 md:h-16 text-emerald-600" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Bem-vindo ao La Salle, Cheguei!</h1>
                    <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        Sistema Inteligente de Segurança e Retirada de Alunos.
                        Selecione seu módulo para acessar o sistema.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mt-8 md:mt-12">
                    {/* Reception */}
                    <Link to="/recepcao/login" className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all group active:scale-95">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:bg-emerald-100 transition-colors">
                            <User className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Recepção</h2>
                        <p className="text-slate-500 text-sm leading-relaxed">Controle de entrada e saída de alunos e responsáveis.</p>
                    </Link>

                    {/* Classroom */}
                    <Link to="/sala/login" className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all group active:scale-95">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:bg-blue-100 transition-colors">
                            <GraduationCap className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">SCT</h2>
                        <p className="text-slate-500 text-sm leading-relaxed">Gestão de chamadas e liberação de alunos em sala.</p>
                    </Link>

                    {/* Admin */}
                    <Link to="/admin/login" className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all group sm:col-span-2 md:col-span-1 active:scale-95">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:bg-slate-200 transition-colors">
                            <Shield className="w-6 h-6 md:w-8 md:h-8 text-slate-700" />
                        </div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Administrador</h2>
                        <p className="text-slate-500 text-sm leading-relaxed">Configurações do sistema, cadastro de usuários e relatórios.</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, User, School, Loader2 } from 'lucide-react';

export default function Setup() {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const createAccount = async (role: 'RECEPCIONISTA' | 'PROFESSOR' | 'ADMIN', emailPrefix: string) => {
        setLoading(true);
        const email = `${emailPrefix}@escola.com`;
        const password = 'password123';

        addLog(`Criando conta ${role}: ${email}...`);

        try {
            // 1. Sign Up
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    addLog(`⚠️ Usuário ${email} já existe no Auth.`);
                } else {
                    throw authError;
                }
            }

            if (authData.user) {
                addLog(`✅ Usuário Auth criado! ID: ${authData.user.id}`);

                // 2. Create Profile in public.usuarios
                // Hardcode School ID from our previous seed
                const esc_id = 'e6328325-1845-420a-b333-87a747953259';

                const { error: profileError } = await supabase
                    .from('usuarios')
                    .insert({
                        id: authData.user.id, // VITAL: Link Auth ID to Profile ID
                        escola_id: esc_id,
                        nome: `${role.charAt(0) + role.slice(1).toLowerCase()} Teste`,
                        email: email,
                        tipo_usuario: role,
                        turma_atribuida: role === 'PROFESSOR' ? '1º Ano A' : null,
                        ativo: true
                    });

                if (profileError) {
                    if (profileError.code === '23505') { // Unique violation
                        addLog(`⚠️ Perfil para ${email} já existe.`);
                    } else {
                        throw profileError;
                    }
                } else {
                    addLog(`✅ Perfil no Banco de Dados criado para ${role}.`);
                }
            }

        } catch (error: any) {
            addLog(`❌ Erro: ${error.message}`);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">
                <header>
                    <h1 className="text-3xl font-bold text-slate-900">Configuração Inicial e Massa de Dados</h1>
                    <p className="text-slate-500">Crie contas de teste para verificar os fluxos da aplicação.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Reception */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-4">
                            <User className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2">Recepcionista</h3>
                        <p className="text-sm text-slate-500 mb-4">recepcao@escola.com</p>
                        <button
                            onClick={() => createAccount('RECEPCIONISTA', 'recepcao')}
                            disabled={loading}
                            className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            Criar Conta
                        </button>
                    </div>

                    {/* Teacher */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                            <School className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2">Professor (1º Ano A)</h3>
                        <p className="text-sm text-slate-500 mb-4">prof.sala1@escola.com</p>
                        <button
                            onClick={() => createAccount('PROFESSOR', 'prof.sala1')}
                            disabled={loading}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Criar Conta
                        </button>
                    </div>

                    {/* Admin */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 mb-4">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-2">Administrador</h3>
                        <p className="text-sm text-slate-500 mb-4">admin@escola.com</p>
                        <button
                            onClick={() => createAccount('ADMIN', 'admin')}
                            disabled={loading}
                            className="w-full py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
                        >
                            Criar Conta
                        </button>
                    </div>
                </div>

                {/* Logs */}
                <div className="bg-slate-900 rounded-xl p-6 text-slate-300 font-mono text-sm min-h-[200px] max-h-[400px] overflow-y-auto">
                    <div className="flex items-center gap-2 text-slate-400 mb-4 pb-2 border-b border-slate-800 sticky top-0 bg-slate-900">
                        <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Logs de Execução
                    </div>
                    {logs.length === 0 ? (
                        <span className="text-slate-600 italic">Aguardando...</span>
                    ) : (
                        <ul className="space-y-1">
                            {logs.map((log, i) => (
                                <li key={i}>{log}</li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

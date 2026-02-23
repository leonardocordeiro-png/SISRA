import { useState, useEffect, useRef } from 'react';
import {
    Settings, Building2, Shield, Bell, Globe,
    Save, AlertTriangle,
    Calendar, Upload, ChevronRight, Loader2, Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';
import { fileToDataUrl } from '../../lib/imageUtils';

export default function SystemSettings() {
    const { user } = useAuth();
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [settings, setSettings] = useState({
        nome: 'Colégio La Salle',
        website: 'https://lasalle.org.br',
        endereco: 'Rua Jose Bonifacio, 212 - Canoas, RS',
        logo_url: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&q=80&w=200',
        security: {
            twoFactor: true,
            autoLogout: true,
            ipWhitelist: false,
            idEncryption: true,
        },
        notifications: {
            emailAlerts: true,
            pushNotifications: true,
            smsEmergencies: false,
        },
        academic: {
            allowLatePickup: true,
            strictSchedule: false,
        },
        infrastructure: {
            dynamicIp: true,
            maintenanceMode: false,
        }
    });

    const escola_id = 'e6328325-1845-420a-b333-87a747953259';

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('escolas')
                .select('*')
                .eq('id', escola_id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('Nenhum registro de escola encontrado no banco.');
                    return;
                }
                throw error;
            }

            if (data) {
                setSettings({
                    nome: data.nome ?? '',
                    website: data.website ?? '',
                    endereco: data.endereco ?? '',
                    logo_url: data.logo_url ?? '',
                    security: { ...settings.security, ...(data.config_seguranca || {}) },
                    notifications: { ...settings.notifications, ...(data.config_notificacoes || {}) },
                    academic: { ...settings.academic, ...(data.config_academica || {}) },
                    infrastructure: { ...settings.infrastructure, ...(data.config_infraestrutura || {}) },
                });
            }
        } catch (err: any) {
            console.error('Error fetching settings:', err);
            toast.error('Erro ao carregar configurações', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            let payload: any = {
                nome: settings.nome,
                website: settings.website,
                endereco: settings.endereco,
                logo_url: settings.logo_url,
                config_seguranca: settings.security,
                config_notificacoes: settings.notifications,
                config_academica: settings.academic,
                config_infraestrutura: settings.infrastructure,
            };

            let success = false;
            let missingColumns: string[] = [];

            while (!success && Object.keys(payload).length > 0) {
                const { error, count } = await supabase
                    .from('escolas')
                    .update(payload, { count: 'exact' })
                    .eq('id', escola_id);

                if (error) {
                    const message = error.message;
                    const match = message.match(/Could not find the '([^']+)' column/i);

                    if (match && match[1]) {
                        const failingColumn = match[1];
                        delete payload[failingColumn];
                        missingColumns.push(failingColumn);
                        continue;
                    }
                    throw error;
                }

                if (count === 0) {
                    throw new Error('Permissão negada ou registro não encontrado no banco de dados.');
                }

                success = true;
            }

            if (success) {
                if (missingColumns.length > 0) {
                    toast.warning(
                        'Salvamento Parcial',
                        `Dados básicos salvos, mas as colunas (${missingColumns.join(', ')}) não existem no banco.`
                    );
                } else {
                    toast.success('Configurações Salvas', 'As alterações foram aplicadas com sucesso.');
                }
            }
        } catch (err: any) {
            console.error('Error saving settings:', err);
            toast.error('Erro ao salvar', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const dataUrl = await fileToDataUrl(file);
                setSettings({ ...settings, logo_url: dataUrl });
                toast.success('Imagem preparada', 'Clique em Salvar para aplicar permanentemente.');
            } catch (err: any) {
                toast.error('Erro no upload', err.message);
            }
        }
    };

    const handleRemoveLogo = () => {
        setSettings({ ...settings, logo_url: '' });
        toast.info('Logo removida', 'Clique em Salvar para confirmar a remoção.');
    };

    const handleReset = async () => {
        if (!confirm('ATENÇÃO: Isso resetará todas as configurações para o padrão de fábrica. Continuar?')) return;

        try {
            setSaving(true);
            // In a real app, this would call a reset RPC or clear fields
            toast.info('Reset de Fábrica', 'A funcionalidade de reset completo requer permissão de Super Admin.');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'Geral', icon: Building2 },
        { id: 'security', label: 'Segurança', icon: Shield },
        { id: 'notifications', label: 'Notificações', icon: Bell },
        { id: 'academic', label: 'Acadêmico', icon: Calendar },
        { id: 'infrastructure', label: 'Infraestrutura', icon: Globe },
    ];

    return (
        <div className="bg-slate-50 dark:bg-[#0f172a] min-h-screen text-slate-800 dark:text-slate-100 font-display">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            <Settings className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-sm font-bold block leading-none">Configurações do Sistema</span>
                            <span className="text-[10px] text-slate-400 font-medium">Configuração Principal</span>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Alterações
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <NavigationControls />
                <div className="grid grid-cols-12 gap-8">
                    {/* Sidebar Tabs */}
                    <aside className="col-span-12 lg:col-span-3 space-y-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-indigo-600'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className="text-sm font-bold uppercase tracking-widest">{tab.label}</span>
                                </div>
                                {activeTab === tab.id && <ChevronRight className="w-4 h-4" />}
                            </button>
                        ))}

                        <div className="mt-10 p-6 bg-rose-50 dark:bg-rose-500/5 rounded-2xl border border-rose-100 dark:border-rose-500/10">
                            <div className="flex items-center gap-2 text-rose-600 mb-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Zona de Perigo</span>
                            </div>
                            <p className="text-[10px] text-rose-500 leading-relaxed mb-4">Ações permanentes em todo o sistema. Apenas pessoal autorizado.</p>
                            <button
                                onClick={handleReset}
                                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase rounded-lg shadow-lg shadow-rose-600/10 transition-colors"
                            >
                                Reset de Fábrica
                            </button>
                        </div>
                    </aside>

                    {/* Settings Content */}
                    <div className="col-span-12 lg:col-span-9 space-y-6">
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                        <Building2 className="text-indigo-600 w-5 h-5" />
                                        Detalhes da Instituição
                                    </h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nome da Instituição</label>
                                            <input
                                                type="text"
                                                value={settings.nome}
                                                onChange={e => setSettings({ ...settings, nome: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl border-none text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">URL do Website</label>
                                            <input
                                                type="text"
                                                value={settings.website}
                                                onChange={e => setSettings({ ...settings, website: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl border-none text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Endereço Principal</label>
                                            <textarea
                                                rows={2}
                                                value={settings.endereco}
                                                onChange={e => setSettings({ ...settings, endereco: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-xl border-none text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                                            ></textarea>
                                        </div>
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                        <Upload className="text-indigo-600 w-5 h-5" />
                                        Marca e Mídia
                                    </h3>
                                    <div className="flex items-center gap-8">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleLogoChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden">
                                            {settings.logo_url ? (
                                                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-300">
                                                    <Upload className="w-8 h-8 mb-1" />
                                                    <span className="text-[10px] uppercase font-bold">Sem Logo</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm mb-1">Logo Oficial da Instituição</h4>
                                            <p className="text-xs text-slate-400 mb-4">SVG ou PNG recomendado. Tamanho máx. 2MB.</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold uppercase rounded-lg shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
                                                >
                                                    Alterar Foto
                                                </button>
                                                {settings.logo_url && (
                                                    <button
                                                        onClick={handleRemoveLogo}
                                                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase rounded-lg hover:bg-rose-50 hover:text-rose-500 transition-colors flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Remover
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            <Shield className="text-emerald-500 w-5 h-5" />
                                            Protocolos de Segurança
                                        </h3>
                                        <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded-full">Proteção Ativa</div>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'twoFactor', title: 'Autenticação de Dois Fatores', desc: 'Exigir que a equipe confirme o acesso via token móvel.' },
                                            { id: 'autoLogout', title: 'Logout Automático', desc: 'A sessão expira após 30 minutos de inatividade.' },
                                            { id: 'ipWhitelist', title: 'IP Whitelisting', desc: 'Restringir acesso admin a redes específicas da secretaria.' },
                                            { id: 'idEncryption', title: 'Criptografia de ID de Aluno', desc: 'Ocultar números de matrícula em visualizações não autorizadas.' },
                                        ].map((item) => {
                                            const status = (settings.security as any)[item.id];
                                            return (
                                                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                    <div>
                                                        <h5 className="text-sm font-bold mb-0.5">{item.title}</h5>
                                                        <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSettings({
                                                            ...settings,
                                                            security: { ...settings.security, [item.id]: !status }
                                                        })}
                                                        className={`w-12 h-6 rounded-full relative transition-all ${status ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${status ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-rose-500">
                                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                        <AlertTriangle className="text-rose-500 w-5 h-5" />
                                        Bloqueio de Emergência
                                    </h3>
                                    <p className="text-xs text-slate-400 mb-6 font-medium leading-relaxed">Suspende instantaneamente todas as solicitações de retirada, desativa as liberações de portão e notifica todo o pessoal de segurança.</p>
                                    <button className="px-8 py-3 bg-rose-100 text-rose-600 font-black text-xs uppercase rounded-xl border border-rose-200 hover:bg-rose-600 hover:text-white transition-all">
                                        Ativar Parada de Emergência
                                    </button>
                                </section>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                        <Bell className="text-amber-500 w-5 h-5" />
                                        Alertas e Notificações
                                    </h3>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'emailAlerts', title: 'Alertas por E-mail', desc: 'Enviar resumos diários de atividades para administradores.' },
                                            { id: 'pushNotifications', title: 'Mensagens Push', desc: 'Notificar professores e portaria via navegador/app.' },
                                            { id: 'smsEmergencies', title: 'SMS de Emergência', desc: 'Ativar envio de SMS em situações críticas (Custo adicional).' },
                                        ].map((item) => {
                                            const status = (settings.notifications as any)[item.id];
                                            return (
                                                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                    <div>
                                                        <h5 className="text-sm font-bold mb-0.5">{item.title}</h5>
                                                        <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSettings({
                                                            ...settings,
                                                            notifications: { ...settings.notifications, [item.id]: !status }
                                                        })}
                                                        className={`w-12 h-6 rounded-full relative transition-all ${status ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${status ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'academic' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                        <Calendar className="text-blue-500 w-5 h-5" />
                                        Regras Acadêmicas
                                    </h3>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'allowLatePickup', title: 'Permitir Retirada Tardia', desc: 'Liberar solicitações fora do horário comercial com justificativa.' },
                                            { id: 'strictSchedule', title: 'Cronograma Rígido', desc: 'Bloquear sistema automaticamente fora dos horários de saída.' },
                                        ].map((item) => {
                                            const status = (settings.academic as any)[item.id];
                                            return (
                                                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                    <div>
                                                        <h5 className="text-sm font-bold mb-0.5">{item.title}</h5>
                                                        <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSettings({
                                                            ...settings,
                                                            academic: { ...settings.academic, [item.id]: !status }
                                                        })}
                                                        className={`w-12 h-6 rounded-full relative transition-all ${status ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${status ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'infrastructure' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <section className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                        <Globe className="text-emerald-500 w-5 h-5" />
                                        Parâmetros de Rede
                                    </h3>
                                    <div className="space-y-4">
                                        {[
                                            { id: 'dynamicIp', title: 'Suporte a IP Dinâmico', desc: 'Permitir acesso mesmo com mudança frequente de IP da operadora.' },
                                            { id: 'maintenanceMode', title: 'Modo Manutenção Externo', desc: 'Suspender acesso ao portal dos pais durante atualizações.' },
                                        ].map((item) => {
                                            const status = (settings.infrastructure as any)[item.id];
                                            return (
                                                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                    <div>
                                                        <h5 className="text-sm font-bold mb-0.5">{item.title}</h5>
                                                        <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSettings({
                                                            ...settings,
                                                            infrastructure: { ...settings.infrastructure, [item.id]: !status }
                                                        })}
                                                        className={`w-12 h-6 rounded-full relative transition-all ${status ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${status ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AlertTriangle,
    Bell,
    Building2,
    Calendar,
    ChevronRight,
    Globe,
    Loader2,
    Save,
    Settings,
    Shield,
    Trash2,
    Upload,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';
import { fileToDataUrl } from '../../lib/imageUtils';
import { useAuth } from '../../context/AuthContext';

type SecuritySettings = {
    twoFactor: boolean;
    autoLogout: boolean;
    ipWhitelist: boolean;
    idEncryption: boolean;
    emergencyStop: boolean;
};

type NotificationSettings = {
    emailAlerts: boolean;
    pushNotifications: boolean;
    smsEmergencies: boolean;
};

type AcademicSettings = {
    allowLatePickup: boolean;
    strictSchedule: boolean;
};

type InfrastructureSettings = {
    dynamicIp: boolean;
    maintenanceMode: boolean;
};

type SystemSettingsState = {
    nome: string;
    website: string;
    endereco: string;
    logo_url: string;
    security: SecuritySettings;
    notifications: NotificationSettings;
    academic: AcademicSettings;
    infrastructure: InfrastructureSettings;
};

type TabId = 'general' | 'security' | 'notifications' | 'academic' | 'infrastructure';

const DEFAULT_SETTINGS: SystemSettingsState = {
    nome: 'Colegio La Salle',
    website: '',
    endereco: '',
    logo_url: '',
    security: {
        twoFactor: true,
        autoLogout: true,
        ipWhitelist: false,
        idEncryption: true,
        emergencyStop: false,
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
    },
};

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

function normalizeSettings(payload: Partial<SystemSettingsState> | null | undefined): SystemSettingsState {
    return {
        ...DEFAULT_SETTINGS,
        ...(payload ?? {}),
        security: { ...DEFAULT_SETTINGS.security, ...(payload?.security ?? {}) },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...(payload?.notifications ?? {}) },
        academic: { ...DEFAULT_SETTINGS.academic, ...(payload?.academic ?? {}) },
        infrastructure: { ...DEFAULT_SETTINGS.infrastructure, ...(payload?.infrastructure ?? {}) },
    };
}

function friendlyError(error: unknown) {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    if (message.includes('ACESSO_NEGADO')) return 'Apenas administradores da escola podem alterar estas configuracoes.';
    if (message.includes('ESCOLA_NAO_ENCONTRADA')) return 'A escola vinculada ao usuario nao foi encontrada.';
    if (message.includes('WEBSITE_INVALIDO')) return 'Informe um website valido iniciando com http:// ou https://.';
    if (message.includes('LOGO_MUITO_GRANDE')) return 'A logo excede o limite de 2 MB apos processamento.';
    return message || 'Erro inesperado.';
}

function Toggle({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            aria-pressed={checked}
            className={`relative h-7 w-14 shrink-0 rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                checked ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-300 dark:bg-slate-700'
            }`}
        >
            <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                    checked ? 'left-8' : 'left-1'
                }`}
            />
        </button>
    );
}

export default function SystemSettings() {
    const toast = useToast();
    const { escolaId } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<SystemSettingsState>(DEFAULT_SETTINGS);

    const escola_id = escolaId ?? (import.meta.env.VITE_ESCOLA_ID as string | undefined)?.trim() ?? null;

    const fetchSettings = useCallback(async () => {
        if (!escola_id) {
            setLoading(false);
            toast.error('Escola nao identificada', 'Faca login novamente.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('sisra_get_system_settings', {
                p_escola_id: escola_id,
            });
            if (error) throw error;
            setSettings(normalizeSettings(data as Partial<SystemSettingsState>));
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Erro ao carregar configuracoes', friendlyError(error));
        } finally {
            setLoading(false);
        }
    }, [escola_id, toast]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        if (!escola_id) {
            toast.error('Escola nao identificada', 'Faca login novamente.');
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('sisra_update_system_settings', {
                p_escola_id: escola_id,
                p_nome: settings.nome,
                p_website: settings.website,
                p_endereco: settings.endereco,
                p_logo_url: settings.logo_url,
                p_security: settings.security,
                p_notifications: settings.notifications,
                p_academic: settings.academic,
                p_infrastructure: settings.infrastructure,
            });
            if (error) throw error;
            setSettings(normalizeSettings(data as Partial<SystemSettingsState>));
            toast.success('Configuracoes salvas', 'As alteracoes foram aplicadas e auditadas.');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Erro ao salvar', friendlyError(error));
        } finally {
            setSaving(false);
        }
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
            toast.error('Arquivo invalido', 'Envie uma imagem em PNG, JPG, SVG, HEIC ou HEIF.');
            return;
        }

        if (file.size > MAX_LOGO_SIZE_BYTES) {
            toast.error('Imagem muito grande', 'O tamanho maximo permitido para a logo e 2 MB.');
            return;
        }

        try {
            const dataUrl = await fileToDataUrl(file);
            setSettings(current => ({ ...current, logo_url: dataUrl }));
            toast.success('Imagem preparada', 'Clique em Salvar para aplicar a logo.');
        } catch (error) {
            toast.error('Erro no upload', friendlyError(error));
        }
    };

    const handleRemoveLogo = () => {
        setSettings(current => ({ ...current, logo_url: '' }));
        toast.info('Logo removida', 'Clique em Salvar para confirmar a remocao.');
    };

    const handleReset = async () => {
        if (!escola_id) return;
        if (!confirm('Isso restaurara as configuracoes operacionais para o padrao e removera logo, website e endereco. Continuar?')) {
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('sisra_reset_system_settings', {
                p_escola_id: escola_id,
            });
            if (error) throw error;
            setSettings(normalizeSettings(data as Partial<SystemSettingsState>));
            toast.success('Configuracoes restauradas', 'O reset foi aplicado e registrado na auditoria.');
        } catch (error) {
            toast.error('Erro ao restaurar', friendlyError(error));
        } finally {
            setSaving(false);
        }
    };

    const handleEmergencyStop = async () => {
        if (!escola_id || saving) return;
        const nextValue = !settings.security.emergencyStop;
        const confirmation = nextValue
            ? 'Ativar parada de emergencia? Novas solicitacoes de retirada serao bloqueadas imediatamente.'
            : 'Desativar parada de emergencia e liberar novas solicitacoes?';

        if (!confirm(confirmation)) return;

        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('sisra_set_emergency_stop', {
                p_escola_id: escola_id,
                p_enabled: nextValue,
            });
            if (error) throw error;
            setSettings(normalizeSettings(data as Partial<SystemSettingsState>));
            toast.success(
                nextValue ? 'Parada de emergencia ativada' : 'Parada de emergencia desativada',
                nextValue ? 'Novas retiradas publicas estao bloqueadas.' : 'As retiradas publicas foram liberadas.'
            );
        } catch (error) {
            toast.error('Erro na parada de emergencia', friendlyError(error));
        } finally {
            setSaving(false);
        }
    };

    const tabs: Array<{ id: TabId; label: string; icon: typeof Building2 }> = [
        { id: 'general', label: 'Geral', icon: Building2 },
        { id: 'security', label: 'Seguranca', icon: Shield },
        { id: 'notifications', label: 'Notificacoes', icon: Bell },
        { id: 'academic', label: 'Academico', icon: Calendar },
        { id: 'infrastructure', label: 'Infraestrutura', icon: Globe },
    ];

    const securityItems: Array<{
        id: keyof SecuritySettings;
        title: string;
        desc: string;
        status?: string;
    }> = [
        { id: 'twoFactor', title: 'Autenticacao de Dois Fatores', desc: 'Preferencia de exigencia de token para equipe.' },
        { id: 'autoLogout', title: 'Logout Automatico', desc: 'Preferencia para expiracao de sessao por inatividade.' },
        { id: 'ipWhitelist', title: 'IP Whitelisting', desc: 'Reserva politica de acesso por rede autorizada.' },
        { id: 'idEncryption', title: 'Protecao de Identificadores', desc: 'Oculta identificadores sensiveis em telas nao administrativas.' },
    ];

    const notificationItems: Array<{ id: keyof NotificationSettings; title: string; desc: string; status: string }> = [
        { id: 'emailAlerts', title: 'Alertas por E-mail', desc: 'Preferencia para disparos administrativos por e-mail.', status: 'Aguardando provedor SMTP/Edge Function.' },
        { id: 'pushNotifications', title: 'Mensagens Push', desc: 'Preferencia para notificacoes via navegador/app.', status: 'Aguardando provedor push.' },
        { id: 'smsEmergencies', title: 'SMS de Emergencia', desc: 'Preferencia para SMS em situacoes criticas.', status: 'Aguardando gateway SMS.' },
    ];

    const academicItems: Array<{ id: keyof AcademicSettings; title: string; desc: string; status: string }> = [
        { id: 'allowLatePickup', title: 'Permitir Retirada Tardia', desc: 'Permite futuras regras de justificativa fora de horario.', status: 'Configuracao salva no banco.' },
        { id: 'strictSchedule', title: 'Cronograma Rigido', desc: 'Reserva bloqueio por horario quando agendas globais forem cadastradas.', status: 'Configuracao salva no banco.' },
    ];

    const infrastructureItems: Array<{ id: keyof InfrastructureSettings; title: string; desc: string; status: string }> = [
        { id: 'dynamicIp', title: 'Suporte a IP Dinamico', desc: 'Mantem acesso quando a rede da escola muda de IP.', status: 'Configuracao salva no banco.' },
        { id: 'maintenanceMode', title: 'Modo Manutencao Externo', desc: 'Bloqueia login e novas chamadas nos portais publicos.', status: 'Aplicado nas RPCs publicas.' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-display text-slate-800 dark:bg-[#0f172a] dark:text-slate-100">
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/20">
                            <Settings className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <span className="block text-sm font-bold leading-none">Configuracoes do Sistema</span>
                            <span className="text-[10px] font-medium text-slate-500">Controle operacional da escola</span>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar Alteracoes
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-10">
                <NavigationControls />

                {settings.security.emergencyStop && (
                    <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <div>
                                <p className="text-sm font-black uppercase tracking-wide">Parada de emergencia ativa</p>
                                <p className="text-xs font-medium opacity-80">Novas solicitacoes publicas de retirada estao suspensas no servidor.</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-12 gap-8">
                    <aside className="col-span-12 space-y-2 lg:col-span-3">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex w-full items-center justify-between rounded-2xl p-4 transition-all ${
                                    activeTab === tab.id
                                        ? 'border border-slate-200 bg-white text-indigo-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-indigo-300'
                                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <tab.icon className="h-5 w-5" />
                                    <span className="text-sm font-bold uppercase tracking-widest">{tab.label}</span>
                                </div>
                                {activeTab === tab.id && <ChevronRight className="h-4 w-4" />}
                            </button>
                        ))}

                        <div className="mt-10 rounded-2xl border border-rose-100 bg-rose-50 p-6 dark:border-rose-500/10 dark:bg-rose-500/5">
                            <div className="mb-2 flex items-center gap-2 text-rose-600">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Zona de Perigo</span>
                            </div>
                            <p className="mb-4 text-[10px] leading-relaxed text-rose-500">Acoes globais com auditoria obrigatoria.</p>
                            <button
                                onClick={handleReset}
                                disabled={saving || loading}
                                className="w-full rounded-lg bg-rose-600 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-rose-600/10 transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Reset de Fabrica
                            </button>
                        </div>
                    </aside>

                    <div className="col-span-12 space-y-6 lg:col-span-9">
                        {loading ? (
                            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex flex-col items-center gap-3 text-slate-500">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Carregando configuracoes</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'general' && (
                                    <div className="space-y-6">
                                        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
                                                <Building2 className="h-5 w-5 text-indigo-600" />
                                                Detalhes da Instituicao
                                            </h3>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="col-span-2 sm:col-span-1">
                                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome da Instituicao</label>
                                                    <input
                                                        type="text"
                                                        value={settings.nome}
                                                        onChange={e => setSettings(current => ({ ...current, nome: e.target.value }))}
                                                        className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800"
                                                    />
                                                </div>
                                                <div className="col-span-2 sm:col-span-1">
                                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">URL do Website</label>
                                                    <input
                                                        type="url"
                                                        value={settings.website}
                                                        onChange={e => setSettings(current => ({ ...current, website: e.target.value }))}
                                                        placeholder="https://..."
                                                        className="w-full rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Endereco Principal</label>
                                                    <textarea
                                                        rows={2}
                                                        value={settings.endereco}
                                                        onChange={e => setSettings(current => ({ ...current, endereco: e.target.value }))}
                                                        className="w-full resize-none rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800"
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
                                                <Upload className="h-5 w-5 text-indigo-600" />
                                                Marca e Midia
                                            </h3>
                                            <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleLogoChange}
                                                    accept="image/*,.heic,.heif"
                                                    className="hidden"
                                                />
                                                <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                                                    {settings.logo_url ? (
                                                        <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                                                    ) : (
                                                        <div className="flex flex-col items-center text-slate-400">
                                                            <Upload className="mb-1 h-8 w-8" />
                                                            <span className="text-[10px] font-bold uppercase">Sem Logo</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="mb-1 text-sm font-bold">Logo Oficial da Instituicao</h4>
                                                    <p className="mb-4 text-xs text-slate-500">PNG, JPG, SVG, HEIC ou HEIF ate 2 MB.</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="rounded-lg bg-indigo-600 px-4 py-2 text-[10px] font-bold uppercase text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-700"
                                                        >
                                                            Alterar Foto
                                                        </button>
                                                        {settings.logo_url && (
                                                            <button
                                                                onClick={handleRemoveLogo}
                                                                className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-[10px] font-bold uppercase text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                                Remover
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                )}

                                {activeTab === 'security' && (
                                    <div className="space-y-6">
                                        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                                                <h3 className="flex items-center gap-2 text-lg font-bold">
                                                    <Shield className="h-5 w-5 text-emerald-500" />
                                                    Protocolos de Seguranca
                                                </h3>
                                                <div className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Configuracao Auditavel</div>
                                            </div>
                                            <div className="space-y-4">
                                                {securityItems.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between gap-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                                                        <div>
                                                            <h5 className="mb-0.5 text-sm font-bold">{item.title}</h5>
                                                            <p className="text-[10px] font-medium text-slate-500">{item.desc}</p>
                                                        </div>
                                                        <Toggle
                                                            checked={settings.security[item.id]}
                                                            onChange={() => setSettings(current => ({
                                                                ...current,
                                                                security: { ...current.security, [item.id]: !current.security[item.id] },
                                                            }))}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <section className="rounded-3xl border border-l-4 border-slate-200 border-l-rose-500 bg-white p-8 shadow-sm dark:border-slate-800 dark:border-l-rose-500 dark:bg-slate-900">
                                            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
                                                <AlertTriangle className="h-5 w-5 text-rose-500" />
                                                Bloqueio de Emergencia
                                            </h3>
                                            <p className="mb-6 text-xs font-medium leading-relaxed text-slate-500">Suspende instantaneamente novas solicitacoes de retirada nos portais publicos e no totem.</p>
                                            <button
                                                onClick={handleEmergencyStop}
                                                disabled={saving}
                                                className={`rounded-xl px-8 py-3 text-xs font-black uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                                    settings.security.emergencyStop
                                                        ? 'border border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                                                        : 'border border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white'
                                                }`}
                                            >
                                                {settings.security.emergencyStop ? 'Desativar Parada de Emergencia' : 'Ativar Parada de Emergencia'}
                                            </button>
                                        </section>
                                    </div>
                                )}

                                {activeTab === 'notifications' && (
                                    <SettingsList
                                        title="Alertas e Notificacoes"
                                        icon={<Bell className="h-5 w-5 text-amber-500" />}
                                        items={notificationItems}
                                        values={settings.notifications}
                                        onToggle={id => setSettings(current => ({
                                            ...current,
                                            notifications: { ...current.notifications, [id]: !current.notifications[id] },
                                        }))}
                                    />
                                )}

                                {activeTab === 'academic' && (
                                    <SettingsList
                                        title="Regras Academicas"
                                        icon={<Calendar className="h-5 w-5 text-blue-500" />}
                                        items={academicItems}
                                        values={settings.academic}
                                        onToggle={id => setSettings(current => ({
                                            ...current,
                                            academic: { ...current.academic, [id]: !current.academic[id] },
                                        }))}
                                    />
                                )}

                                {activeTab === 'infrastructure' && (
                                    <SettingsList
                                        title="Parametros de Rede"
                                        icon={<Globe className="h-5 w-5 text-emerald-500" />}
                                        items={infrastructureItems}
                                        values={settings.infrastructure}
                                        onToggle={id => setSettings(current => ({
                                            ...current,
                                            infrastructure: { ...current.infrastructure, [id]: !current.infrastructure[id] },
                                        }))}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function SettingsList<T extends Record<string, boolean>>({
    title,
    icon,
    items,
    values,
    onToggle,
}: {
    title: string;
    icon: React.ReactNode;
    items: Array<{ id: keyof T; title: string; desc: string; status: string }>;
    values: T;
    onToggle: (id: keyof T) => void;
}) {
    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold">
                {icon}
                {title}
            </h3>
            <div className="space-y-4">
                {items.map(item => (
                    <div key={String(item.id)} className="flex items-center justify-between gap-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                        <div>
                            <h5 className="mb-0.5 text-sm font-bold">{item.title}</h5>
                            <p className="text-[10px] font-medium text-slate-500">{item.desc}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{item.status}</p>
                        </div>
                        <Toggle checked={values[item.id]} onChange={() => onToggle(item.id)} />
                    </div>
                ))}
            </div>
        </section>
    );
}

import { useState, useEffect } from 'react';
import { Shield, Save, Clock, AlertTriangle, Activity, ArrowLeft, Check, Info, Bell, Loader2, Copy, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

const DEFAULT_SCHEDULE = [
    { day: 'Segunda-feira', enabled: true, start: '12:00', end: '13:00' },
    { day: 'Terça-feira', enabled: true, start: '12:00', end: '13:00' },
    { day: 'Quarta-feira', enabled: true, start: '12:00', end: '13:00' },
    { day: 'Quinta-feira', enabled: true, start: '12:00', end: '13:00' },
    { day: 'Sexta-feira', enabled: true, start: '12:00', end: '13:00' },
];

const DEFAULT_SETTINGS = {
    requirePin: true,
    allowThirdParty: false,
    emergencyPriority: true,
    custodyRestriction: true,
    restrictedPersonnel: true,
    securityAlertsEnabled: true,
};

export default function AuthorizationRules() {
    const navigate = useNavigate();
    const toast = useToast();

    const [studentData, setStudentData] = useState<any>(null);
    const [guardiansData, setGuardiansData] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE.map(d => ({ ...d })));
    const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });

    // Time conflict validation
    const hasTimeConflict = (item: typeof schedule[0]) =>
        item.enabled && item.start >= item.end;

    const anyConflict = schedule.some(hasTimeConflict);

    // Load student + guardians + existing config (edit mode)
    useEffect(() => {
        const student = sessionStorage.getItem('temp_student_data');
        const guardians = sessionStorage.getItem('temp_guardians_data');
        const editId = sessionStorage.getItem('edit_mode_student_id');

        if (student) setStudentData(JSON.parse(student));
        if (guardians) setGuardiansData(JSON.parse(guardians));

        if (editId) {
            setIsEditMode(true);
            // Pre-load existing security config from DB
            supabase
                .from('alunos')
                .select('config_seguranca')
                .eq('id', editId)
                .single()
                .then(({ data, error }) => {
                    if (!error && data?.config_seguranca) {
                        const cfg = data.config_seguranca;
                        if (cfg.schedule && Array.isArray(cfg.schedule) && cfg.schedule.length > 0) {
                            setSchedule(cfg.schedule);
                        }
                        if (cfg.settings) {
                            setSettings(prev => ({ ...prev, ...cfg.settings }));
                        }
                    }
                });
        }
    }, []);

    // Apply one day's times to all enabled days
    const applyToAll = (start: string, end: string) => {
        setSchedule(prev => prev.map(d => ({ ...d, start, end })));
    };

    // Master security alert toggle — syncs both sub-toggles
    const toggleSecurityAlerts = (enabled: boolean) => {
        setSettings(prev => ({
            ...prev,
            securityAlertsEnabled: enabled,
            custodyRestriction: enabled,
            restrictedPersonnel: enabled,
        }));
    };

    const handleFinish = async () => {
        if (isSaving) return;
        if (anyConflict) {
            toast.error('Horário inválido', 'Corrija os horários onde o Fim é anterior ao Início.');
            return;
        }
        setIsSaving(true);

        try {
            const escola_id = 'e6328325-1845-420a-b333-87a747953259';
            const editModeId = sessionStorage.getItem('edit_mode_student_id');

            // Build the correct turma string
            // Prefer fullTurma (raw DB value from bulk/manual import)
            let fullTurmaName = studentData.fullTurma || '';
            if (!fullTurmaName) {
                fullTurmaName = studentData.serie && studentData.turma
                    ? `${studentData.serie} (${studentData.turma})`
                    : studentData.turma || '';
            }

            const studentPayload = {
                escola_id,
                nome_completo: studentData.nome_completo,
                data_nascimento: studentData.data_nascimento || null,
                matricula: studentData.matricula,
                turma: fullTurmaName,
                sala: studentData.sala || '',
                foto_url: studentData.photo || null,
                observacoes: studentData.observacoes_medicas || null,
                config_seguranca: {
                    schedule,
                    settings
                }
            };

            let studentId = '';

            if (editModeId) {
                const { error: updateError } = await supabase
                    .from('alunos')
                    .update(studentPayload)
                    .eq('id', editModeId);

                if (updateError) throw updateError;
                studentId = editModeId;

                await supabase.from('autorizacoes').delete().eq('aluno_id', studentId);
            } else {
                const { data: student, error: studentError } = await supabase
                    .from('alunos')
                    .insert(studentPayload)
                    .select()
                    .single();

                if (studentError) throw studentError;
                studentId = student.id;
            }

            if (!studentId) throw new Error('Falha ao identificar ID do aluno');

            // Process Guardians
            for (const g of guardiansData) {
                const { data: existingGuardian } = await supabase
                    .from('responsaveis')
                    .select('id')
                    .eq('cpf', g.cpf)
                    .maybeSingle();

                let guardianId = existingGuardian?.id;

                if (!guardianId) {
                    const { data: newGuardian, error: guardianError } = await supabase
                        .from('responsaveis')
                        .insert({
                            nome_completo: g.nome_completo,
                            cpf: g.cpf,
                            telefone: g.telefone,
                            foto_url: g.foto_url || null
                        })
                        .select()
                        .single();

                    if (guardianError) throw guardianError;
                    guardianId = newGuardian.id;
                } else {
                    await supabase
                        .from('responsaveis')
                        .update({
                            nome_completo: g.nome_completo,
                            telefone: g.telefone,
                            foto_url: g.foto_url || null
                        })
                        .eq('id', guardianId);
                }

                const { error: authError } = await supabase
                    .from('autorizacoes')
                    .insert({
                        aluno_id: studentId,
                        responsavel_id: guardianId,
                        tipo_autorizacao: guardiansData.indexOf(g) === 0 ? 'PRINCIPAL' : 'SECUNDARIO',
                        parentesco: g.parentesco,
                        ativa: true
                    });

                if (authError) throw authError;
            }

            toast.success(
                isEditMode ? 'Aluno atualizado' : 'Aluno cadastrado',
                isEditMode ? 'As alterações foram salvas com sucesso.' : 'O aluno foi adicionado ao sistema.'
            );

            sessionStorage.removeItem('temp_student_data');
            sessionStorage.removeItem('temp_guardians_data');
            sessionStorage.removeItem('edit_mode_student_id');

            navigate('/admin/alunos');
        } catch (error: any) {
            console.error('Error saving registration:', error);
            toast.error('Erro ao salvar cadastro', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const CheckboxRow = ({
        checked,
        onChange,
        label,
        description,
        danger = false,
    }: {
        checked: boolean;
        onChange: () => void;
        label: string;
        description: string;
        danger?: boolean;
    }) => (
        <label className="flex items-start gap-4 p-5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 cursor-pointer group">
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 mt-0.5 ${checked ? (danger ? 'bg-red-500 border-red-500' : 'bg-blue-500 border-blue-500') : 'border-slate-200 bg-white'}`}>
                <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
                {checked && <Check className="w-4 h-4 text-white" />}
            </div>
            <div>
                <p className="font-bold text-sm text-slate-900">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
            </div>
        </label>
    );

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800 font-display">
            <div className="max-w-6xl mx-auto px-6 py-8">
                <NavigationControls />

                <div className="mb-10 text-center md:text-left">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Finalizar Configuração de Segurança</h1>
                    <p className="text-slate-500">Defina os horários de retirada e regras de autorização para o estudante.</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center mb-12">
                    <div className="flex items-center w-full max-w-2xl relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
                        <div className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-500" style={{ width: '100%' }}></div>

                        {[
                            { label: 'Dados Pessoais', icon: <Check className="w-5 h-5" /> },
                            { label: 'Responsáveis', icon: <Check className="w-5 h-5" /> },
                            { label: 'Autorizações', icon: <Shield className="w-5 h-5" /> },
                        ].map((step, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center relative z-10">
                                <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    {step.icon}
                                </div>
                                <span className="mt-2 text-xs font-bold text-blue-600 uppercase tracking-widest">{step.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Student summary bar */}
                {studentData && (
                    <div className="mb-8 bg-white rounded-2xl border border-slate-200 px-6 py-4 flex items-center gap-4 shadow-sm">
                        {studentData.photo ? (
                            <img src={studentData.photo} alt="" className="w-10 h-10 rounded-xl object-cover border-2 border-slate-100" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-lg">
                                {studentData.nome_completo?.[0] || '?'}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{studentData.nome_completo}</p>
                            <p className="text-xs text-slate-500 truncate">
                                {studentData.fullTurma || (studentData.serie && studentData.turma ? `${studentData.serie} (${studentData.turma})` : studentData.turma || '—')}
                                {studentData.matricula ? ` · Matrícula: ${studentData.matricula}` : ''}
                            </p>
                        </div>
                        {isEditMode && (
                            <span className="ml-auto shrink-0 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                                Editando
                            </span>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left & Middle: Schedule & Preferences */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Weekly Pickup Schedule */}
                        <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8">
                            <div className="flex items-center justify-between gap-3 mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900">Horário Semanal de Retirada</h3>
                                </div>
                                {anyConflict && (
                                    <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Conflito de horário
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                {/* Header */}
                                <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <div className="col-span-4">Dia da Semana</div>
                                    <div className="col-span-2">Ativo</div>
                                    <div className="col-span-5">Janela (Início – Fim)</div>
                                    <div className="col-span-1"></div>
                                </div>

                                {schedule.map((item, idx) => {
                                    const conflict = hasTimeConflict(item);
                                    return (
                                        <div
                                            key={item.day}
                                            className={`grid grid-cols-12 gap-4 items-center p-4 rounded-2xl border transition-all ${conflict ? 'bg-red-50/60 border-red-200' : item.enabled ? 'bg-slate-50/50 border-slate-100' : 'bg-slate-50 border-transparent opacity-50'}`}
                                        >
                                            <div className="col-span-4 text-sm font-bold text-slate-700">{item.day}</div>
                                            <div className="col-span-2">
                                                <button
                                                    onClick={() => {
                                                        const s = [...schedule];
                                                        s[idx] = { ...s[idx], enabled: !s[idx].enabled };
                                                        setSchedule(s);
                                                    }}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${item.enabled ? 'bg-blue-500' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${item.enabled ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>
                                            <div className="col-span-5 flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={item.start}
                                                    disabled={!item.enabled}
                                                    className={`bg-white border rounded-xl px-3 py-2 text-xs font-bold w-full outline-none focus:border-blue-500 disabled:bg-slate-100 transition-colors ${conflict ? 'border-red-300' : 'border-slate-200'}`}
                                                    onChange={(e) => {
                                                        const s = [...schedule];
                                                        s[idx] = { ...s[idx], start: e.target.value };
                                                        setSchedule(s);
                                                    }}
                                                />
                                                <span className="text-slate-300 shrink-0">–</span>
                                                <input
                                                    type="time"
                                                    value={item.end}
                                                    disabled={!item.enabled}
                                                    className={`bg-white border rounded-xl px-3 py-2 text-xs font-bold w-full outline-none focus:border-blue-500 disabled:bg-slate-100 transition-colors ${conflict ? 'border-red-300' : 'border-slate-200'}`}
                                                    onChange={(e) => {
                                                        const s = [...schedule];
                                                        s[idx] = { ...s[idx], end: e.target.value };
                                                        setSchedule(s);
                                                    }}
                                                />
                                            </div>
                                            {/* Apply to all */}
                                            <div className="col-span-1 flex justify-end">
                                                <button
                                                    title="Aplicar horário a todos os dias"
                                                    disabled={!item.enabled}
                                                    onClick={() => applyToAll(item.start, item.end)}
                                                    className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-0"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {anyConflict && (
                                    <p className="text-xs text-red-500 font-medium px-4 pt-1">
                                        ⚠ O horário de Fim deve ser posterior ao horário de Início nos dias marcados.
                                    </p>
                                )}
                            </div>
                        </section>

                        {/* General Permissions */}
                        <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-8">Preferências Gerais de Acesso</h3>
                            <div className="space-y-1">
                                <CheckboxRow
                                    checked={settings.requirePin}
                                    onChange={() => setSettings(s => ({ ...s, requirePin: !s.requirePin }))}
                                    label="Exigir código PIN para retirada"
                                    description="Responsáveis devem digitar o PIN de 4 dígitos no tablet da recepção."
                                />
                                <CheckboxRow
                                    checked={settings.allowThirdParty}
                                    onChange={() => setSettings(s => ({ ...s, allowThirdParty: !s.allowThirdParty }))}
                                    label="Permitir retirada por transporte escolar"
                                    description="O estudante pode ser entregue a motoristas de transporte escolar cadastrados."
                                />
                                <CheckboxRow
                                    checked={settings.emergencyPriority}
                                    onChange={() => setSettings(s => ({ ...s, emergencyPriority: !s.emergencyPriority }))}
                                    label="Notificação prioritária de emergência"
                                    description="Notificar todos os contatos se os responsáveis primários não chegarem no horário."
                                />

                                {/* Master security alert toggle */}
                                <div className="mt-2 pt-4 border-t border-slate-100">
                                    <CheckboxRow
                                        checked={settings.securityAlertsEnabled}
                                        onChange={() => toggleSecurityAlerts(!settings.securityAlertsEnabled)}
                                        label="Ativar Alertas de Segurança Críticos"
                                        description="Sinaliza este aluno em vermelho/âmbar na recepção ao detectar restrição de custódia ou pessoas não autorizadas."
                                        danger={settings.securityAlertsEnabled}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Alerts & Medical */}
                    <div className="space-y-6">

                        {/* Security Alerts */}
                        <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden">
                            <div className={`px-6 py-4 flex items-center justify-between gap-2 transition-colors ${settings.securityAlertsEnabled ? 'bg-red-500' : 'bg-slate-400'}`}>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="text-white w-5 h-5" />
                                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Alertas de Segurança</h3>
                                </div>
                                {settings.securityAlertsEnabled && (
                                    <span className="text-[9px] font-black text-red-200 bg-red-400/40 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                        Ativo
                                    </span>
                                )}
                            </div>
                            <div className="p-6 space-y-5">
                                {/* Custody restriction */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Restrição de Custódia</span>
                                        <button
                                            onClick={() => {
                                                const next = !settings.custodyRestriction;
                                                setSettings(s => ({
                                                    ...s,
                                                    custodyRestriction: next,
                                                    securityAlertsEnabled: next || s.restrictedPersonnel,
                                                }));
                                            }}
                                            className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${settings.custodyRestriction ? 'bg-red-500' : 'bg-slate-200'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.custodyRestriction ? 'left-6' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        Bloqueia retirada por qualquer pessoa não listada explicitamente na custódia legal do aluno.
                                    </p>
                                </div>

                                {/* Restricted persons */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Pessoas Não Autorizadas</span>
                                        <button
                                            onClick={() => {
                                                const next = !settings.restrictedPersonnel;
                                                setSettings(s => ({
                                                    ...s,
                                                    restrictedPersonnel: next,
                                                    securityAlertsEnabled: s.custodyRestriction || next,
                                                }));
                                            }}
                                            className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${settings.restrictedPersonnel ? 'bg-red-500' : 'bg-slate-200'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.restrictedPersonnel ? 'left-6' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        Sinaliza o aluno ao detectar tentativas de retirada por pessoas marcadas como restritas.
                                    </p>
                                </div>

                                <div className={`p-4 rounded-2xl border transition-all ${settings.securityAlertsEnabled ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className="text-[11px] leading-relaxed italic">
                                        {settings.securityAlertsEnabled ? (
                                            <span>Alertas críticos sinalizarão o estudante em <span className="text-red-500 font-bold">vermelho</span> na recepção. A diretoria será notificada imediatamente.</span>
                                        ) : (
                                            <span className="text-slate-400">Alertas desativados. Nenhum sinal crítico será exibido na recepção.</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Medical Observation Box */}
                        <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden">
                            <div className="bg-blue-600 px-6 py-4 flex items-center gap-2">
                                <Activity className="text-white w-5 h-5" />
                                <h3 className="text-xs font-black text-white uppercase tracking-widest">Saúde & Observações</h3>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-2xl mb-4">
                                    <Bell className="w-5 h-5 text-blue-400 shrink-0" />
                                    <p className="text-[11px] text-slate-400 leading-tight">
                                        Essas notas serão visíveis para os professores durante a saída.
                                    </p>
                                </div>
                                <div className="text-sm font-bold text-slate-900 mb-2 underline decoration-blue-500">Anotações do Aluno:</div>
                                <p className={`text-xs leading-relaxed ${studentData?.observacoes_medicas ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                    {studentData?.observacoes_medicas || 'Nenhuma observação médica registrada.'}
                                </p>
                            </div>
                        </section>

                        {/* Contact Priority */}
                        <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Contatos de Emergência</h3>
                            <div className="space-y-3">
                                {guardiansData.map((g, i) => (
                                    <div key={g.id || i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-900 truncate">{g.nome_completo}</p>
                                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{g.parentesco}</p>
                                        </div>
                                    </div>
                                ))}
                                {guardiansData.length === 0 && (
                                    <p className="text-xs text-slate-400 italic text-center py-4">Nenhum responsável adicionado.</p>
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-12 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/admin/guardians/add')}
                        className="text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" /> Voltar aos Responsáveis
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={handleFinish}
                            disabled={isSaving || anyConflict}
                            className={`px-12 py-5 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-2xl shadow-blue-600/30 active:scale-[0.98] ${(isSaving || anyConflict) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            {isSaving ? 'Salvando...' : 'Finalizar e Salvar Registro'}
                        </button>
                    </div>
                </div>

                {/* Info Note */}
                <div className="mt-10 bg-slate-100 rounded-3xl p-8 flex gap-6 items-start">
                    <div className="bg-white text-blue-600 p-2 rounded-xl shadow-sm">
                        <Info className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-2 underline decoration-blue-500 underline-offset-4">Confirmação de Registro:</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Ao completar este registro, o perfil digital do aluno será ativado. O sistema gerará automaticamente as chaves de acesso para os responsáveis e as regras de segurança começarão a valer no próximo ciclo de entrada/saída.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import { User, ArrowRight, ArrowLeft, Upload, Info, X, Check, Save, Phone, CreditCard, Users, Plus, Edit2, Trash2, Camera, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NavigationControls from '../../components/NavigationControls';
import CameraCapture from '../../components/admin/CameraCapture';
import { fileToDataUrl } from '../../lib/imageUtils';
import { useToast } from '../../components/ui/Toast';

import type { Guardian } from '../../types';

export default function AddGuardian() {
    const navigate = useNavigate();
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [studentData, setStudentData] = useState<any>(null);
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        nome_completo: '',
        cpf: '',
        telefone: '',
        parentesco: 'Pai',
        foto_url: ''
    });

    // Photo Modals State
    const [showCamera, setShowCamera] = useState(false);
    const [photoLoading, setPhotoLoading] = useState(false);

    useEffect(() => {
        const student = sessionStorage.getItem('temp_student_data');
        if (student) {
            setStudentData(JSON.parse(student));
        }

        const gData = sessionStorage.getItem('temp_guardians_data');
        if (gData) {
            setGuardians(JSON.parse(gData));
        }
    }, []);

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoLoading(true);
            try {
                console.log('[AddGuardian] File selected:', file.name, 'type:', file.type, 'size:', file.size);
                const dataUrl = await fileToDataUrl(file);
                setFormData({ ...formData, foto_url: dataUrl });
            } catch (err: any) {
                console.error('[AddGuardian] Erro ao processar imagem:', err);
                const msg = err?.message?.includes?.('HEIC_NOT_SUPPORTED')
                    ? 'Formato HEIC não suportado neste navegador.\n\nPor favor:\n• Envie a foto em formato JPEG ou PNG\n• Ou no iPhone: Ajustes → Câmera → Formatos → Mais Compatível'
                    : 'Erro ao processar a imagem. Tente outro arquivo (JPEG ou PNG).';
                toast.error('Erro na imagem', msg);
            } finally {
                setPhotoLoading(false);
            }
        }
    };

    const handleCameraCapture = (image: string) => {
        console.log('[AddGuardian] Camera capture received, length:', image?.length, 'prefix:', image?.substring(0, 30));
        setFormData({ ...formData, foto_url: image });
        setShowCamera(false);
    };

    const triggerUpload = () => fileInputRef.current?.click();
    const triggerCamera = () => setShowCamera(true);

    const handleAddGuardian = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCpf = formData.cpf.replace(/\D/g, '');

        if (editingId) {
            setGuardians(guardians.map(g => g.id === editingId ? { ...formData, id: editingId, cpf: cleanCpf } : g));
            setEditingId(null);
        } else {
            const newGuardian: Guardian = {
                id: Math.random().toString(36).substr(2, 9),
                ...formData,
                cpf: cleanCpf
            };
            setGuardians([...guardians, newGuardian]);
        }
        setShowForm(false);
        setFormData({ nome_completo: '', cpf: '', telefone: '', parentesco: 'Pai', foto_url: '' });
    };

    const handleEditGuardian = (g: Guardian) => {
        setFormData({
            nome_completo: g.nome_completo || '',
            cpf: g.cpf || '',
            telefone: g.telefone || '',
            parentesco: g.parentesco || 'Pai',
            foto_url: g.foto_url || ''
        });
        setEditingId(g.id);
        setShowForm(true);
    };

    const removeGuardian = (id: string) => {
        setGuardians(guardians.filter(g => g.id !== id));
    };

    const handleNext = () => {
        if (guardians.length === 0) {
            toast.warning('Responsável necessário', 'Por favor, adicione pelo menos um responsável.');
            return;
        }
        sessionStorage.setItem('temp_guardians_data', JSON.stringify(guardians));
        navigate('/admin/regras-autorizacao');
    };

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800 font-display">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <NavigationControls />

                <div className="mb-10 text-center md:text-left">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Responsáveis Autorizados</h1>
                    <p className="text-slate-500">Gerencie quem tem permissão para retirar o estudante da escola.</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center mb-12">
                    <div className="flex items-center w-full max-w-2xl relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
                        <div className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-500" style={{ width: '50%' }}></div>

                        <div className="flex-1 flex flex-col items-center relative z-10">
                            <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Check className="w-5 h-5" />
                            </div>
                            <span className="mt-2 text-xs font-bold text-blue-600 uppercase tracking-widest">Dados Pessoais</span>
                        </div>

                        <div className="flex-1 flex flex-col items-center relative z-10">
                            <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="mt-2 text-xs font-bold text-blue-600 uppercase tracking-widest">Responsáveis</span>
                        </div>

                        <div className="flex-1 flex flex-col items-center relative z-10">
                            <div className="w-10 h-10 bg-white border-2 border-slate-200 text-slate-400 rounded-full flex items-center justify-center">
                                <ShieldIcon className="w-5 h-5" />
                            </div>
                            <span className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Autorizações</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-8 space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Lista de Responsáveis</h2>
                                <p className="text-sm text-slate-500">Pessoas autorizadas a retirar o {studentData?.nome_completo || 'estudante'}</p>
                            </div>
                            {!showForm && (
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                >
                                    <Plus className="w-5 h-5" /> Adicionar Responsável
                                </button>
                            )}
                        </div>

                        {/* Guardian Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {guardians.map((guardian) => (
                                <div key={guardian.id} className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center gap-4 relative group animate-in fade-in zoom-in duration-300">
                                    <div className="w-14 h-14 bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center text-slate-400 shrink-0 border border-slate-100">
                                        {guardian.foto_url ? (
                                            <img
                                                src={guardian.foto_url}
                                                alt={guardian.nome_completo}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                                                }}
                                            />
                                        ) : (
                                            <User className="w-7 h-7" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 truncate">{guardian.nome_completo}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg tracking-wider">
                                                {guardian.parentesco}
                                            </span>
                                            <span className="text-slate-400 text-xs truncate">{guardian.telefone}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEditGuardian(guardian)}
                                            className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 transition-all"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => removeGuardian(guardian.id)}
                                            className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Guardian Form Card */}
                        {showForm && (
                            <div className="bg-white border-2 border-blue-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/10 animate-in slide-in-from-top-4 duration-500">
                                <div className="bg-blue-500/5 px-8 py-5 border-b border-blue-500/10 flex items-center justify-between">
                                    <h3 className="font-bold flex items-center gap-2 text-slate-900">
                                        <User className="text-blue-600 w-5 h-5" />
                                        {editingId ? 'Editar Responsável' : 'Detalhes do Novo Responsável'}
                                    </h3>
                                    <button onClick={() => { setShowForm(false); setEditingId(null); setFormData({ nome_completo: '', cpf: '', telefone: '', parentesco: 'Pai', foto_url: '' }); }} className="text-slate-400 hover:text-slate-600 p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleAddGuardian} className="p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-5">
                                            {/* (Previous fields remain unchanged) */}
                                            <div>
                                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nome Completo</label>
                                                <input
                                                    required
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all font-medium"
                                                    value={formData.nome_completo}
                                                    onChange={e => setFormData({ ...formData, nome_completo: e.target.value })}
                                                    placeholder="ex: João Silva"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">CPF</label>
                                                    <div className="relative">
                                                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                        <input
                                                            required
                                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all font-medium"
                                                            value={formData.cpf}
                                                            onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                                                            placeholder="000.000.000-00"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Vínculo</label>
                                                    <select
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all font-medium appearance-none"
                                                        value={formData.parentesco}
                                                        onChange={e => setFormData({ ...formData, parentesco: e.target.value })}
                                                    >
                                                        <option>Pai</option>
                                                        <option>Mãe</option>
                                                        <option>Avô/Avó</option>
                                                        <option>Tio/Tia</option>
                                                        <option>Motorista</option>
                                                        <option>Outro</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Telefone com WhatsApp</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                    <input
                                                        required
                                                        type="tel"
                                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all font-medium"
                                                        value={formData.telefone}
                                                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                                        placeholder="(00) 00000-0000"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                                                ref={fileInputRef}
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                            />

                                            <div className="relative group">
                                                <div className="w-48 h-48 bg-slate-50 border-4 border-white shadow-xl rounded-3xl overflow-hidden flex items-center justify-center">
                                                    {photoLoading ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                                            <span className="text-xs text-slate-400 font-medium">Processando...</span>
                                                        </div>
                                                    ) : formData.foto_url ? (
                                                        <img
                                                            key={formData.foto_url.substring(0, 50)}
                                                            src={formData.foto_url}
                                                            alt="Foto do Responsável"
                                                            className="w-full h-full object-cover"
                                                            style={{ display: 'block' }}
                                                            onLoad={() => console.log('[AddGuardian] Image loaded successfully')}
                                                            onError={() => {
                                                                console.error('[AddGuardian] Image failed to load. src prefix:', formData.foto_url?.substring(0, 50));
                                                            }}
                                                        />
                                                    ) : (
                                                        <User className="w-16 h-16 text-slate-200" />
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={triggerCamera}
                                                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all border-2 border-white"
                                                >
                                                    <Camera className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="w-full space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={triggerCamera}
                                                    className="w-full py-3 bg-blue-600/10 text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600/20 transition-all text-xs"
                                                >
                                                    <Camera className="w-4 h-4" /> Tirar Foto
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={triggerUpload}
                                                    className="w-full py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all text-xs"
                                                >
                                                    <Upload className="w-4 h-4" /> Carregar Arquivo
                                                </button>
                                                {formData.foto_url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, foto_url: '' })}
                                                        className="w-full py-1 text-red-500 font-semibold text-[10px] hover:underline"
                                                    >
                                                        Remover Foto
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-10 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setShowForm(false); setEditingId(null); setFormData({ nome_completo: '', cpf: '', telefone: '', parentesco: 'Pai', foto_url: '' }); }}
                                            className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all text-sm"
                                        >
                                            Descartar
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-8 py-3 rounded-2xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 text-sm flex items-center gap-2"
                                        >
                                            <Save className="w-4 h-4" /> Salvar Responsável
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Modals */}
                        {showCamera && (
                            <CameraCapture
                                onCapture={handleCameraCapture}
                                onCancel={() => setShowCamera(false)}
                            />
                        )}

                        {/* Empty State */}
                        {!showForm && guardians.length === 0 && (
                            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-16 text-center">
                                <Users className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum responsável cadastrado</h3>
                                <p className="text-slate-500 max-w-sm mx-auto">Você precisa adicionar pelo menos um responsável autorizado para prosseguir com o registro.</p>
                            </div>
                        )}

                        {/* Navigation Actions */}
                        <div className="pt-10 flex items-center justify-between border-t border-slate-200">
                            <button
                                onClick={() => navigate('/admin/alunos/novo')}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest text-xs transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Voltar aos Dados do Aluno
                            </button>
                            <button
                                onClick={handleNext}
                                className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/25 active:scale-[0.98]"
                            >
                                Continuar Registro <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Sidebar Context */}
                    <div className="col-span-12 lg:col-span-4 lg:sticky lg:top-24 h-fit">
                        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
                            <div className="h-28 bg-gradient-to-br from-blue-600/10 to-blue-600/5 relative">
                                <div className="absolute -bottom-12 left-8">
                                    <div className="w-24 h-24 bg-white rounded-2xl border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                                        {studentData?.photo ? (
                                            <img src={studentData.photo} alt="Student" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-10 h-10 text-slate-200" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="pt-16 p-8">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-xl font-bold text-slate-900">{studentData?.nome_completo || 'Novo Aluno'}</h2>
                                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg">
                                        ID: {studentData?.matricula || 'PENDENTE'}
                                    </span>
                                </div>
                                <p className="text-slate-500 text-sm mb-8">Matriculado para {studentData?.serie || ' - '} • Turma {studentData?.turma || ' - '}</p>

                                <div className="space-y-6 pt-6 border-t border-slate-50">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">Status do Registro</span>
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                            Em Andamento - Etapa 2
                                        </div>
                                    </div>

                                    <div className="bg-blue-50/50 border border-blue-100/50 p-4 rounded-2xl flex gap-3 items-start">
                                        <Info className="w-4 h-4 text-blue-500 shrink-0" />
                                        <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                                            Pelo menos <span className="font-black">um responsável</span> deve ser registrado para prosseguir para as regras de autorização.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-6 bg-slate-900 rounded-3xl shadow-xl shadow-slate-900/10">
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Check className="w-3 h-3" /> Nota de Segurança
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Todas as pessoas autorizadas devem apresentar um documento de identidade físico no momento da retirada. As fotos serão utilizadas para verificação biométrica visual no portão.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}

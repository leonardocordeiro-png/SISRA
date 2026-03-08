import { useState, useEffect, useRef } from 'react';
import { getSalaBySerie } from '../../lib/utils';
import { User, X, Camera, Upload, Info, Calendar, CreditCard, GraduationCap, LayoutGrid, Users, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import NavigationControls from '../../components/NavigationControls';
import CameraCapture from '../../components/admin/CameraCapture';
import { fileToDataUrl } from '../../lib/imageUtils';
import { useToast } from '../../components/ui/Toast';

export default function StudentRegistration() {
    const navigate = useNavigate();
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        nome_completo: '',
        data_nascimento: '',
        matricula: '',
        serie: '',
        turma: '',
        sala: '',
        observacoes_medicas: ''
    });

    const [photo, setPhoto] = useState<string | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [turmasDisponiveis, setTurmasDisponiveis] = useState<{ serie: string, secao: string }[]>([]);

    const [showCamera, setShowCamera] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [hasCamera, setHasCamera] = useState<boolean>(false);

    const checkForCamera = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            setHasCamera(videoDevices.length > 0);
        } catch (err) {
            console.warn('Câmera não detectada ou permissão pendente:', err);
        }
    };

    const fetchTurmas = async (): Promise<{ serie: string, secao: string }[]> => {
        try {
            const { data, error } = await supabase
                .from('turmas')
                .select('nome')
                .eq('ativa', true)
                .order('nome');

            if (error) throw error;

            if (data) {
                const parsed = data.map(t => {
                    const match = t.nome.match(/^(.*?) - (.*?) \((.*?)\)$/);
                    if (match) {
                        return { serie: `${match[1]} - ${match[2]}`, secao: match[3] };
                    }
                    return null;
                }).filter(Boolean) as { serie: string, secao: string }[];

                setTurmasDisponiveis(parsed);
                return parsed;
            }
        } catch (error) {
            console.error('Erro ao buscar turmas:', error);
        }
        return [];
    };

    useEffect(() => {
        checkForCamera();

        const editId = sessionStorage.getItem('edit_mode_student_id');
        if (editId) setIsEditMode(true);

        // Load turmas first, then apply sessionStorage data
        const init = async () => {
            const loadedTurmas = await fetchTurmas();

            const data = sessionStorage.getItem('temp_student_data');
            if (data) {
                const parsed = JSON.parse(data);
                let serie = parsed.serie || '';
                let turma = parsed.turma || '';

                // fullTurma is the raw string from alunos.turma, e.g.:
                //   Manual reg:  "1º Ano - Ensino Fundamental I (111M)"
                //   Bulk import: "1º Ano (A)"
                const fullTurma: string = parsed.fullTurma || '';

                const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');

                // Helper: extract the short series prefix from any turma string
                // "1º Ano - Ensino Fundamental I (111M)" -> "1º Ano"
                // "1º Ano (A)" -> "1º Ano"
                // "1º Ano" -> "1º Ano"
                const getShortSerie = (str: string): string => {
                    const beforeDash = str.split(' - ')[0]; // text before " - "
                    const beforeParen = beforeDash.split('(')[0]; // text before "("
                    return beforeParen.trim();
                };

                // Helper: extract secao from turma string
                // "1º Ano - Ensino Fundamental I (111M)" -> "111M"
                // "1º Ano (A)" -> "A"
                const getSecao = (str: string): string => {
                    const m = str.match(/\(([^)]+)\)\s*$/);
                    return m ? m[1].trim() : '';
                };

                if (loadedTurmas.length > 0) {
                    const sourceStr = fullTurma || (serie && turma ? `${serie} (${turma})` : serie);

                    if (sourceStr) {
                        const shortSerie = getShortSerie(sourceStr);
                        const storedSecao = getSecao(sourceStr);

                        // Strategy 1: Exact full match (reconstructed "serie (secao)")
                        const exactMatch = loadedTurmas.find(t =>
                            normalize(`${t.serie} (${t.secao})`) === normalize(sourceStr)
                        );

                        if (exactMatch) {
                            serie = exactMatch.serie;
                            turma = exactMatch.secao;
                        } else {
                            // Strategy 2: Match by short serie prefix + secao
                            const byPrefixAndSecao = loadedTurmas.find(t =>
                                normalize(getShortSerie(t.serie)) === normalize(shortSerie) &&
                                normalize(t.secao) === normalize(storedSecao)
                            );

                            if (byPrefixAndSecao) {
                                serie = byPrefixAndSecao.serie;
                                turma = byPrefixAndSecao.secao;
                            } else {
                                // Strategy 3: Match by short serie prefix only
                                // (secao may differ between bulk import and turmas table)
                                const byPrefix = loadedTurmas.find(t =>
                                    normalize(getShortSerie(t.serie)) === normalize(shortSerie)
                                );

                                if (byPrefix) {
                                    serie = byPrefix.serie;
                                    // Try to find the secao: look for exact match in this serie's options
                                    const sameSerieOptions = loadedTurmas.filter(t => t.serie === byPrefix.serie);
                                    const secaoMatch = sameSerieOptions.find(t =>
                                        normalize(t.secao) === normalize(storedSecao)
                                    );
                                    turma = secaoMatch ? secaoMatch.secao : '';
                                }
                            }
                        }
                    }
                }

                setFormData({
                    nome_completo: parsed.nome_completo || '',
                    data_nascimento: parsed.data_nascimento || '',
                    matricula: parsed.matricula || '',
                    serie,
                    turma,
                    sala: parsed.sala || '',
                    observacoes_medicas: parsed.observacoes_medicas || ''
                });
                if (parsed.photo) setPhoto(parsed.photo);
            }
        };

        init();
    }, []);

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoLoading(true);
            try {
                console.log('[StudentReg] File selected:', file.name, 'type:', file.type, 'size:', file.size);
                const dataUrl = await fileToDataUrl(file);
                setPhoto(dataUrl);
            } catch (err: any) {
                console.error('[StudentReg] Erro ao processar imagem:', err);
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
        console.log('[StudentReg] Camera capture received, length:', image?.length, 'prefix:', image?.substring(0, 30));
        setPhoto(image);
        setShowCamera(false);
    };

    const triggerUpload = () => fileInputRef.current?.click();
    const triggerCamera = () => setShowCamera(true);


    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const calculatedSala = getSalaBySerie(formData.serie, formData.turma);

        // Retrieve fullTurma from original sessionStorage to preserve it
        const originalData = JSON.parse(sessionStorage.getItem('temp_student_data') || '{}');
        const fullTurma = originalData.fullTurma || '';

        sessionStorage.setItem('temp_student_data', JSON.stringify({
            ...formData,
            fullTurma,
            sala: calculatedSala,
            photo
        }));
        navigate('/admin/guardians/add');
    };

    // Obter séries únicas e seções únicas (ou filtradas)
    const seriesUnicas = Array.from(new Set(turmasDisponiveis.map(t => t.serie)));
    const secoesDisponiveis = formData.serie
        ? turmasDisponiveis.filter(t => t.serie === formData.serie).map(t => t.secao)
        : [];

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800 font-display">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
                <NavigationControls />

                <div className="mb-8 md:mb-10 text-center md:text-left">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{isEditMode ? 'Editar Perfil do Estudante' : 'Registro do Estudante'}</h1>
                    <p className="text-sm md:text-base text-slate-500">{isEditMode ? 'Atualize as informações e fotos do estudante.' : 'Crie um novo perfil de estudante para gerenciar retiradas seguras e autorizadas.'}</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center mb-8 md:mb-12">
                    <div className="flex items-center w-full max-w-2xl relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
                        <div className="absolute top-1/2 left-0 h-0.5 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-500" style={{ width: '16.66%' }}></div>

                        <div className="flex-1 flex flex-col items-center relative z-10">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <User className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                            <span className="mt-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest">Dados Pessoais</span>
                        </div>

                        <div className="flex-1 flex flex-col items-center relative z-10">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-white border-2 border-slate-200 text-slate-400 rounded-full flex items-center justify-center">
                                <Users className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                            <span className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsáveis</span>
                        </div>

                        <div className="flex-1 flex flex-col items-center relative z-10">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-white border-2 border-slate-200 text-slate-400 rounded-full flex items-center justify-center">
                                <Shield className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                            <span className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Autorizações</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden lg:flex">
                    {/* Left: Form */}
                    <div className="flex-1 p-6 md:p-12 border-b lg:border-b-0 lg:border-r border-slate-100">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900">Detalhes de Identificação</h2>
                        </div>

                        <form onSubmit={handleNext} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome Completo do Aluno</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="ex: Jonathan Doe Smith"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                    value={formData.nome_completo}
                                    onChange={e => setFormData({ ...formData, nome_completo: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Data de Nascimento</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input
                                            required
                                            type="date"
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                            value={formData.data_nascimento}
                                            onChange={e => setFormData({ ...formData, data_nascimento: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Matrícula Interna</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="SIS-2024-001"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all uppercase"
                                        value={formData.matricula}
                                        onChange={e => setFormData({ ...formData, matricula: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Série / Grau</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                        <select
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all appearance-none"
                                            value={formData.serie}
                                            onChange={e => setFormData({ ...formData, serie: e.target.value, turma: '' })}
                                        >
                                            <option value="">Selecione...</option>
                                            {seriesUnicas.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                            {seriesUnicas.length === 0 && <option disabled>Nenhuma série cadastrada</option>}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Turma / Seção</label>
                                    <div className="relative">
                                        <LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                                        <select
                                            required
                                            disabled={!formData.serie}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all appearance-none disabled:opacity-50"
                                            value={formData.turma}
                                            onChange={e => setFormData({ ...formData, turma: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            {secoesDisponiveis.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Observações Médicas Especiais (Opcional)</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all h-28 resize-none"
                                    placeholder="Alergias, condições crônicas, etc."
                                    value={formData.observacoes_medicas}
                                    onChange={e => setFormData({ ...formData, observacoes_medicas: e.target.value })}
                                ></textarea>
                            </div>
                        </form>
                    </div>

                    {/* Right: Photo Section */}
                    <div className="lg:w-96 bg-slate-50/50 p-6 md:p-12 flex flex-col items-center">
                        <div className="flex items-center gap-3 self-start mb-8">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                                <Camera className="w-5 h-5" />
                            </div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900">Foto do Aluno</h2>
                        </div>

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                            ref={fileInputRef}
                            onChange={handlePhotoChange}
                            className="hidden"
                        />

                        <div className="relative mb-8 group">
                            <div className="w-64 h-64 bg-white rounded-3xl border-4 border-white shadow-xl shadow-slate-200 overflow-hidden flex items-center justify-center relative">
                                {photoLoading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                        <span className="text-xs text-slate-400 font-medium">Processando...</span>
                                    </div>
                                ) : photo ? (
                                    <img
                                        key={photo.substring(0, 50)}
                                        src={photo}
                                        alt="Foto do Estudante"
                                        className="w-full h-full object-cover"
                                        style={{ display: 'block' }}
                                        onLoad={() => console.log('[StudentReg] Image loaded successfully')}
                                        onError={() => {
                                            console.error('[StudentReg] Image failed to load. src prefix:', photo?.substring(0, 50));
                                        }}
                                    />
                                ) : (
                                    <User className="w-24 h-24 text-slate-200" />
                                )}
                            </div>
                            <button
                                onClick={triggerCamera}
                                className="absolute -bottom-3 -right-3 w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all border-4 border-white active:scale-90"
                            >
                                <Camera className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-slate-500 text-center mb-10 leading-relaxed px-4">
                            Tire uma foto agora ou carregue um arquivo. Esta imagem será usada no crachá digital.
                        </p>

                        <div className="w-full space-y-4">
                            {hasCamera && (
                                <button
                                    type="button"
                                    onClick={triggerCamera}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] text-sm md:text-base"
                                >
                                    <Camera className="w-5 h-5" /> {window.innerWidth < 768 ? 'Tirar Foto' : 'Capturar da Webcam'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={triggerUpload}
                                className={`w-full py-4 border rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] text-sm md:text-base ${!hasCamera
                                    ? 'bg-blue-600 text-white border-transparent shadow-lg hover:bg-blue-700'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <Upload className="w-5 h-5" /> {hasCamera ? 'Carregar Arquivo' : 'Enviar Foto do Dispositivo'}
                            </button>
                            {photo && (
                                <button
                                    type="button"
                                    onClick={() => setPhoto(null)}
                                    className="w-full py-2 text-red-500 font-semibold text-sm hover:underline"
                                >
                                    Remover Foto
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modals */}
                {showCamera && (
                    <CameraCapture
                        onCapture={handleCameraCapture}
                        onCancel={() => setShowCamera(false)}
                    />
                )}

                {/* Footer Actions */}
                <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-6">
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('temp_student_data');
                            sessionStorage.removeItem('temp_guardians_data');
                            sessionStorage.removeItem('edit_mode_student_id');
                            navigate('/admin/alunos');
                        }}
                        className="text-slate-400 hover:text-red-500 font-semibold flex items-center gap-2 transition-colors uppercase tracking-widest text-[10px] md:text-xs py-2"
                    >
                        <X className="w-4 h-4" /> {isEditMode ? 'Cancelar Edição' : 'Cancelar Registro'}
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={loading}
                        className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/25 active:scale-[0.98] disabled:opacity-50 text-base"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Próxima Etapa <ArrowRight className="w-5 h-5" /></>}
                    </button>
                </div>

                {/* Quick Tip */}
                <div className="mt-10 bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex gap-4 items-start">
                    <div className="bg-blue-500 text-white p-1 rounded-md">
                        <Info className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-blue-900 mb-1">Dica Rápida:</h4>
                        <p className="text-sm text-blue-700 leading-relaxed">
                            Certifique-se de que o nome do aluno corresponda à certidão de nascimento oficial para evitar confusão com autorizações legais nas próximas etapas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

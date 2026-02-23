import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Camera, Shield, CheckCircle2, AlertCircle, Loader2, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CameraCapture from '../../components/admin/CameraCapture';
import { fileToDataUrl } from '../../lib/imageUtils';
import { useToast } from '../../components/ui/Toast';
import QRCodeStyling from 'qr-code-styling';
import domtoimage from 'dom-to-image-more';
import { Download, Printer, Plus } from 'lucide-react';

export default function SelfRegistration() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [validating, setValidating] = useState(true);
    const [student, setStudent] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [lastRegisteredGuardian, setLastRegisteredGuardian] = useState<any>(null);
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);

    const [formData, setFormData] = useState({
        nome: '',
        cpf: '',
        telefone: '',
        parentesco: 'Pai/Mãe',
        parentescoOutro: '',
    });
    const [photo, setPhoto] = useState<string | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    useEffect(() => {
        validateToken();
    }, [token]);

    useEffect(() => {
        if (success && lastRegisteredGuardian && qrRef.current) {
            generateQRCode();
        }
    }, [success, lastRegisteredGuardian]);

    const generateQRCode = () => {
        if (!lastRegisteredGuardian?.qr_code) return;

        qrCode.current = new QRCodeStyling({
            width: 300,
            height: 300,
            data: lastRegisteredGuardian.qr_code,
            type: 'canvas',
            dotsOptions: { color: '#047857', type: 'rounded' },
            backgroundOptions: { color: '#ffffff' },
            imageOptions: { crossOrigin: 'anonymous', margin: 10 }
        });

        if (qrRef.current) {
            qrRef.current.innerHTML = '';
            qrCode.current.append(qrRef.current);
        }
    };

    const validateToken = async () => {
        if (!token) {
            setError('Token de acesso não fornecido.');
            setValidating(false);
            return;
        }

        try {
            const { data, error: tokenError } = await supabase
                .from('tokens_acesso')
                .select('*, alunos(*)')
                .eq('token', token)
                .single();

            if (tokenError || !data) {
                setError('Link de acesso inválido ou expirado.');
            } else {
                setStudent(data.alunos);
            }
        } catch (err) {
            setError('Erro ao validar acesso.');
        } finally {
            setValidating(false);
            setLoading(false);
        }
    };

    const handleCameraCapture = (image: string) => {
        console.log('[SelfReg] Camera capture received, length:', image?.length, 'prefix:', image?.substring(0, 30));
        setPhoto(image);
        setShowCamera(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoLoading(true);
            try {
                console.log('[SelfReg] File selected:', file.name, 'type:', file.type, 'size:', file.size);
                const dataUrl = await fileToDataUrl(file);
                setPhoto(dataUrl);
            } catch (err: any) {
                console.error('[SelfReg] Erro ao processar imagem:', err);
                const msg = err?.message?.includes?.('HEIC_NOT_SUPPORTED')
                    ? 'Formato HEIC não suportado neste navegador.\n\nPor favor:\n• Envie a foto em formato JPEG ou PNG\n• Ou no iPhone: Ajustes → Câmera → Formatos → Mais Compatível'
                    : 'Erro ao processar a imagem. Tente outro arquivo (JPEG ou PNG).';
                toast.error('Erro na imagem', msg);
            } finally {
                setPhotoLoading(false);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo) {
            toast.warning('Foto necessária', 'Por favor, tire uma foto para sua identificação de segurança.');
            return;
        }

        setLoading(true);
        try {
            // 1. Check if guardian already exists by CPF
            const { data: existingGuardian } = await supabase
                .from('responsaveis')
                .select('*')
                .eq('cpf', formData.cpf)
                .limit(1)
                .maybeSingle();

            let guardian;

            if (existingGuardian) {
                // Update existing guardian info
                const { data: updatedGuardian, error: uError } = await supabase
                    .from('responsaveis')
                    .update({
                        nome_completo: formData.nome,
                        telefone: formData.telefone,
                        foto_url: photo,
                    })
                    .eq('id', existingGuardian.id)
                    .select()
                    .maybeSingle();

                if (uError) throw uError;
                guardian = updatedGuardian;
            } else {
                // Create new guardian
                const { data: newGuardian, error: gError } = await supabase
                    .from('responsaveis')
                    .insert({
                        nome_completo: formData.nome,
                        cpf: formData.cpf,
                        telefone: formData.telefone,
                        foto_url: photo,
                    })
                    .select()
                    .maybeSingle();

                if (gError) throw gError;
                guardian = newGuardian;
            }

            // 2. Create Authorization
            const finalParentesco = formData.parentesco === 'Outro' ? formData.parentescoOutro : formData.parentesco;

            const { error: aError } = await supabase
                .from('autorizacoes')
                .insert({
                    aluno_id: student.id,
                    responsavel_id: guardian.id,
                    tipo_autorizacao: 'SECUNDARIO',
                    parentesco: finalParentesco || 'Outro',
                    ativa: true
                });

            if (aError) throw aError;

            // 3. Create/Get QR Card
            const qrValue = `LaSalleCheguei-${guardian.id}-${Date.now()}`;
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 12); // Valid for 1 year for self-reg

            const { error: qrError } = await supabase
                .from('parent_qr_cards')
                .insert({
                    responsavel_id: guardian.id,
                    qr_code: qrValue,
                    expires_at: expiresAt.toISOString(),
                    active: true
                });

            if (qrError) throw qrError;

            setLastRegisteredGuardian({
                ...guardian,
                qr_code: qrValue,
                expires_at: expiresAt.toISOString()
            });
            setSuccess(true);
            toast.success('Cadastro concluído', 'Responsável cadastrado e autorizado com sucesso.');
        } catch (err: any) {
            toast.error('Erro no cadastro', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetForm = () => {
        setFormData({
            nome: '',
            cpf: '',
            telefone: '',
            parentesco: 'Pai/Mãe',
            parentescoOutro: '',
        });
        setPhoto(null);
        setSuccess(false);
        setLastRegisteredGuardian(null);
    };

    const handleDownload = async () => {
        const cardElement = document.getElementById('qr-card-printable');
        if (cardElement && lastRegisteredGuardian) {
            setLoading(true);
            try {
                if (qrRef.current && qrRef.current.innerHTML === '' && qrCode.current) {
                    qrCode.current.append(qrRef.current);
                }

                // Allow time for QR component to be ready
                await new Promise(resolve => setTimeout(resolve, 500));

                const dataUrl = await domtoimage.toPng(cardElement, {
                    bgcolor: '#ffffff',
                    width: cardElement.offsetWidth,
                    height: cardElement.offsetHeight,
                    cacheBust: true,
                    style: {
                        borderRadius: '2.5rem'
                    }
                });

                const link = document.createElement('a');
                link.download = `cartao-qr-${lastRegisteredGuardian.nome_completo.toLowerCase().replace(/\s+/g, '-')}.png`;
                link.href = dataUrl;
                link.click();
                toast.success('Sucesso', 'Download iniciado!');
            } catch (err) {
                console.error('Error downloading QR:', err);
                toast.error('Erro ao baixar', 'Tente tirar um print da tela.');
            } finally {
                setLoading(false);
            }
        }
    };

    if (validating) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Validando seu acesso seguro...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200 text-center max-w-md">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso Negado</h2>
                    <p className="text-slate-500 mb-8">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs"
                    >
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 font-display">
                <style>
                    {`
                    @media print {
                        body * { visibility: hidden; }
                        #qr-card-printable, #qr-card-printable * { visibility: visible; }
                        #qr-card-printable { 
                            position: fixed !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important; 
                            border: 2px solid #f1f5f9 !important; 
                            box-shadow: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .no-print { display: none !important; }
                    }
                    `}
                </style>
                <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in duration-500">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2 italic tracking-tight">Cadastro Concluído!</h2>
                        <p className="text-slate-500 mb-8 font-medium">Você cadastrou com sucesso <strong>{lastRegisteredGuardian?.nome_completo}</strong> para retirar <strong>{student?.nome_completo}</strong>.</p>
                    </div>

                    {/* QR Card Preview - Cleaned for Capture */}
                    <div id="qr-card-printable" style={{ backgroundColor: '#ffffff', border: 'none' }} className="bg-white rounded-[2.5rem] overflow-hidden">
                        <div style={{ backgroundColor: '#0f172a', border: 'none' }} className="bg-slate-900 p-8 text-center">
                            <p style={{ color: '#10b981', border: 'none', outline: 'none' }} className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-1">Identificação de Segurança</p>
                            <h3 style={{ color: '#ffffff', border: 'none', outline: 'none' }} className="text-xl font-black text-white italic tracking-tight uppercase leading-none">Colégio La Salle Sobradinho</h3>
                        </div>

                        <div className="p-8 space-y-6 text-center">
                            <div className="flex justify-center items-center gap-6 py-2">
                                {photo && (
                                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9' }} className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0">
                                        <img src={photo} alt="Foto" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div ref={qrRef} style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9' }} className="p-2 rounded-2xl flex-shrink-0 shadow-inner" />
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p style={{ color: '#94a3b8' }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Responsável</p>
                                    <p style={{ color: '#0f172a' }} className="text-xl md:text-2xl font-black text-slate-900 uppercase italic tracking-tighter text-center leading-tight break-words px-4">{lastRegisteredGuardian?.nome_completo}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                                        <p style={{ color: '#94a3b8' }} className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CPF</p>
                                        <p style={{ color: '#334155' }} className="text-xs font-black text-slate-700">{lastRegisteredGuardian?.cpf}</p>
                                    </div>
                                    <div style={{ backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                                        <p style={{ color: '#94a3b8' }} className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Aluno</p>
                                        <p style={{ color: '#334155' }} className="text-xs font-black text-slate-700 leading-tight">{student?.nome_completo}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print pt-4">
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 transition-all border border-slate-200 shadow-sm"
                                >
                                    <Download className="w-4 h-4 text-slate-500" /> Salvar PNG
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white transition-all shadow-lg shadow-emerald-500/20"
                                >
                                    <Printer className="w-4 h-4" /> Imprimir
                                </button>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9' }} className="px-8 py-4 text-center italic">
                            <p style={{ color: '#94a3b8' }} className="text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                <Shield className="w-3 h-3 text-slate-300" /> Válido por 1 ano para identificação
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 no-print pt-6">
                        <button
                            onClick={handleResetForm}
                            className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/10 active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> Adicionar Outra Pessoa
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full py-5 bg-white text-slate-400 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] hover:text-slate-600 transition-all"
                        >
                            Finalizar e Sair
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-display p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                        <Shield className="w-3 h-3" /> Acesso Seguro SISRA
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight italic">Portal do Responsável</h1>
                    <p className="text-slate-500 font-medium italic">Olá! Cadastre seus dados e foto para autorização de retirada do aluno <strong>{student?.nome_completo}</strong>.</p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 border border-slate-200/60 overflow-hidden">
                    <div className="p-8 md:p-12 border-b border-slate-50 flex flex-col items-center bg-slate-50/30">
                        <div className="relative mb-6 group">
                            <div className="w-48 h-48 bg-white rounded-[2rem] border-4 border-white shadow-xl overflow-hidden flex items-center justify-center relative">
                                {photoLoading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                                        <span className="text-xs text-slate-400 font-medium">Processando...</span>
                                    </div>
                                ) : photo ? (
                                    <img
                                        key={photo.substring(0, 50)}
                                        src={photo}
                                        alt="Foto do Responsável"
                                        className="w-full h-full object-cover"
                                        style={{ display: 'block' }}
                                        onLoad={() => console.log('[SelfReg] Image loaded successfully')}
                                        onError={() => {
                                            console.error('[SelfReg] Image failed to load. src prefix:', photo?.substring(0, 50));
                                        }}
                                    />
                                ) : (
                                    <User className="w-20 h-20 text-slate-100" />
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 w-full max-w-xs">
                            <button
                                type="button"
                                onClick={() => setShowCamera(true)}
                                className="w-full py-4 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:bg-blue-700 transition-all font-bold text-sm"
                            >
                                <Camera className="w-5 h-5" /> {window.innerWidth < 768 ? 'Tirar Selfie' : 'Capturar da Webcam'}
                            </button>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center gap-3 transition-all font-bold text-sm hover:bg-slate-200"
                            >
                                <ImageIcon className="w-5 h-5" /> Escolher da Galeria
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                                onChange={handleFileChange}
                            />
                        </div>

                        <div className="mt-6 text-center">
                            <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Foto de Identificação (Obrigatória)</h3>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest leading-relaxed">
                                Tirar uma foto nítida do rosto ou enviar da galeria
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
                        <div className="grid grid-cols-1 gap-8">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Seu Nome Completo</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ex: Maria Rodrigues Silva"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">CPF (Obrigatório)</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="000.000.000-00"
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                        value={formData.cpf}
                                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">WhatsApp / Telefone</label>
                                    <input
                                        required
                                        type="tel"
                                        placeholder="(00) 00000-0000"
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                        value={formData.telefone}
                                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Parentesco</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800 appearance-none mb-4"
                                    value={formData.parentesco}
                                    onChange={e => setFormData({ ...formData, parentesco: e.target.value })}
                                >
                                    <option value="Pai/Mãe">Pai/Mãe</option>
                                    <option value="Avô/Avó">Avô/Avó</option>
                                    <option value="Tio/Tia">Tio/Tia</option>
                                    <option value="Irmão/Irmã">Irmão/Irmã</option>
                                    <option value="Outro">Outro Autorizado</option>
                                </select>

                                {formData.parentesco === 'Outro' && (
                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Especifique o Parentesco</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ex: Padrinho, Motorista, Amigo da Família"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                            value={formData.parentescoOutro}
                                            onChange={e => setFormData({ ...formData, parentescoOutro: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalizar Cadastro <ArrowRight className="w-5 h-5" /></>}
                        </button>
                    </form>
                </div>
            </div>

            {/* Modals */}
            {showCamera && (
                <CameraCapture
                    onCapture={handleCameraCapture}
                    onCancel={() => setShowCamera(false)}
                />
            )}
        </div>
    );
}

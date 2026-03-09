import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Camera, Shield, CheckCircle2, AlertCircle, Loader2, ArrowRight, Image as ImageIcon, Download, Printer, Plus, Smartphone, QrCode } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import QRCodeStyling from 'qr-code-styling';
import domtoimage from 'dom-to-image-more';
import CameraCapture from '../../components/admin/CameraCapture';
import { fileToDataUrl } from '../../lib/imageUtils';
import { useToast } from '../../components/ui/Toast';

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

    // CPF lookup state
    const [cpfLookupGuardian, setCpfLookupGuardian] = useState<any>(null);
    const [cpfChecking, setCpfChecking] = useState(false);

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

    const generateAccessCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars like 0, O, 1, I, I
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

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

    const checkCpf = async (cpf: string) => {
        setCpfChecking(true);
        try {
            const formattedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            const { data: found } = await supabase
                .from('responsaveis')
                .select('*')
                .or(`cpf.eq.${cpf},cpf.eq.${formattedCpf}`)
                .limit(1)
                .maybeSingle();

            if (found) {
                setCpfLookupGuardian(found);
                // Pre-fill all data from existing guardian
                setFormData(prev => ({
                    ...prev,
                    nome: found.nome_completo || prev.nome,
                    telefone: found.telefone || prev.telefone,
                }));
                // Pre-fill photo if available
                if (found.foto_url) {
                    setPhoto(found.foto_url);
                }
                toast.success('Dados localizados', `Bem-vindo(a) de volta, ${found.nome_completo.split(' ')[0]}!`);
            } else {
                setCpfLookupGuardian(null);
            }
        } catch (err) {
            console.error('Error checking CPF:', err);
            setCpfLookupGuardian(null);
        } finally {
            setCpfChecking(false);
        }
    };

    const handleCpfBlur = () => {
        const cleanCpf = formData.cpf.replace(/\D/g, '');
        if (cleanCpf && cleanCpf.length === 11) {
            setFormData(prev => ({ ...prev, cpf: cleanCpf }));
            checkCpf(cleanCpf);
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
            const cleanCpf = formData.cpf.replace(/\D/g, '');
            const studentId = student.id;

            // 1. Resolve or Create Guardian
            const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            const { data: existingGuardian } = await supabase
                .from('responsaveis')
                .select('*')
                .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
                .maybeSingle();

            let guardianId = existingGuardian?.id;
            let guardianData: any;

            if (!guardianId) {
                // Generate a unique access code for new guardian
                let newAccessCode = '';
                let isUnique = false;
                let attempts = 0;
                while (!isUnique && attempts < 5) {
                    const candidate = generateAccessCode();
                    const { data: check } = await supabase
                        .from('responsaveis')
                        .select('id')
                        .eq('codigo_acesso', candidate)
                        .maybeSingle();

                    if (!check) {
                        newAccessCode = candidate;
                        isUnique = true;
                    }
                    attempts++;
                }
                if (!newAccessCode) newAccessCode = generateAccessCode();

                const { data: newGuardian, error: guardianError } = await supabase
                    .from('responsaveis')
                    .insert({
                        nome_completo: formData.nome,
                        cpf: cleanCpf,
                        telefone: formData.telefone,
                        foto_url: photo,
                        codigo_acesso: newAccessCode
                    })
                    .select()
                    .single();

                if (guardianError) throw guardianError;
                guardianId = newGuardian.id;
                guardianData = newGuardian;
            } else {
                // Ensure existing guardian has an access code
                let accessCodeToUse = existingGuardian.codigo_acesso;
                if (!accessCodeToUse) {
                    // Try to generate a unique code
                    let isUnique = false;
                    let attempts = 0;
                    while (!isUnique && attempts < 5) {
                        const newCode = generateAccessCode();
                        const { data: check } = await supabase
                            .from('responsaveis')
                            .select('id')
                            .eq('codigo_acesso', newCode)
                            .maybeSingle();

                        if (!check) {
                            accessCodeToUse = newCode;
                            isUnique = true;
                        }
                        attempts++;
                    }
                    // Fallback to random if somehow collisions persist
                    if (!accessCodeToUse) accessCodeToUse = generateAccessCode();
                }

                // Update existing guardian (name, phone, AND photo if changed)
                const { data: updatedGuardian, error: updateError } = await supabase
                    .from('responsaveis')
                    .update({
                        nome_completo: formData.nome,
                        telefone: formData.telefone,
                        foto_url: photo,
                        codigo_acesso: accessCodeToUse
                    })
                    .eq('id', guardianId)
                    .select()
                    .single();

                if (updateError) {
                    console.warn('Falha ao atualizar dados do responsável:', updateError);
                }
                guardianData = updatedGuardian || existingGuardian;
            }

            // 2. Manage Linkage (Autorizações)
            const { data: existingAuth } = await supabase
                .from('autorizacoes')
                .select('id')
                .eq('aluno_id', studentId)
                .eq('responsavel_id', guardianId)
                .maybeSingle();

            if (existingAuth) {
                toast.warning(
                    'Já autorizado',
                    `${guardianData.nome_completo} já é responsável autorizado para ${student?.nome_completo}.`
                );
                // Even if authorized, ensure junction table link exists
            } else {
                const finalParentesco = formData.parentesco === 'Outro' ? formData.parentescoOutro : formData.parentesco;
                const { error: authError } = await supabase
                    .from('autorizacoes')
                    .insert({
                        aluno_id: studentId,
                        responsavel_id: guardianId,
                        tipo_autorizacao: 'SECUNDARIO',
                        parentesco: finalParentesco || 'Outro',
                        ativa: true
                    });

                if (authError) throw authError;
            }

            // 3. Ensure linkage in junction table (alunos_responsaveis)
            const { data: existingLink } = await supabase
                .from('alunos_responsaveis')
                .select('id')
                .eq('aluno_id', studentId)
                .eq('responsavel_id', guardianId)
                .maybeSingle();

            if (!existingLink) {
                const { error: linkError } = await supabase
                    .from('alunos_responsaveis')
                    .insert({
                        aluno_id: studentId,
                        responsavel_id: guardianId
                    });

                if (linkError) {
                    console.error('Error in junction table link (alunos_responsaveis):', linkError);
                }
            }

            // 4. Manage QR Card (Synchronized with QRGenerator.tsx)
            const { data: activeCard } = await supabase
                .from('parent_qr_cards')
                .select('*')
                .eq('responsavel_id', guardianId)
                .eq('active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let qrValue: string;
            let expiresAt: string;

            if (activeCard) {
                qrValue = activeCard.qr_code;
                expiresAt = activeCard.expires_at;
            } else {
                // Look for ANY existing card (even inactive) to reuse string
                const { data: anyCard } = await supabase
                    .from('parent_qr_cards')
                    .select('qr_code')
                    .eq('responsavel_id', guardianId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                qrValue = anyCard?.qr_code || `LaSalleCheguei-${guardianId}-${Date.now()}`;
                const expDate = new Date();
                expDate.setMonth(expDate.getMonth() + 12);
                expiresAt = expDate.toISOString();

                const { error: qrError } = await supabase
                    .from('parent_qr_cards')
                    .insert({
                        responsavel_id: guardianId,
                        qr_code: qrValue,
                        expires_at: expiresAt,
                        active: true
                    });
                if (qrError) throw qrError;
            }

            // 5. Audit Log
            await logAudit('CADASTRO_RESPONSAVEL', 'responsaveis', guardianId, {
                aluno_id: studentId,
                parentesco: formData.parentesco,
                metodo: 'AUTO_CADASTRO'
            }, undefined, 'e6328325-1845-420a-b333-87a747953259');

            setLastRegisteredGuardian({
                ...guardianData,
                qr_code: qrValue,
                expires_at: expiresAt
            });
            setSuccess(true);
            toast.success('Cadastro concluído', 'Responsável autorizado com sucesso.');
        } catch (err: any) {
            console.error('Submit Error:', err);
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
        setCpfLookupGuardian(null);
    };

    const handleDownload = async () => {
        const cardElement = document.getElementById('qr-card-printable');
        if (cardElement && lastRegisteredGuardian) {
            setLoading(true);
            try {
                // Ensure QR code is appended
                if (qrRef.current && qrRef.current.innerHTML === '' && qrCode.current) {
                    qrCode.current.append(qrRef.current);
                }

                // --- STEP 1: INJECT TEMPORARY CAPTURE STYLES ---
                const captureStyle = document.createElement('style');
                captureStyle.id = 'qr-capture-override';
                captureStyle.innerHTML = `
                    #qr-card-printable {
                        width: 450px !important;
                        min-width: 450px !important;
                        border: none !important;
                        box-shadow: none !important;
                        outline: none !important;
                        border-radius: 2.5rem !important;
                        background-color: #ffffff !important;
                    }
                    /* Ensure grid items don't wrap too early during capture */
                    #qr-card-printable .grid-cols-1 {
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    }
                    /* Force everything to have transparent borders and no shadows during capture */
                    #qr-card-printable *, 
                    #qr-card-printable *::before, 
                    #qr-card-printable *::after {
                        border-color: transparent !important;
                        border-image: none !important;
                        outline: none !important;
                        box-shadow: none !important;
                        text-shadow: none !important;
                    }
                    #qr-card-printable canvas {
                        border: none !important;
                        outline: none !important;
                    }
                    #qr-card-printable .no-print {
                        display: none !important;
                    }
                `;
                document.head.appendChild(captureStyle);

                // --- STEP 2: INLINE STYLE PATCHING (belt-and-suspenders) ---
                const allElements = [cardElement, ...Array.from(cardElement.querySelectorAll('*'))] as HTMLElement[];
                const savedStyles = allElements.map(el => el.getAttribute('style'));

                allElements.forEach(el => {
                    el.style.borderColor = 'transparent';
                    el.style.outline = 'none';
                    el.style.boxShadow = 'none';
                    if (el.tagName === 'CANVAS') {
                        el.style.border = 'none';
                    }
                });

                // Let browser recalculate
                await new Promise(resolve => setTimeout(resolve, 300));

                const dataUrl = await domtoimage.toPng(cardElement, {
                    bgcolor: '#ffffff',
                    width: cardElement.offsetWidth,
                    height: cardElement.offsetHeight,
                    cacheBust: true,
                    style: {
                        borderRadius: '2.5rem'
                    }
                });

                // --- STEP 3: RESTORE EVERYTHING ---
                captureStyle.remove();
                allElements.forEach((el, i) => {
                    if (savedStyles[i] !== null) {
                        el.setAttribute('style', savedStyles[i]!);
                    } else {
                        el.removeAttribute('style');
                    }
                });

                const link = document.createElement('a');
                link.download = `cartao-qr-${lastRegisteredGuardian.nome_completo.toLowerCase().replace(/\s+/g, '-')}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Sucesso', 'Download iniciado!');
            } catch (err) {
                console.error('Error downloading QR:', err);
                document.getElementById('qr-capture-override')?.remove();
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

                    <div id="qr-card-printable" className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-900/5 transition-all hover:shadow-emerald-500/10 duration-500 group" style={{ backgroundColor: '#ffffff' }}>
                        {/* Top Branding Bar */}
                        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between relative overflow-hidden print-header" style={{ backgroundColor: '#0f172a', border: 'none' }}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}></div>
                            <div className="relative z-10">
                                <h2 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] mb-1" style={{ color: '#10B981', outline: 'none', border: 'none' }}>Instituição de Ensino</h2>
                                <p className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none" style={{ outline: 'none', border: 'none' }}>Colégio La Salle Sobradinho</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <QrCode className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        <div className="p-10 space-y-10">
                            {/* QR Code Mirror */}
                            <div className="relative flex justify-center py-6">
                                <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-3xl scale-75 animate-pulse no-print"></div>
                                <div className="relative p-6 bg-white rounded-3xl" style={{ backgroundColor: '#ffffff' }}>
                                    <div ref={qrRef} className="rounded-2xl" />
                                </div>
                            </div>

                            {/* Identification Details */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div
                                        className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden"
                                        style={{ backgroundColor: '#f1f5f9' }}
                                    >
                                        {photo ? (
                                            <img
                                                src={photo}
                                                alt={lastRegisteredGuardian?.nome_completo}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <User className="w-8 h-8 text-slate-400" style={{ color: '#94a3b8' }} />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none" style={{ color: '#94a3b8' }}>Nome do Responsável</p>
                                        <p className="text-xl md:text-2xl font-black text-slate-900 uppercase italic tracking-tighter break-words leading-tight" style={{ color: '#0f172a' }}>{lastRegisteredGuardian?.nome_completo}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-2xl flex flex-col justify-center" style={{ backgroundColor: '#f8fafc' }}>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none" style={{ color: '#94a3b8' }}>CPF</p>
                                        <p className="text-[10px] font-black text-slate-700 whitespace-nowrap" style={{ color: '#334155' }}>{lastRegisteredGuardian?.cpf}</p>
                                    </div>
                                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col justify-center" style={{ backgroundColor: '#f5f3ff' }}>
                                        <p className="text-[9px] font-black text-indigo-600/60 uppercase tracking-widest mb-1 leading-none" style={{ color: '#4f46e5' }}>Cód. Acesso</p>
                                        <p className="text-sm font-black text-indigo-700 tracking-widest leading-none" style={{ color: '#4338ca' }}>{lastRegisteredGuardian?.codigo_acesso || '---'}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-2xl flex flex-col justify-center" style={{ backgroundColor: '#f8fafc' }}>
                                        <p className="text-[9px] font-black text-emerald-600/50 uppercase tracking-widest mb-1 leading-none" style={{ color: 'rgba(5, 150, 105, 0.5)' }}>Aluno</p>
                                        <p className="text-[10px] font-black text-emerald-600 truncate leading-tight">
                                            {student?.nome_completo}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 no-print select-none">
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center justify-center gap-3 px-6 py-5 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 transition-all border border-slate-200"
                                >
                                    <Download className="w-5 h-5" /> Salvar no Celular
                                </button>
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center justify-center gap-3 px-6 py-5 bg-emerald-500 hover:bg-emerald-400 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-900 transition-all shadow-xl shadow-emerald-500/20"
                                >
                                    <Printer className="w-5 h-5" /> Imprimir Cartão
                                </button>
                            </div>
                        </div>

                        {/* Bottom Status Bar */}
                        <div className="bg-slate-100 px-10 py-6 text-center print-footer" style={{ backgroundColor: '#f1f5f9' }}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                                <Smartphone className="w-3 h-3" /> Sistema de Identificação Biométrica Integrado
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
                                    <div className="relative">
                                        <input
                                            required
                                            type="text"
                                            placeholder="000.000.000-00"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                            value={formData.cpf}
                                            onChange={e => { setFormData({ ...formData, cpf: e.target.value }); setCpfLookupGuardian(null); }}
                                            onBlur={handleCpfBlur}
                                        />
                                        {cpfChecking && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    {cpfLookupGuardian && (
                                        <div className="mt-3 flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-2xl">
                                            <div className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-0.5">Responsável Já Cadastrado</p>
                                                <p className="text-xs text-blue-600 font-medium leading-relaxed">
                                                    Os dados de <strong>{cpfLookupGuardian.nome_completo}</strong> foram preenchidos automaticamente.
                                                    Apenas a autorização para o aluno <strong>{student?.nome_completo}</strong> será criada.
                                                </p>
                                            </div>
                                        </div>
                                    )}
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

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { QrCode, Download, RefreshCw, Printer, ShieldCheck, User as UserIcon, Calendar, Smartphone, Info, Loader2, Camera } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import domtoimage from 'dom-to-image-more';
import { useRef } from 'react';
import { useToast } from '../../components/ui/Toast';

type GuardianData = {
    id: string;
    nome_completo: string;
    cpf: string;
    telefone: string;
    foto_url?: string;
    qr_code: string;
    expires_at: string;
    codigo_acesso?: string;
};

export default function ParentQRCard() {
    const [guardian, setGuardian] = useState<GuardianData | null>(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    useEffect(() => {
        fetchGuardianData();
    }, []);

    useEffect(() => {
        if (guardian && qrRef.current) {
            generateQRCode();
        }
    }, [guardian]);

    const fetchGuardianData = async () => {
        try {
            // In a real app, this would get the logged-in guardian's ID
            // For demo, we'll get the first guardian
            const { data: guardianData } = await supabase
                .from('responsaveis')
                .select('*')
                .limit(1)
                .single();

            if (!guardianData) return;

            // Check if QR card exists
            let { data: qrCard } = await supabase
                .from('parent_qr_cards')
                .select('*')
                .eq('responsavel_id', guardianData.id)
                .eq('active', true)
                .single();

            // Create or Reactivate
            if (!qrCard) {
                // Check if any card exists (even inactive) to reuse QR code
                const { data: anyCard } = await supabase
                    .from('parent_qr_cards')
                    .select('*')
                    .eq('responsavel_id', guardianData.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const newQRCode = anyCard?.qr_code || `LaSalleCheguei-${guardianData.id}-${Date.now()}`;
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + 6); // Valid for 6 months

                const { data: newCard } = await supabase
                    .from('parent_qr_cards')
                    .insert({
                        responsavel_id: guardianData.id,
                        qr_code: newQRCode,
                        expires_at: expiresAt.toISOString(),
                        active: true
                    })
                    .select()
                    .single();

                qrCard = newCard;
            }

            setGuardian({
                ...guardianData,
                qr_code: qrCard?.qr_code || '',
                expires_at: qrCard?.expires_at || '',
                codigo_acesso: guardianData.codigo_acesso
            });
        } catch (err) {
            console.error('Error fetching guardian data:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateQRCode = () => {
        if (!guardian) return;

        qrCode.current = new QRCodeStyling({
            width: 300,
            height: 300,
            data: guardian.qr_code,
            type: 'canvas',
            dotsOptions: {
                color: '#047857',
                type: 'rounded'
            },
            backgroundOptions: {
                color: '#ffffff'
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: 10
            }
        });

        if (qrRef.current) {
            qrRef.current.innerHTML = '';
            qrCode.current.append(qrRef.current);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        await fetchGuardianData();
    };

    const handleDownload = async () => {
        const cardElement = document.getElementById('qr-card-printable');
        if (cardElement && guardian) {
            try {
                // Ensure the QR code is present
                if (qrRef.current && qrRef.current.innerHTML === '' && qrCode.current) {
                    qrCode.current.append(qrRef.current);
                }

                await new Promise(resolve => setTimeout(resolve, 500));

                // --- STEP 1: INJECT OVERRIDE STYLESHEET ---
                const captureStyle = document.createElement('style');
                captureStyle.id = 'qr-capture-override';
                captureStyle.textContent = `
                    #qr-card-printable,
                    #qr-card-printable *,
                    #qr-card-printable *::before,
                    #qr-card-printable *::after {
                        border-color: transparent !important;
                        border-image: none !important;
                        outline: none !important;
                        box-shadow: none !important;
                        text-shadow: none !important;
                        text-decoration: none !important;
                    }
                    #qr-card-printable canvas {
                        border: none !important;
                        outline: none !important;
                    }
                    #qr-card-printable .capture-ignore,
                    #qr-card-printable .no-print {
                        display: none !important;
                    }
                `;
                document.head.appendChild(captureStyle);

                // --- STEP 2: ALSO PATCH INLINE STYLES (belt-and-suspenders) ---
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
                await new Promise(resolve => setTimeout(resolve, 200));

                const dataUrl = await domtoimage.toPng(cardElement, {
                    bgcolor: '#ffffff',
                    width: cardElement.offsetWidth,
                    height: cardElement.offsetHeight,
                    cacheBust: true,
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
                link.download = `meu-cartao-qr-${guardian.nome_completo.toLowerCase().replace(/\s+/g, '-')}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Sucesso', 'Download iniciado!');
            } catch (err) {
                console.error('Error in handleDownload:', err);
                document.getElementById('qr-capture-override')?.remove();
                toast.warning('Erro ao gerar imagem', 'Dica: Use o botão "Imprimir Cartão" e escolha "Salvar como PDF".');
            }
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !guardian) return;

        setUploadingPhoto(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${guardian.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('responsaveis')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('responsaveis')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('responsaveis')
                .update({ foto_url: publicUrl })
                .eq('id', guardian.id);

            if (updateError) throw updateError;

            setGuardian({ ...guardian, foto_url: publicUrl });
            toast.success('Foto atualizada', 'Sua foto de identificação foi atualizada com sucesso.');
        } catch (err) {
            console.error('Error uploading photo:', err);
            toast.error('Erro ao enviar foto', 'Tente novamente.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-black uppercase tracking-widest text-xs italic">Sincronizando Cartão...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 sm:p-12 font-sans overflow-x-hidden">
            <style>
                {`
                @media print {
                    @page {
                        margin: 0;
                        size: portrait;
                    }
                    body {
                        visibility: hidden;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #qr-card-printable, #qr-card-printable * {
                        visibility: visible;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #qr-card-printable {
                        position: absolute;
                        left: 10mm;
                        top: 10mm;
                        width: 85mm !important;
                        max-width: 85mm !important;
                        height: auto !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 6mm !important;
                        overflow: hidden !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    /* Header: dark bg with rounded top corners */
                    #qr-card-printable .print-header {
                        border-radius: 6mm 6mm 0 0 !important;
                        background-color: #0f172a !important;
                        border: none !important;
                        overflow: hidden !important;
                    }
                    /* Footer: light bg with rounded bottom corners */
                    #qr-card-printable .print-footer {
                        border-radius: 0 0 6mm 6mm !important;
                        background-color: #f1f5f9 !important;
                        border: none !important;
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                        margin-bottom: 0 !important;
                        padding: 3mm 5mm !important;
                    }
                    /* Force all borders transparent in print */
                    #qr-card-printable *,
                    #qr-card-printable *::before,
                    #qr-card-printable *::after {
                        border-color: transparent !important;
                        box-shadow: none !important;
                    }
                    #qr-card-printable .p-10 { padding: 5mm !important; }
                    #qr-card-printable .px-10 { padding-left: 5mm !important; padding-right: 5mm !important; }
                    #qr-card-printable .py-8 { padding-top: 4mm !important; padding-bottom: 4mm !important; }
                    #qr-card-printable .text-2xl { font-size: 1.25rem !important; }
                    #qr-card-printable .text-3xl { font-size: 1.5rem !important; }
                    #qr-card-printable .w-16 { width: 12mm !important; height: 12mm !important; }
                    #qr-card-printable .h-16 { height: 12mm !important; }
                    #qr-card-printable .w-12 { width: 8mm !important; height: 8mm !important; }
                    #qr-card-printable .h-12 { height: 8mm !important; }
 
                    /* Fix for info boxes (CPF, Code, Validity) in Parent View */
                    #qr-card-printable .grid-cols-2.lg\:grid-cols-3 {
                        display: grid !important;
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 2mm !important;
                    }
                    #qr-card-printable .grid-cols-2.lg\:grid-cols-3 > div {
                        padding: 2mm 1.5mm !important;
                        border-radius: 4mm !important;
                    }
                    #qr-card-printable .grid-cols-2.lg\:grid-cols-3 p:first-child {
                        font-size: 8px !important;
                        margin-bottom: 1mm !important;
                    }
                    #qr-card-printable .grid-cols-2.lg\:grid-cols-3 p:last-child,
                    #qr-card-printable .grid-cols-2.lg\:grid-cols-3 .text-sm,
                    #qr-card-printable .grid-cols-2.lg\:grid-cols-3 .text-base {
                        font-size: 10px !important;
                        letter-spacing: normal !important;
                    }
                    
                    .no-print { display: none !important; }
                }
                `}
            </style>

            <div className="max-w-xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex items-center justify-between mb-2 no-print">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Meu Cartão</h1>
                        <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Acesso Identificado</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Segurança Ativa</span>
                    </div>
                </div>

                {/* Main Card */}
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
                            <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-3xl scale-75 animate-pulse capture-ignore"></div>
                            <div className="relative p-6 bg-white rounded-3xl group-hover:scale-105 transition-transform duration-500" style={{ backgroundColor: '#ffffff' }}>
                                <div ref={qrRef} className="rounded-2xl" />
                            </div>
                        </div>

                        {/* Identification Details */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-6">
                                <div
                                    className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden cursor-pointer group/avatar"
                                    style={{ backgroundColor: '#f1f5f9' }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {guardian?.foto_url ? (
                                        <img
                                            src={guardian.foto_url}
                                            alt={guardian.nome_completo}
                                            className="w-full h-full object-cover"
                                            crossOrigin="anonymous"
                                        />
                                    ) : (
                                        <UserIcon className="w-8 h-8 text-slate-400" style={{ color: '#94a3b8' }} />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity capture-ignore" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                                        <Camera className="w-6 h-6 text-white" style={{ color: '#ffffff' }} />
                                    </div>
                                    {uploadingPhoto && (
                                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center capture-ignore" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
                                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" style={{ color: '#10B981' }} />
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handlePhotoUpload}
                                    className="hidden"
                                    accept="image/*"
                                />
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none" style={{ color: '#94a3b8' }}>Nome do Responsável</p>
                                    <p className="text-xl md:text-2xl font-black text-slate-900 uppercase italic tracking-tighter break-words leading-tight" style={{ color: '#0f172a' }}>{guardian?.nome_completo}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl" style={{ backgroundColor: '#f8fafc' }}>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none" style={{ color: '#94a3b8' }}>CPF</p>
                                    <p className="text-sm font-black text-slate-700" style={{ color: '#334155' }}>{guardian?.cpf}</p>
                                </div>
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl" style={{ backgroundColor: '#f5f3ff' }}>
                                    <p className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-1 leading-none" style={{ color: '#4f46e5' }}>Cód. Acesso</p>
                                    <p className="text-base font-black text-indigo-700 tracking-widest" style={{ color: '#4338ca' }}>{guardian?.codigo_acesso || '---'}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl" style={{ backgroundColor: '#f8fafc' }}>
                                    <p className="text-[10px] font-black text-emerald-600/50 uppercase tracking-widest mb-1 leading-none" style={{ color: 'rgba(5, 150, 105, 0.5)' }}>Validade</p>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3 text-emerald-500" style={{ color: '#10B981' }} />
                                        <p className="text-sm font-black text-emerald-600">
                                            {guardian?.expires_at ? new Date(guardian.expires_at).toLocaleDateString('pt-BR') : '--/--/----'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Disclaimer */}
                        <div className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4 no-print">
                            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-widest italic">
                                Este cartão é pessoal e intransferível. O uso inadequado pode resultar em suspensão de acesso.
                            </p>
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
                                onClick={handlePrint}
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

                {/* Secondary Actions */}
                <div className="text-center pt-4 no-print">
                    <button
                        onClick={handleRefresh}
                        className="text-[10px] font-black text-slate-400 hover:text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" /> Atualizar sincronização de dados
                    </button>
                </div>
            </div>
        </div>
    );
}

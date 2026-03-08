import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, QrCode, Download, Printer, User as UserIcon, Calendar, Smartphone, ArrowLeft, Loader2, Camera, Edit2, Check, X } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import domtoimage from 'dom-to-image-more';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';

import type { Guardian } from '../../types';

export default function AdminQRGenerator() {
    const toast = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [editingValidity, setEditingValidity] = useState(false);
    const [newValidityDate, setNewValidityDate] = useState('');
    const [updatingValidity, setUpdatingValidity] = useState(false);

    useEffect(() => {
        if (selectedGuardian && qrRef.current) {
            generateQRCode();
        }
    }, [selectedGuardian]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('responsaveis')
                .select('*')
                .or(`nome_completo.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`)
                .limit(5);

            if (error) throw error;
            setGuardians(data || []);
        } catch (err) {
            console.error('Error searching guardians:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateAccessCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const selectGuardian = async (guardian: Guardian) => {
        setGenerating(true);
        setSelectedGuardian(null);

        try {
            // Ensure guardian has an access code if missing
            let currentAccessCode = guardian.codigo_acesso;
            if (!currentAccessCode) {
                const newCode = generateAccessCode();
                const { error: updateError } = await supabase
                    .from('responsaveis')
                    .update({ codigo_acesso: newCode })
                    .eq('id', guardian.id);

                if (!updateError) {
                    currentAccessCode = newCode;
                }
            }

            // Check for existing QR card
            const { data: qrCard, error: fetchError } = await supabase
                .from('parent_qr_cards')
                .select('*')
                .eq('responsavel_id', guardian.id)
                .eq('active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(); // Limit 1 + maybeSingle is safer against data duplication

            if (fetchError) throw fetchError;

            let finalCard = qrCard;

            // Create or Reactivate
            if (!finalCard) {
                console.log('[QRGen] No active card found, searching for any existing card for responsavel:', guardian.id);
                // Check if any card exists (even inactive) to reuse QR code
                const { data: anyCard, error: anyCardError } = await supabase
                    .from('parent_qr_cards')
                    .select('*')
                    .eq('responsavel_id', guardian.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (anyCardError) {
                    console.error('[QRGen] Error searching for any existing card:', anyCardError);
                }

                const newQRCodeBase = anyCard?.qr_code || `LaSalleCheguei-${guardian.id}-${Date.now()}`;
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + 12); // Extending to 12 months as per standard

                console.log('[QRGen] Inserting/Reactivating card with QR:', newQRCodeBase);
                const { data: newCard, error: insertError } = await supabase
                    .from('parent_qr_cards')
                    .insert({
                        responsavel_id: guardian.id,
                        qr_code: newQRCodeBase,
                        expires_at: expiresAt.toISOString(),
                        active: true
                    })
                    .select()
                    .maybeSingle(); // maybeSingle instead of single() to handle RLS visibility issues gracefully

                if (insertError) {
                    console.error('[QRGen] Insert error:', insertError);
                    throw insertError;
                }
                finalCard = newCard;
            }

            setSelectedGuardian({
                ...guardian,
                qr_code: finalCard?.qr_code,
                expires_at: finalCard?.expires_at,
                codigo_acesso: currentAccessCode
            });
        } catch (err: any) {
            console.error('Error selecting guardian:', err);
            const errorMsg = err.message || 'Erro desconhecido';
            toast.error('Erro ao carregar/gerar cartão', `Detalhe: ${errorMsg}. Verifique as permissões de RLS no banco.`);
        } finally {
            setGenerating(false);
        }
    };

    const generateQRCode = () => {
        if (!selectedGuardian?.qr_code) return;

        qrCode.current = new QRCodeStyling({
            width: 300,
            height: 300,
            data: selectedGuardian.qr_code,
            type: 'canvas', // Explicitly use canvas for better html2canvas support
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

    const handleDownload = async () => {
        const cardElement = document.getElementById('qr-card-printable');
        if (cardElement && selectedGuardian) {
            setGenerating(true);
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
                    #qr-card-printable .grid-cols-3 {
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
                    // Also force border on canvas explicitly
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
                link.download = `cartao-qr-${selectedGuardian.nome_completo.toLowerCase().replace(/\s+/g, '-')}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Sucesso', 'Download iniciado!');
            } catch (err) {
                console.error('Error in handleDownload:', err);
                document.getElementById('qr-capture-override')?.remove();
                toast.error('Erro ao gerar imagem', 'Tente novamente ou use a opção imprimir.');
            } finally {
                setGenerating(false);
            }
        }
    };


    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedGuardian) return;

        setUploadingPhoto(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${selectedGuardian.id} -${Math.random()}.${fileExt} `;
            const filePath = `avatars / ${fileName} `;

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
                .eq('id', selectedGuardian.id);

            if (updateError) throw updateError;

            setSelectedGuardian({ ...selectedGuardian, foto_url: publicUrl });
            toast.success('Foto atualizada', 'A foto do responsável foi atualizada com sucesso.');
        } catch (err) {
            console.error('Error uploading photo:', err);
            toast.error('Erro ao enviar foto', 'Tente novamente com uma imagem menor.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleUpdateValidity = async () => {
        if (!selectedGuardian || !newValidityDate) return;

        setUpdatingValidity(true);
        try {
            const { error } = await supabase
                .from('parent_qr_cards')
                .update({ expires_at: new Date(newValidityDate).toISOString() })
                .eq('responsavel_id', selectedGuardian.id)
                .eq('active', true);

            if (error) throw error;

            setSelectedGuardian({ ...selectedGuardian, expires_at: new Date(newValidityDate).toISOString() });
            setEditingValidity(false);
            toast.success('Validade atualizada', 'A data de validade do cartão foi atualizada.');
        } catch (err) {
            console.error('Error updating validity:', err);
            toast.error('Erro ao atualizar validade', 'Tente novamente.');
        } finally {
            setUpdatingValidity(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
            <style>
                {`
                @media print {
                    @page {
                        margin: 0;
                        size: portrait;
                    }
                    body {
                        visibility: hidden;
                        background: white!important;
                        -webkit - print - color - adjust: exact!important;
                        print - color - adjust: exact!important;
                    }
                    #qr - card - printable, #qr - card - printable * {
                        visibility: visible;
                        - webkit - print - color - adjust: exact!important;
                    print - color - adjust: exact!important;
                }
                #qr - card - printable {
                    position: absolute;
                    left: 10mm;
                    top: 10mm;
                    width: 85mm!important;
                    max - width: 85mm!important;
                    height: auto!important;
                    box - shadow: none!important;
                    border: none!important;
                    border - radius: 6mm!important;
                    overflow: hidden!important;
                    margin: 0!important;
                    padding: 0!important;
                    background: #ffffff!important;
                }
                /* Header: dark bg with rounded top corners */
                #qr - card - printable.print - header {
                    border - radius: 6mm 6mm 0 0!important;
                    background - color: #0f172a!important;
                    border: none!important;
                    overflow: hidden!important;
                }
                /* Footer: light bg with rounded bottom corners */
                #qr - card - printable.print - footer {
                    border - radius: 0 0 6mm 6mm!important;
                    background - color: #f1f5f9!important;
                    border: none!important;
                    margin - left: 0!important;
                    margin - right: 0!important;
                    margin - bottom: 0!important;
                    padding: 3mm 5mm!important;
                }
                /* Force all borders transparent in print */
                #qr - card - printable *,
                    #qr - card - printable *:: before,
                        #qr - card - printable *::after {
                    border - color: transparent!important;
                    box - shadow: none!important;
                }
                #qr - card - printable.p - 10 { padding: 5mm!important; }
                #qr - card - printable.px - 10 { padding - left: 5mm!important; padding - right: 5mm!important; }
                #qr - card - printable.py - 8 { padding - top: 4mm!important; padding - bottom: 4mm!important; }
                #qr - card - printable.text - 2xl { font - size: 1.25rem!important; }
                #qr - card - printable.text - 3xl { font - size: 1.5rem!important; }
                #qr - card - printable.w - 16 { width: 12mm!important; height: 12mm!important; }
                #qr - card - printable.h - 16 { height: 12mm!important; }
                #qr - card - printable.w - 12 { width: 8mm!important; height: 8mm!important; }
                #qr - card - printable.h - 12 { height: 8mm!important; }

                /* Fix for info boxes (CPF, Code, Validity) */
                #qr - card - printable.grid - cols - 3,
                    #qr - card - printable.grid - cols - 1.sm\: grid - cols - 3 {
                    display: grid!important;
                    grid - template - columns: repeat(3, 1fr)!important;
                    gap: 2mm!important;
                }
                #qr - card - printable.grid - cols - 3 > div,
                    #qr - card - printable.val - box {
                    padding: 2mm 1.5mm!important;
                    border - radius: 4mm!important;
                }
                #qr - card - printable.grid - cols - 3 p: first - child,
                    #qr - card - printable.val - box p: first - child {
                    font - size: 8px!important;
                    margin - bottom: 1mm!important;
                }
                #qr - card - printable.grid - cols - 3 p: last - child,
                    #qr - card - printable.grid - cols - 3 .text - sm,
                    #qr - card - printable.grid - cols - 3 .text - base,
                    #qr - card - printable.val - box p: last - child {
                    font - size: 10px!important;
                    letter - spacing: normal!important;
                }
                    
                    .no - print { display: none!important; }
}
`}
            </style>

            <div className="max-w-4xl mx-auto">
                <div className="no-print mb-8">
                    <NavigationControls />
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Gerador de Cartão QR</h1>
                    <p className="text-slate-500 font-medium">Emita cartões de identificação para pais e responsáveis</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Search & Selection */}
                    <div className="lg:col-span-5 no-print space-y-6">
                        <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Buscar Responsável</h2>
                            <form onSubmit={handleSearch} className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Nome ou CPF..."
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl transition-all outline-none font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowLeft className="w-5 h-5 rotate-180" />}
                                </button>
                            </form>
                        </section>

                        <section className="space-y-3">
                            {guardians.length > 0 ? (
                                guardians.map((g) => (
                                    <button
                                        key={g.id}
                                        onClick={() => selectGuardian(g)}
                                        className={`w - full text - left p - 4 rounded - 2xl border - 2 transition - all flex items - center justify - between group ${selectedGuardian?.id === g.id ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-white hover:border-slate-200'} `}
                                    >
                                        <div>
                                            <p className="font-bold text-slate-900 uppercase italic tracking-tight">{g.nome_completo}</p>
                                            <p className="text-xs text-slate-500 font-medium">{g.cpf}</p>
                                        </div>
                                        <QrCode className={`w - 5 h - 5 ${selectedGuardian?.id === g.id ? 'text-emerald-500' : 'text-slate-300 group-hover:text-slate-400'} `} />
                                    </button>
                                ))
                            ) : searchTerm && !loading && (
                                <div className="text-center py-8 text-slate-400">
                                    <p className="text-sm font-medium italic">Nenhum responsável encontrado.</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right: Preview */}
                    <div className="lg:col-span-7">
                        {selectedGuardian ? (
                            <div className="space-y-6">
                                {/* The Card - Cleaned for Capture */}
                                <div id="qr-card-printable" className="bg-white rounded-[3rem] overflow-hidden relative" style={{ backgroundColor: '#ffffff' }}>
                                    {/* Capture Loader Overlay */}
                                    {generating && (
                                        <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300 capture-ignore">
                                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] italic">Capturando Cartão...</p>
                                        </div>
                                    )}
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

                                    <div className="p-10 space-y-8 text-center">
                                        <div className="flex justify-center items-center gap-6 py-2">
                                            <div ref={qrRef} />
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex items-center gap-6">
                                                <div
                                                    className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden cursor-pointer group/avatar"
                                                    style={{ backgroundColor: '#f1f5f9' }}
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    {selectedGuardian.foto_url ? (
                                                        <img
                                                            src={selectedGuardian.foto_url}
                                                            alt={selectedGuardian.nome_completo}
                                                            className="w-full h-full object-cover"
                                                            crossOrigin="anonymous"
                                                        />
                                                    ) : (
                                                        <UserIcon className="w-8 h-8 text-slate-400" style={{ color: '#94a3b8' }} />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                                                        <Camera className="w-6 h-6 text-white" style={{ color: '#ffffff' }} />
                                                    </div>
                                                    {uploadingPhoto && (
                                                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
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
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none" style={{ color: '#94a3b8' }}>Nome do Responsável</p>
                                                    <p className="text-xl md:text-2xl font-black text-slate-900 uppercase italic tracking-tighter break-words leading-tight" style={{ color: '#0f172a' }}>{selectedGuardian.nome_completo}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-3 bg-slate-50 rounded-2xl flex flex-col justify-center" style={{ backgroundColor: '#f8fafc' }}>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none" style={{ color: '#94a3b8' }}>CPF</p>
                                                    <p className="text-[10px] font-black text-slate-700 whitespace-nowrap" style={{ color: '#334155' }}>{selectedGuardian.cpf}</p>
                                                </div>
                                                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col justify-center" style={{ backgroundColor: '#f5f3ff' }}>
                                                    <p className="text-[9px] font-black text-indigo-600/60 uppercase tracking-widest mb-1 leading-none" style={{ color: '#4f46e5' }}>Cód. Acesso</p>
                                                    <p className="text-sm font-black text-indigo-700 tracking-widest leading-none" style={{ color: '#4338ca' }}>{selectedGuardian.codigo_acesso || '---'}</p>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-2xl relative group/validity val-box flex flex-col justify-center" style={{ backgroundColor: '#f8fafc' }}>
                                                    <p className="text-[9px] font-black text-emerald-600/50 uppercase tracking-widest mb-1 leading-none" style={{ color: 'rgba(5, 150, 105, 0.5)' }}>Validade</p>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <div className="flex items-center gap-1 text-left">
                                                            <Calendar className="w-3 h-3 text-emerald-500 shrink-0" style={{ color: '#10B981' }} />
                                                            {editingValidity ? (
                                                                <input
                                                                    type="date"
                                                                    className="text-xs font-black text-emerald-600 bg-transparent outline-none border-b border-emerald-500/30 w-full"
                                                                    value={newValidityDate || (selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toISOString().split('T')[0] : '')}
                                                                    onChange={(e) => setNewValidityDate(e.target.value)}
                                                                />
                                                            ) : (
                                                                <p className="text-[10px] font-black text-emerald-600 whitespace-nowrap">
                                                                    {selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toLocaleDateString('pt-BR') : '--/--/----'}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="no-print">
                                                            {editingValidity ? (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={handleUpdateValidity}
                                                                        disabled={updatingValidity}
                                                                        className="p-1 hover:bg-emerald-100 rounded-md text-emerald-600"
                                                                    >
                                                                        {updatingValidity ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingValidity(false)}
                                                                        className="p-1 hover:bg-rose-100 rounded-md text-rose-600"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingValidity(true);
                                                                        setNewValidityDate(selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toISOString().split('T')[0] : '');
                                                                    }}
                                                                    className="p-1 opacity-0 group-hover/validity:opacity-100 hover:bg-slate-200 rounded-md text-slate-400 transition-opacity"
                                                                >
                                                                    <Edit2 className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-100 px-10 py-4 text-center -mx-10 -mb-10 mt-6 print-footer" style={{ backgroundColor: '#f1f5f9' }}>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                                                <Smartphone className="w-3 h-3" /> Sistema de Identificação Biométrica Integrado
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="no-print grid grid-cols-2 gap-4">
                                    <button
                                        onClick={handleDownload}
                                        className="flex items-center justify-center gap-3 px-6 py-5 bg-white hover:bg-slate-50 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-700 transition-all border-2 border-slate-100 shadow-sm"
                                    >
                                        <Download className="w-5 h-5 text-emerald-500" /> Baixar PNG
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        className="flex items-center justify-center gap-3 px-6 py-5 bg-slate-900 hover:bg-black rounded-2xl font-black text-[10px] uppercase tracking-widest text-white transition-all shadow-xl shadow-slate-900/20"
                                    >
                                        <Printer className="w-5 h-5 text-emerald-500" /> Imprimir Agora
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[600px] bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-center px-10 text-slate-400">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                                    <QrCode className="w-10 h-10 opacity-20" />
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tighter italic">Nenhum responsável selecionado</h3>
                                <p className="text-xs font-medium max-w-xs leading-relaxed uppercase tracking-widest">Utilize a barra de pesquisa à esquerda para localizar um responsável e gerar seu cartão de acesso.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

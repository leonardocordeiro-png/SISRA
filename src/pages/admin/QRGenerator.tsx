import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { Search, QrCode, Download, Printer, User as UserIcon, Calendar, Smartphone, Loader2, Camera, Edit2, Check, X } from 'lucide-react';
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
            const cleanSearch = searchTerm.replace(/\D/g, '');
            const isCpf = cleanSearch.length === 11;
            // Sanitize: escape special ilike characters to prevent injection
            const safeTerm = searchTerm.trim().replace(/[%_\\]/g, '\\$&').slice(0, 100);

            let query = supabase.from('responsaveis').select('*');
            if (isCpf) {
                query = query.eq('cpf', cleanSearch);
            } else {
                query = query.or(`nome_completo.ilike.%${safeTerm}%,cpf.ilike.%${safeTerm}%`);
            }
            const { data, error } = await query.limit(10);

            if (error) throw error;
            setGuardians(data || []);
        } catch (err) {
            console.error('Error searching guardians:', err);
        } finally {
            setLoading(false);
        }
    };

    const generateAccessCode = () => {
        // Use CSPRNG — Math.random() is predictable and must not be used for access codes
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const array = new Uint8Array(8);
        crypto.getRandomValues(array);
        return Array.from(array, byte => chars[byte % chars.length]).join('');
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
                // Check if any card exists (even inactive) to reuse QR code
                const { data: anyCard, error: anyCardError } = await supabase
                    .from('parent_qr_cards')
                    .select('*')
                    .eq('responsavel_id', guardian.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (anyCardError && import.meta.env.DEV) {
                    console.error('[QRGen] Error searching for any existing card:', anyCardError);
                }

                const newQRCodeBase = anyCard?.qr_code || `LaSalleCheguei-${guardian.id}-${Date.now()}`;
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + 12); // Extending to 12 months as per standard

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
                    throw insertError;
                }
                finalCard = newCard;
                // Log audit: new QR card created or reactivated
                logAudit('GERACAO_CARTAO_QR', 'parent_qr_cards', finalCard?.id, {
                    responsavel_nome: guardian.nome_completo,
                    responsavel_id: guardian.id,
                    qr_code: finalCard?.qr_code,
                    acao: anyCard ? 'REATIVACAO' : 'CRIACAO_NOVA'
                });
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
            const fileExt = file.name.split('.').pop() || 'jpg';
            const randBuf = new Uint8Array(8);
            crypto.getRandomValues(randBuf);
            const randHex = Array.from(randBuf, b => b.toString(16).padStart(2, '0')).join('');
            const fileName = `${selectedGuardian.id}-${randHex}.${fileExt}`;
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
                .eq('id', selectedGuardian.id);

            if (updateError) throw updateError;

            logAudit('EDICAO_ESTUDANTE', 'responsaveis', selectedGuardian.id, {
                acao: 'ATUALIZACAO_FOTO',
                responsavel_nome: selectedGuardian.nome_completo,
            });

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
        <div style={{ minHeight: '100vh', background: '#050b1d', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap');
                @media print {
                    @page { margin: 0; size: portrait; }
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
                    #qr-card-printable .print-header {
                        border-radius: 6mm 6mm 0 0 !important;
                        background-color: #0f172a !important;
                        border: none !important;
                        overflow: hidden !important;
                    }
                    #qr-card-printable .print-footer {
                        border-radius: 0 0 6mm 6mm !important;
                        background-color: #f1f5f9 !important;
                        border: none !important;
                        margin: 0 !important;
                        padding: 3mm 5mm !important;
                    }
                    #qr-card-printable *, #qr-card-printable *::before, #qr-card-printable *::after {
                        border-color: transparent !important;
                        box-shadow: none !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
                {/* Header */}
                <div className="no-print" style={{ marginBottom: 36 }}>
                    <NavigationControls />
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: 'linear-gradient(135deg, rgba(77,166,255,0.2), rgba(0,230,118,0.15))',
                                    border: '1px solid rgba(77,166,255,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <QrCode size={20} color="#4da6ff" />
                                </div>
                                <h1 style={{
                                    fontFamily: "'Roboto Mono', monospace",
                                    fontSize: 22, fontWeight: 700, letterSpacing: 2,
                                    color: '#e2e8f0', textTransform: 'uppercase', margin: 0
                                }}>Central de Cartões QR</h1>
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0, paddingLeft: 52 }}>
                                Emita cartões de identificação para pais e responsáveis
                            </p>
                        </div>
                        <div style={{
                            background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)',
                            borderRadius: 8, padding: '6px 14px',
                            fontFamily: "'Roboto Mono', monospace", fontSize: 11,
                            color: '#00e676', letterSpacing: 1
                        }}>
                            SISTEMA ATIVO
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="no-print" style={{ height: 1, background: 'linear-gradient(90deg, rgba(77,166,255,0.3), rgba(255,215,0,0.15), transparent)', marginBottom: 36 }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 28, alignItems: 'start' }}>
                    {/* Left: Search & Selection */}
                    <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Search Panel */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,215,0,0.15)',
                            borderRadius: 16, padding: 20,
                            backdropFilter: 'blur(10px)'
                        }}>
                            <p style={{
                                fontFamily: "'Roboto Mono', monospace",
                                fontSize: 10, fontWeight: 700, letterSpacing: 3,
                                color: 'rgba(255,215,0,0.6)', textTransform: 'uppercase',
                                marginBottom: 14
                            }}>// buscar responsável</p>
                            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(77,166,255,0.5)' }} size={16} />
                                    <input
                                        type="text"
                                        placeholder="Nome ou CPF..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{
                                            width: '100%', paddingLeft: 40, paddingRight: 12,
                                            paddingTop: 11, paddingBottom: 11,
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(77,166,255,0.2)',
                                            borderRadius: 10, outline: 'none',
                                            color: '#e2e8f0', fontSize: 13,
                                            fontFamily: 'inherit', boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        padding: '11px 16px',
                                        background: 'linear-gradient(135deg, #4da6ff, #0984e3)',
                                        border: 'none', borderRadius: 10, cursor: 'pointer',
                                        color: '#fff', display: 'flex', alignItems: 'center'
                                    }}
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                </button>
                            </form>
                        </div>

                        {/* Results */}
                        {guardians.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {guardians.map((g) => (
                                    <button
                                        key={g.id}
                                        onClick={() => selectGuardian(g)}
                                        style={{
                                            width: '100%', textAlign: 'left',
                                            padding: '14px 16px',
                                            background: selectedGuardian?.id === g.id
                                                ? 'rgba(0,230,118,0.08)'
                                                : 'rgba(255,255,255,0.03)',
                                            border: selectedGuardian?.id === g.id
                                                ? '1px solid rgba(0,230,118,0.4)'
                                                : '1px solid rgba(255,255,255,0.07)',
                                            borderRadius: 12, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div>
                                            <p style={{
                                                color: selectedGuardian?.id === g.id ? '#00e676' : '#e2e8f0',
                                                fontWeight: 700, fontSize: 14, marginBottom: 2,
                                                textTransform: 'uppercase', letterSpacing: 0.5
                                            }}>{g.nome_completo}</p>
                                            <p style={{
                                                fontFamily: "'Roboto Mono', monospace",
                                                color: 'rgba(255,255,255,0.3)', fontSize: 11
                                            }}>{g.cpf}</p>
                                        </div>
                                        <QrCode size={16} color={selectedGuardian?.id === g.id ? '#00e676' : 'rgba(255,255,255,0.2)'} />
                                    </button>
                                ))}
                            </div>
                        )}

                        {searchTerm && !loading && guardians.length === 0 && (
                            <div style={{
                                padding: '24px 16px', textAlign: 'center',
                                color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic'
                            }}>
                                Nenhum responsável encontrado.
                            </div>
                        )}
                    </div>

                    {/* Right: Card Preview */}
                    <div>
                        {selectedGuardian ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Printable Card */}
                                <div
                                    id="qr-card-printable"
                                    style={{ backgroundColor: '#ffffff', borderRadius: '3rem', overflow: 'hidden', position: 'relative' }}
                                >
                                    {/* Capture Loader Overlay */}
                                    {generating && (
                                        <div className="capture-ignore" style={{
                                            position: 'absolute', inset: 0, zIndex: 50,
                                            background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12
                                        }}>
                                            <Loader2 size={36} color="#047857" className="animate-spin" />
                                            <p style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 10, fontWeight: 700, color: '#0f172a', letterSpacing: 3, textTransform: 'uppercase' }}>
                                                Capturando...
                                            </p>
                                        </div>
                                    )}

                                    {/* Card Header */}
                                    <div className="print-header" style={{ background: '#0f172a', padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', filter: 'blur(40px)', marginRight: -48, marginTop: -48 }} />
                                        <div style={{ position: 'relative', zIndex: 1 }}>
                                            <h2 style={{ color: '#10B981', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Roboto Mono', monospace" }}>Instituição de Ensino</h2>
                                            <p style={{ color: '#fff', fontSize: 20, fontWeight: 900, fontStyle: 'italic', letterSpacing: -0.5, textTransform: 'uppercase', lineHeight: 1 }}>Colégio La Salle Sobradinho</p>
                                        </div>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <QrCode size={22} color="#fff" />
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, textAlign: 'center', background: '#ffffff' }}>
                                        {/* QR Code */}
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <div ref={qrRef} />
                                        </div>

                                        {/* Guardian info */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left' }}>
                                            <div
                                                style={{ width: 56, height: 56, borderRadius: 14, background: '#f1f5f9', overflow: 'hidden', flexShrink: 0, position: 'relative', cursor: 'pointer' }}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                {selectedGuardian.foto_url ? (
                                                    <img src={selectedGuardian.foto_url} alt={selectedGuardian.nome_completo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <UserIcon size={24} color="#94a3b8" />
                                                    </div>
                                                )}
                                                <div className="no-print" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0 }}
                                                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                                                >
                                                    <Camera size={18} color="#fff" />
                                                </div>
                                                {uploadingPhoto && (
                                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Loader2 size={20} color="#10B981" className="animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} accept="image/*" />
                                            <div>
                                                <p style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Roboto Mono', monospace" }}>Nome do Responsável</p>
                                                <p style={{ color: '#0f172a', fontSize: 18, fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: -0.3, lineHeight: 1.2 }}>{selectedGuardian.nome_completo}</p>
                                            </div>
                                        </div>

                                        {/* Data grid */}
                                        <div className="grid-cols-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                            {/* CPF */}
                                            <div className="val-box" style={{ background: '#f8fafc', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <p style={{ color: '#94a3b8', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Roboto Mono', monospace", marginBottom: 4 }}>CPF</p>
                                                <p style={{ color: '#334155', fontSize: 10, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap' }}>{selectedGuardian.cpf}</p>
                                            </div>
                                            {/* Access Code */}
                                            <div className="val-box" style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <p style={{ color: '#4f46e5', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Roboto Mono', monospace", marginBottom: 4 }}>Cód. Acesso</p>
                                                <p style={{ color: '#4338ca', fontSize: 13, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", letterSpacing: 2 }}>{selectedGuardian.codigo_acesso || '---'}</p>
                                            </div>
                                            {/* Validity */}
                                            <div className="val-box" style={{ background: '#f8fafc', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                                                <p style={{ color: 'rgba(5,150,105,0.5)', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Roboto Mono', monospace", marginBottom: 4 }}>Validade</p>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Calendar size={10} color="#10B981" />
                                                        {editingValidity ? (
                                                            <input
                                                                type="date"
                                                                style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'transparent', outline: 'none', borderBottom: '1px solid rgba(16,185,129,0.3)', width: '100%', fontFamily: "'Roboto Mono', monospace" }}
                                                                value={newValidityDate || (selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toISOString().split('T')[0] : '')}
                                                                onChange={(e) => setNewValidityDate(e.target.value)}
                                                            />
                                                        ) : (
                                                            <p style={{ color: '#059669', fontSize: 10, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap' }}>
                                                                {selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toLocaleDateString('pt-BR') : '--/--/----'}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="no-print">
                                                        {editingValidity ? (
                                                            <div style={{ display: 'flex', gap: 2 }}>
                                                                <button onClick={handleUpdateValidity} disabled={updatingValidity} style={{ padding: 3, borderRadius: 5, border: 'none', background: 'rgba(16,185,129,0.1)', cursor: 'pointer', color: '#059669' }}>
                                                                    {updatingValidity ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                                </button>
                                                                <button onClick={() => setEditingValidity(false)} style={{ padding: 3, borderRadius: 5, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#dc2626' }}>
                                                                    <X size={10} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setEditingValidity(true); setNewValidityDate(selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toISOString().split('T')[0] : ''); }}
                                                                style={{ padding: 3, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                                                            >
                                                                <Edit2 size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="print-footer" style={{ background: '#f1f5f9', marginLeft: -36, marginRight: -36, marginBottom: -32, padding: '12px 36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <Smartphone size={11} color="#94a3b8" />
                                            <p style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>
                                                Sistema de Identificação Biométrica Integrado
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <button
                                        onClick={handleDownload}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                            padding: '16px 20px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(77,166,255,0.3)',
                                            borderRadius: 14, cursor: 'pointer',
                                            color: '#4da6ff',
                                            fontFamily: "'Roboto Mono', monospace",
                                            fontSize: 11, fontWeight: 700, letterSpacing: 2,
                                            textTransform: 'uppercase', transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <Download size={16} /> Baixar PNG
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                            padding: '16px 20px',
                                            background: 'linear-gradient(135deg, rgba(0,230,118,0.15), rgba(0,230,118,0.08))',
                                            border: '1px solid rgba(0,230,118,0.4)',
                                            borderRadius: 14, cursor: 'pointer',
                                            color: '#00e676',
                                            fontFamily: "'Roboto Mono', monospace",
                                            fontSize: 11, fontWeight: 700, letterSpacing: 2,
                                            textTransform: 'uppercase', transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <Printer size={16} /> Imprimir
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Empty state */
                            <div style={{
                                minHeight: 520,
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px dashed rgba(255,215,0,0.15)',
                                borderRadius: 24,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: 16, padding: 40, textAlign: 'center'
                            }}>
                                {generating ? (
                                    <>
                                        <Loader2 size={40} color="#4da6ff" className="animate-spin" />
                                        <p style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 12, color: '#4da6ff', letterSpacing: 2, textTransform: 'uppercase' }}>Gerando cartão...</p>
                                    </>
                                ) : (
                                    <>
                                        <div style={{
                                            width: 72, height: 72,
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,215,0,0.1)',
                                            borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <QrCode size={32} color="rgba(255,255,255,0.1)" />
                                        </div>
                                        <div>
                                            <h3 style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                                Nenhum responsável selecionado
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, fontFamily: "'Roboto Mono', monospace", letterSpacing: 1, maxWidth: 260, lineHeight: 1.6 }}>
                                                Pesquise e selecione um responsável para gerar o cartão de acesso.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
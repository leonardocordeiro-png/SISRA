import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, QrCode, Download, Printer, User as UserIcon, Calendar, Smartphone, Loader2, Camera, Edit2, Check, X } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import domtoimage from 'dom-to-image-more';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';

import type { Guardian } from '../../types';

type QrGuardian = Guardian & {
    alunos_count?: number;
    aluno_nomes?: string[];
};

export default function AdminQRGenerator() {
    const toast = useToast();
    const { escolaId } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [guardians, setGuardians] = useState<QrGuardian[]>([]);
    const [selectedGuardian, setSelectedGuardian] = useState<QrGuardian | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [editingValidity, setEditingValidity] = useState(false);
    const [newValidityDate, setNewValidityDate] = useState('');
    const [updatingValidity, setUpdatingValidity] = useState(false);
    const [bulkValidityDate, setBulkValidityDate] = useState('');
    const [bulkUpdating, setBulkUpdating] = useState(false);

    useEffect(() => {
        if (selectedGuardian && qrRef.current) {
            generateQRCode();
        }
    }, [selectedGuardian]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        if (!escolaId) {
            toast.error('Escola nao identificada', 'Entre novamente para carregar o contexto da escola.');
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setSelectedGuardian(null);
        try {
            const { data, error } = await supabase.rpc('sisra_search_admin_qr_guardians', {
                p_escola_id: escolaId,
                p_search: searchTerm.trim().slice(0, 120),
            });

            if (error) throw error;
            setGuardians(Array.isArray(data) ? data as QrGuardian[] : []);
        } catch (err) {
            console.error('Error searching guardians:', err);
            toast.error('Erro ao buscar responsaveis', 'A busca nao pode ser concluida. Verifique sua permissao e tente novamente.');
            setGuardians([]);
        } finally {
            setLoading(false);
        }
    };

    const selectGuardian = async (guardian: QrGuardian) => {
        if (!escolaId) {
            toast.error('Escola nao identificada', 'Entre novamente para carregar o contexto da escola.');
            return;
        }

        setGenerating(true);
        setSelectedGuardian(null);

        try {
            const { data, error } = await supabase.rpc('sisra_issue_admin_qr_card', {
                p_escola_id: escolaId,
                p_responsavel_id: guardian.id,
            });

            if (error) throw error;

            const updatedGuardian = (data as { guardian?: QrGuardian } | null)?.guardian;
            if (!updatedGuardian?.qr_code) {
                throw new Error('Cartao QR nao retornado pelo banco.');
            }

            setSelectedGuardian(updatedGuardian);
            setGuardians(current => current.map(item => item.id === updatedGuardian.id ? updatedGuardian : item));
        } catch (err: any) {
            console.error('Error selecting guardian:', err);
            const errorMsg = err.message || 'Erro desconhecido';
            toast.error('Erro ao carregar/gerar cartao', `Detalhe: ${errorMsg}.`);
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
            type: 'canvas', // canvas renderiza bem na captura/impressão
            dotsOptions: {
                color: '#1F3057',
                type: 'rounded'
            },
            backgroundOptions: {
                color: '#ffffff'
            },
            cornersSquareOptions: { color: '#6B3D8F', type: 'extra-rounded' },
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
            setDownloading(true);
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
                setDownloading(false);
            }
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedGuardian) return;
        if (!escolaId) {
            toast.error('Escola nao identificada', 'Entre novamente para carregar o contexto da escola.');
            return;
        }

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
                .upload(filePath, file, { upsert: false });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('responsaveis')
                .getPublicUrl(filePath);

            const { data, error: updateError } = await supabase.rpc('sisra_update_admin_guardian_photo', {
                p_escola_id: escolaId,
                p_responsavel_id: selectedGuardian.id,
                p_foto_url: publicUrl,
            });

            if (updateError) throw updateError;

            const updatedGuardian = (data as { guardian?: QrGuardian } | null)?.guardian;
            setSelectedGuardian(updatedGuardian || { ...selectedGuardian, foto_url: publicUrl });
            if (updatedGuardian) {
                setGuardians(current => current.map(item => item.id === updatedGuardian.id ? updatedGuardian : item));
            }
            toast.success('Foto atualizada', 'A foto do responsavel foi atualizada com sucesso.');
        } catch (err) {
            console.error('Error uploading photo:', err);
            toast.error('Erro ao enviar foto', 'Tente novamente com uma imagem menor.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleUpdateValidity = async () => {
        if (!selectedGuardian || !newValidityDate) return;
        if (!escolaId) {
            toast.error('Escola nao identificada', 'Entre novamente para carregar o contexto da escola.');
            return;
        }

        setUpdatingValidity(true);
        try {
            const { data, error } = await supabase.rpc('sisra_update_admin_qr_validity', {
                p_escola_id: escolaId,
                p_responsavel_id: selectedGuardian.id,
                p_expires_at: new Date(newValidityDate).toISOString(),
            });

            if (error) throw error;

            const updatedGuardian = (data as { guardian?: QrGuardian } | null)?.guardian;
            setSelectedGuardian(updatedGuardian || { ...selectedGuardian, expires_at: new Date(newValidityDate).toISOString() });
            if (updatedGuardian) {
                setGuardians(current => current.map(item => item.id === updatedGuardian.id ? updatedGuardian : item));
            }
            setEditingValidity(false);
            toast.success('Validade atualizada', 'A data de validade do cartao foi atualizada.');
        } catch (err) {
            console.error('Error updating validity:', err);
            toast.error('Erro ao atualizar validade', 'Tente novamente.');
        } finally {
            setUpdatingValidity(false);
        }
    };

    const handleBulkValidity = async () => {
        if (!bulkValidityDate) {
            toast.error('Selecione uma data', 'Escolha a nova validade antes de aplicar.');
            return;
        }
        if (!escolaId) {
            toast.error('Escola nao identificada', 'Entre novamente para carregar o contexto da escola.');
            return;
        }
        setBulkUpdating(true);
        try {
            const { data, error } = await supabase.rpc('sisra_bulk_update_admin_qr_validity', {
                p_escola_id: escolaId,
                p_expires_at: new Date(bulkValidityDate).toISOString(),
            });
            if (error) throw error;

            const updated = (data as { updated?: number } | null)?.updated ?? 0;
            // Refletir a nova validade no responsável selecionado e na lista, se houver.
            const iso = new Date(bulkValidityDate).toISOString();
            if (selectedGuardian) setSelectedGuardian({ ...selectedGuardian, expires_at: iso });
            setGuardians(current => current.map(g => ({ ...g, expires_at: iso })));
            toast.success('Validade aplicada em lote', `${updated} cartão(ões) atualizado(s) para ${new Date(bulkValidityDate).toLocaleDateString('pt-BR')}.`);
        } catch (err: any) {
            console.error('Error bulk updating validity:', err);
            const msg = err.message === 'VALIDADE_INVALIDA'
                ? 'Data inválida (deve estar entre hoje e 5 anos).'
                : 'Verifique sua permissão e tente novamente.';
            toast.error('Erro ao atualizar em lote', msg);
        } finally {
            setBulkUpdating(false);
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
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setHasSearched(false);
                                        }}
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
                                    disabled={loading || !escolaId}
                                    aria-label="Buscar responsável vinculado"
                                    style={{
                                        padding: '11px 16px',
                                        background: 'linear-gradient(135deg, #4da6ff, #0984e3)',
                                        border: 'none', borderRadius: 10, cursor: loading || !escolaId ? 'not-allowed' : 'pointer',
                                        color: '#fff', display: 'flex', alignItems: 'center',
                                        opacity: loading || !escolaId ? 0.65 : 1
                                    }}
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                </button>
                            </form>
                        </div>

                        {/* Bulk validity panel */}
                        <div style={{
                            background: 'rgba(124,58,237,0.06)',
                            border: '1px solid rgba(124,58,237,0.25)',
                            borderRadius: 16, padding: 20
                        }}>
                            <p style={{
                                fontFamily: "'Roboto Mono', monospace",
                                fontSize: 10, fontWeight: 700, letterSpacing: 3,
                                color: 'rgba(196,181,253,0.8)', textTransform: 'uppercase',
                                marginBottom: 6
                            }}>// validade em lote</p>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
                                Define a mesma data de validade para <strong style={{ color: 'rgba(255,255,255,0.6)' }}>todos</strong> os cartões da escola.
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="date"
                                    value={bulkValidityDate}
                                    onChange={(e) => setBulkValidityDate(e.target.value)}
                                    style={{
                                        flex: 1, padding: '11px 12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(124,58,237,0.3)',
                                        borderRadius: 10, outline: 'none',
                                        color: '#e2e8f0', fontSize: 13,
                                        fontFamily: 'inherit', boxSizing: 'border-box'
                                    }}
                                />
                                <button
                                    onClick={handleBulkValidity}
                                    disabled={bulkUpdating || !escolaId || !bulkValidityDate}
                                    style={{
                                        padding: '11px 16px',
                                        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                        border: 'none', borderRadius: 10,
                                        cursor: bulkUpdating || !bulkValidityDate ? 'not-allowed' : 'pointer',
                                        color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
                                        fontFamily: "'Roboto Mono', monospace", fontSize: 11, fontWeight: 700,
                                        letterSpacing: 1, textTransform: 'uppercase',
                                        opacity: bulkUpdating || !bulkValidityDate ? 0.6 : 1, whiteSpace: 'nowrap'
                                    }}
                                >
                                    {bulkUpdating ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />} Aplicar
                                </button>
                            </div>
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
                                                ? 'rgba(124,58,237,0.1)'
                                                : 'rgba(255,255,255,0.03)',
                                            border: selectedGuardian?.id === g.id
                                                ? '1px solid rgba(124,58,237,0.45)'
                                                : '1px solid rgba(255,255,255,0.07)',
                                            borderRadius: 12, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div>
                                            <p style={{
                                                color: selectedGuardian?.id === g.id ? '#a78bfa' : '#e2e8f0',
                                                fontWeight: 700, fontSize: 14, marginBottom: 2,
                                                textTransform: 'uppercase', letterSpacing: 0.5
                                            }}>{g.nome_completo}</p>
                                            <p style={{
                                                fontFamily: "'Roboto Mono', monospace",
                                                color: 'rgba(255,255,255,0.3)', fontSize: 11
                                            }}>{g.cpf}</p>
                                            <p style={{
                                                fontFamily: "'Roboto Mono', monospace",
                                                color: 'rgba(167,139,250,0.6)', fontSize: 10, marginTop: 4
                                            }}>
                                                {g.alunos_count ?? 0} aluno(s) vinculado(s)
                                            </p>
                                            {g.aluno_nomes && g.aluno_nomes.length > 0 && (
                                                <p style={{
                                                    color: 'rgba(255,255,255,0.28)', fontSize: 11, marginTop: 4,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250
                                                }}>
                                                    {g.aluno_nomes.slice(0, 2).join(', ')}
                                                    {g.aluno_nomes.length > 2 ? ` +${g.aluno_nomes.length - 2}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <QrCode size={16} color={selectedGuardian?.id === g.id ? '#a78bfa' : 'rgba(255,255,255,0.2)'} />
                                    </button>
                                ))}
                            </div>
                        )}

                        {hasSearched && !loading && guardians.length === 0 && (
                            <div style={{
                                padding: '24px 16px', textAlign: 'center',
                                color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic'
                            }}>
                                Nenhum responsável vinculado a aluno foi encontrado.
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
                                            <Loader2 size={36} color="#7c3aed" className="animate-spin" />
                                            <p style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 10, fontWeight: 700, color: '#0f172a', letterSpacing: 3, textTransform: 'uppercase' }}>
                                                Capturando...
                                            </p>
                                        </div>
                                    )}

                                    {/* Card Header */}
                                    <div className="print-header" style={{ background: '#0f172a', padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: 'rgba(124,58,237,0.18)', borderRadius: '50%', filter: 'blur(40px)', marginRight: -48, marginTop: -48 }} />
                                        <div style={{ position: 'relative', zIndex: 1 }}>
                                            <h2 style={{ color: '#c4b5fd', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Roboto Mono', monospace" }}>Instituição de Ensino</h2>
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

                                        {/* Data fields — linhas de largura total com valores grandes */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {/* CPF */}
                                            <div className="val-box" style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Roboto Mono', monospace" }}>CPF</p>
                                                <p style={{ color: '#0f172a', fontSize: 19, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap' }}>{selectedGuardian.cpf}</p>
                                            </div>
                                            {/* Access Code */}
                                            <div className="val-box" style={{ background: '#f5f3ff', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                <p style={{ color: '#7c3aed', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Roboto Mono', monospace" }}>Cód. Acesso</p>
                                                <p style={{ color: '#5b21b6', fontSize: 24, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", letterSpacing: 4, whiteSpace: 'nowrap' }}>{selectedGuardian.codigo_acesso || '---'}</p>
                                            </div>
                                            {/* Validity */}
                                            <div className="val-box" style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                <p style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Roboto Mono', monospace" }}>Validade</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Calendar size={16} color="#7c3aed" />
                                                    {editingValidity ? (
                                                        <input
                                                            type="date"
                                                            style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', background: 'transparent', outline: 'none', borderBottom: '1px solid rgba(124,58,237,0.4)', fontFamily: "'Roboto Mono', monospace" }}
                                                            value={newValidityDate || (selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toISOString().split('T')[0] : '')}
                                                            onChange={(e) => setNewValidityDate(e.target.value)}
                                                        />
                                                    ) : (
                                                        <p style={{ color: '#0f172a', fontSize: 18, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap' }}>
                                                            {selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toLocaleDateString('pt-BR') : '--/--/----'}
                                                        </p>
                                                    )}
                                                    <div className="no-print">
                                                        {editingValidity ? (
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                <button onClick={handleUpdateValidity} disabled={updatingValidity} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'rgba(124,58,237,0.1)', cursor: 'pointer', color: '#7c3aed' }}>
                                                                    {updatingValidity ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                                </button>
                                                                <button onClick={() => setEditingValidity(false)} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', color: '#dc2626' }}>
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setEditingValidity(true); setNewValidityDate(selectedGuardian.expires_at ? new Date(selectedGuardian.expires_at).toISOString().split('T')[0] : ''); }}
                                                                style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                                                            >
                                                                <Edit2 size={14} />
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
                                        disabled={downloading}
                                        onClick={handleDownload}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                            padding: '16px 20px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(77,166,255,0.3)',
                                            borderRadius: 14, cursor: downloading ? 'not-allowed' : 'pointer',
                                            color: '#4da6ff', opacity: downloading ? 0.6 : 1,
                                            fontFamily: "'Roboto Mono', monospace",
                                            fontSize: 11, fontWeight: 700, letterSpacing: 2,
                                            textTransform: 'uppercase', transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {downloading ? 'Gerando...' : 'Baixar PNG'}
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                            padding: '16px 20px',
                                            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(124,58,237,0.1))',
                                            border: '1px solid rgba(124,58,237,0.45)',
                                            borderRadius: 14, cursor: 'pointer',
                                            color: '#a78bfa',
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

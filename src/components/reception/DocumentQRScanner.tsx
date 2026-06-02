/**
 * DocumentQRScanner
 * ─────────────────
 * Scanner QR de dupla finalidade:
 *   1. Cartões SISRA internos (LaSalleCheguei- / parent_qr_cards)
 *   2. Documentos de identidade brasileiros:
 *      - Novo RG (CNJ 561/2022 / ICP-Brasil)
 *      - CNH (DENATRAN)
 *      - CPF direto, JSON, base64, URL gov.br
 *
 * Segurança / LGPD:
 *   - Dados do documento usados APENAS na sessão para verificação
 *   - Foto do documento não é armazenada
 *   - CPF usado apenas para lookup de guardião já cadastrado
 *   - Assinatura digital detectada mas validação PKI completa exige servidor
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { supabase } from '../../lib/supabase';
import { X, ShieldCheck, ShieldX, Scan, User as UserIcon, AlertTriangle, Loader2, CheckCircle2, Info } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ScanState = 'scanning' | 'processing' | 'sisra_ok' | 'doc_found' | 'doc_not_found' | 'unknown' | 'error';

interface ParsedDocument {
    cpf?: string;
    nome?: string;
    nascimento?: string;
    foto?: string;          // base64 da foto do documento (NÃO armazenada)
    tipo: 'SISRA_CARD' | 'SISRA_QR' | 'NOVO_RG' | 'CNH' | 'CPF_DIRETO' | 'GOV_URL' | 'JSON' | 'BASE64' | 'DESCONHECIDO';
    assinatura?: boolean;   // detectou campo de assinatura digital
    rawData?: string;       // dado bruto (para debug, não exposto na UI)
}

interface GuardianResult {
    id: string;
    nome_completo: string;
    foto_url: string | null;
}

interface DocumentQRScannerProps {
    escolaId?: string | null;
    onSisraResolved: (responsavelId: string, guardianName: string, guardian: any) => void;
    onDocumentCpfFound: (cpf: string, guardian: GuardianResult) => void;
    onClose: () => void;
}

// ─── Parser multi-formato ────────────────────────────────────────────────────

function normalizeCpf(raw: string): string {
    return raw.replace(/\D/g, '');
}

function isValidCpfFormat(cpf: string): boolean {
    const c = normalizeCpf(cpf);
    return c.length === 11 && !/^(\d)\1{10}$/.test(c);
}

function parseDocumentQR(raw: string): ParsedDocument {
    const trimmed = raw.trim();

    // ── 1. SISRA cartão QR (parent_qr_cards) ─────────────────────────────
    if (trimmed.startsWith('LaSalleCheguei-')) {
        return { tipo: 'SISRA_QR' };
    }

    // ── 2. UUID puro (parent_qr_cards por UUID) ───────────────────────────
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        return { tipo: 'SISRA_CARD' };
    }

    // ── 3. JSON puro ──────────────────────────────────────────────────────
    try {
        const obj = JSON.parse(trimmed);
        const cpf = normalizeCpf(obj.cpf || obj.CPF || obj.numeroDocumento || '');
        const nome = obj.nome || obj.NOME || obj.nomeCompleto || obj.name || '';
        const foto = obj.foto || obj.photo || obj.imagem || '';
        const nasc = obj.dataNascimento || obj.data_nascimento || obj.birthDate || '';
        const assinatura = !!(obj.assinatura || obj.signature || obj.digitalSignature);
        if (isValidCpfFormat(cpf)) {
            return { tipo: 'JSON', cpf, nome, nascimento: nasc, foto, assinatura };
        }
    } catch {}

    // ── 4. URL gov.br / identidade.gov.br ────────────────────────────────
    try {
        const url = new URL(trimmed);
        if (url.hostname.endsWith('.gov.br') || url.hostname.includes('identidade')) {
            const cpf = normalizeCpf(
                url.searchParams.get('cpf') ||
                url.searchParams.get('CPF') ||
                url.searchParams.get('documento') || ''
            );
            if (isValidCpfFormat(cpf)) return { tipo: 'GOV_URL', cpf };
            // URL sem CPF visível — pode ser token de validação online
            return { tipo: 'GOV_URL' };
        }
    } catch {}

    // ── 5. Base64 — Novo RG (CNJ 561/2022 / ICP-Brasil) ─────────────────
    // O QR do Novo RG contém dados em base64 com estrutura TLV ou JWT
    try {
        const decoded = atob(trimmed.replace(/-/g, '+').replace(/_/g, '/'));
        // Procura CPF (11 dígitos consecutivos) no payload decodificado
        const cpfMatch = decoded.match(/(\d{3}[.\-]?\d{3}[.\-]?\d{3}[.\-]?\d{2})/);
        const cpf = cpfMatch ? normalizeCpf(cpfMatch[1]) : '';
        // Procura foto em base64 dentro do payload (padrão ICP-Brasil)
        const fotoMatch = decoded.match(/\/9j\/[A-Za-z0-9+/=]{100,}/);
        const foto = fotoMatch ? 'data:image/jpeg;base64,' + fotoMatch[0] : undefined;
        // Detecta assinatura (bytes de cabeçalho de certificado X.509)
        const assinatura = decoded.includes('-----BEGIN') || decoded.includes('CERTIFICATE') || /\x30\x82/.test(decoded);
        const nomeMatch = decoded.match(/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{3,}(?:\s[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}){1,6}/);
        const nome = nomeMatch ? nomeMatch[0] : '';
        if (isValidCpfFormat(cpf)) {
            return { tipo: 'NOVO_RG', cpf, nome, foto, assinatura };
        }
    } catch {}

    // ── 6. CPF direto no texto ─────────────────────────────────────────────
    const cpfMatch = trimmed.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    if (cpfMatch) {
        const cpf = normalizeCpf(cpfMatch[0]);
        if (isValidCpfFormat(cpf)) return { tipo: 'CPF_DIRETO', cpf };
    }

    return { tipo: 'DESCONHECIDO' };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DocumentQRScanner({
    escolaId, onSisraResolved, onDocumentCpfFound, onClose,
}: DocumentQRScannerProps) {
    const videoRef  = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef    = useRef<number>(0);

    const [scanState, setScanState]       = useState<ScanState>('scanning');
    const [parsedDoc, setParsedDoc]       = useState<ParsedDocument | null>(null);
    const [guardian, setGuardian]         = useState<GuardianResult | null>(null);
    const [errorMsg, setErrorMsg]         = useState('');
    const [cameraError, setCameraError]   = useState('');

    // ── Câmera ────────────────────────────────────────────────────────────
    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            .then(stream => {
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }
            })
            .catch(() => setCameraError('Câmera não disponível. Verifique as permissões do navegador.'));

        return () => {
            cancelAnimationFrame(rafRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // ── Loop de leitura QR ───────────────────────────────────────────────
    const tick = useCallback(() => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick);
            return;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
            handleQRDetected(code.data);
            return;
        }
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onPlay = () => { rafRef.current = requestAnimationFrame(tick); };
        video.addEventListener('play', onPlay);
        return () => video.removeEventListener('play', onPlay);
    }, [tick]);

    // ── Processar QR detectado ───────────────────────────────────────────
    const handleQRDetected = useCallback(async (raw: string) => {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        setScanState('processing');

        const doc = parseDocumentQR(raw);
        setParsedDoc(doc);

        try {
            // ── SISRA QR / cartão ───────────────────────────────────────
            if (doc.tipo === 'SISRA_QR' || doc.tipo === 'SISRA_CARD') {
                let responsavelId = '';

                if (doc.tipo === 'SISRA_QR') {
                    const parts = raw.split('-');
                    const uuid = parts.slice(1, -1).join('-');
                    if (uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
                        responsavelId = uuid;
                } else {
                    // Lookup por qr_code em parent_qr_cards
                    const { data: card } = await supabase
                        .from('parent_qr_cards').select('responsavel_id')
                        .eq('qr_code', raw).eq('active', true).maybeSingle();
                    if (card?.responsavel_id) responsavelId = card.responsavel_id;
                    else responsavelId = raw;
                }

                if (!responsavelId) throw new Error('Cartão SISRA inválido ou expirado.');

                const { data: g } = await supabase
                    .from('responsaveis').select('id, nome_completo, foto_url')
                    .eq('id', responsavelId).single();

                if (!g) throw new Error('Responsável não encontrado no sistema.');
                setGuardian(g);
                setScanState('sisra_ok');

                // Fecha automaticamente após 1.5s
                setTimeout(() => { onSisraResolved(g.id, g.nome_completo, g); onClose(); }, 1500);
                return;
            }

            // ── Documento com CPF ───────────────────────────────────────
            if (doc.cpf && isValidCpfFormat(doc.cpf)) {
                const { data: guardians } = await supabase
                    .from('responsaveis').select('id, nome_completo, foto_url')
                    .eq('cpf', doc.cpf);

                if (guardians && guardians.length > 0) {
                    setGuardian(guardians[0]);
                    setScanState('doc_found');
                } else {
                    setScanState('doc_not_found');
                }
                return;
            }

            // ── URL gov.br sem CPF — orientar leitura online ────────────
            if (doc.tipo === 'GOV_URL') {
                setErrorMsg('QR Code de documento gov.br detectado. O CPF não está embutido neste formato. Solicite o documento físico para verificação manual.');
                setScanState('error');
                return;
            }

            setScanState('unknown');
        } catch (err: any) {
            setErrorMsg(err.message || 'Erro ao processar QR Code.');
            setScanState('error');
        }
    }, [onSisraResolved, onClose, escolaId]);

    const handleConfirmDocument = () => {
        if (guardian) { onDocumentCpfFound(parsedDoc!.cpf!, guardian); onClose(); }
    };

    const retryScanner = () => {
        setScanState('scanning');
        setParsedDoc(null);
        setGuardian(null);
        setErrorMsg('');
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            .then(stream => {
                streamRef.current = stream;
                if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
            });
    };

    // ── Cores e rótulos por estado ────────────────────────────────────────
    const stateConfig: Record<ScanState, { color: string; bg: string; Icon: any; label: string }> = {
        scanning:      { color: '#c79e61', bg: 'rgba(199,158,97,0.08)', Icon: Scan,        label: 'Aguardando leitura...' },
        processing:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', Icon: Loader2,     label: 'Processando...' },
        sisra_ok:      { color: '#34d399', bg: 'rgba(52,211,153,0.08)', Icon: ShieldCheck, label: 'Cartão SISRA válido' },
        doc_found:     { color: '#34d399', bg: 'rgba(52,211,153,0.08)', Icon: CheckCircle2,label: 'Responsável encontrado' },
        doc_not_found: { color: '#f97316', bg: 'rgba(249,115,22,0.08)', Icon: AlertTriangle,label: 'CPF não cadastrado' },
        unknown:       { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', Icon: Info,       label: 'Formato não reconhecido' },
        error:         { color: '#f87171', bg: 'rgba(248,113,113,0.08)', Icon: ShieldX,    label: 'Erro na leitura' },
    };
    const cfg = stateConfig[scanState];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(7,10,20,0.96)',
            backdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(199,158,97,0.1)' }}>
                <div>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(199,158,97,0.6)', marginBottom: 2 }}>
                        La Salle, Cheguei! · Identificação Segura
                    </p>
                    <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                        Escanear QR de Identidade
                    </h2>
                </div>
                <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} />
                </button>
            </div>

            {/* Camera / Result Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: 16 }}>

                {/* Camera (shown only while scanning) */}
                {(scanState === 'scanning' || scanState === 'processing') && !cameraError && (
                    <div style={{ position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '1', borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(199,158,97,0.3)' }}>
                        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        {/* Scanning overlay */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <div style={{ width: '60%', aspectRatio: '1', border: '3px solid rgba(199,158,97,0.8)', borderRadius: 12, boxShadow: '0 0 0 4000px rgba(0,0,0,0.45)' }}>
                                <div style={{ width: '100%', height: 3, background: 'rgba(199,158,97,0.8)', boxShadow: '0 0 8px rgba(199,158,97,0.6)', animation: 'scan 2s linear infinite' }} />
                            </div>
                        </div>
                    </div>
                )}

                {cameraError && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#f87171', fontSize: 13, maxWidth: 320 }}>
                        {cameraError}
                    </div>
                )}

                {/* Status Bar */}
                {scanState !== 'scanning' && (
                    <div style={{ width: '100%', maxWidth: 400, padding: '14px 18px', borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <cfg.Icon size={20} style={{ color: cfg.color, flexShrink: 0, animation: scanState === 'processing' ? 'spin 1s linear infinite' : undefined }} />
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</p>
                            {parsedDoc?.tipo && parsedDoc.tipo !== 'SISRA_QR' && parsedDoc.tipo !== 'SISRA_CARD' && (
                                <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                    Documento detectado: {parsedDoc.tipo.replace('_', ' ')}
                                    {parsedDoc.assinatura && ' · Assinatura digital presente'}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Document Result Panel */}
                {(scanState === 'doc_found' || scanState === 'doc_not_found') && parsedDoc && (
                    <div style={{ width: '100%', maxWidth: 400, background: 'rgba(17,24,43,0.8)', border: '1px solid rgba(199,158,97,0.2)', borderRadius: 14, overflow: 'hidden' }}>
                        {/* Document data */}
                        <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {/* Photo from document (if available) */}
                            <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0, border: '2px solid rgba(199,158,97,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {parsedDoc.foto ? (
                                    <img src={parsedDoc.foto} alt="Foto do documento" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : guardian?.foto_url ? (
                                    <img src={guardian.foto_url} alt={guardian.nome_completo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <UserIcon size={22} style={{ color: 'rgba(199,158,97,0.4)' }} />
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {parsedDoc.nome && (
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                        {parsedDoc.nome}
                                    </p>
                                )}
                                <p style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 4 }}>
                                    CPF: {parsedDoc.cpf!.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                </p>
                                {parsedDoc.nascimento && (
                                    <p style={{ fontSize: 10, color: '#64748b' }}>Nascimento: {parsedDoc.nascimento}</p>
                                )}
                            </div>
                        </div>

                        {/* System match */}
                        <div style={{ padding: '12px 18px' }}>
                            {scanState === 'doc_found' && guardian ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <CheckCircle2 size={15} style={{ color: '#34d399', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>Encontrado no sistema</p>
                                        <p style={{ fontSize: 12, color: '#94a3b8' }}>{guardian.nome_completo}</p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <AlertTriangle size={15} style={{ color: '#f97316', flexShrink: 0 }} />
                                    <p style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>
                                        CPF não cadastrado como responsável nesta escola.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* LGPD notice */}
                        <div style={{ padding: '8px 18px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ fontSize: 9, color: '#475569', lineHeight: 1.5 }}>
                                🔒 LGPD: Os dados lidos são usados apenas para verificação desta sessão. A foto do documento não é armazenada.
                                {parsedDoc.assinatura && ' Assinatura digital detectada — validação PKI completa disponível via servidor.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Error / Unknown panel */}
                {(scanState === 'error' || scanState === 'unknown') && (
                    <div style={{ width: '100%', maxWidth: 400, padding: '14px 18px', background: 'rgba(17,24,43,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                            {errorMsg || 'Formato de QR Code não reconhecido pelo sistema. Tente o código de acesso ou busca por CPF.'}
                        </p>
                    </div>
                )}

                {/* SISRA OK panel */}
                {scanState === 'sisra_ok' && guardian && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, width: '100%', maxWidth: 400 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(52,211,153,0.4)', flexShrink: 0, background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {guardian.foto_url
                                ? <img src={guardian.foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <UserIcon size={20} style={{ color: '#34d399' }} />}
                        </div>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>{guardian.nome_completo}</p>
                            <p style={{ fontSize: 10, color: '#64748b' }}>Carregando alunos vinculados...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer actions */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10 }}>
                {(scanState === 'error' || scanState === 'unknown' || scanState === 'doc_not_found') && (
                    <button onClick={retryScanner} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(199,158,97,0.3)', background: 'rgba(199,158,97,0.06)', color: '#c79e61', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Tentar Novamente
                    </button>
                )}
                {scanState === 'doc_found' && guardian && (
                    <button onClick={handleConfirmDocument} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #c79e61, #a07a3d)', color: '#070a14', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: '0.04em' }}>
                        Confirmar e Carregar Alunos
                    </button>
                )}
                <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Cancelar
                </button>
            </div>
        </div>
    );
}

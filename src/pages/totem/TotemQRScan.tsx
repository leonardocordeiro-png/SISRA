import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, QrCode, AlertCircle, Settings, Wifi, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';
import jsQR from 'jsqr';
import type { Student } from '../../types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#c79e61';
const CYAN       = '#47b8ff';
const BLUE_COL   = '#2980B9';
const GREEN      = '#34d399';
const TEXT_MUTED = '#8491A2';
const GLASS_BG   = 'rgba(17,24,43,0.65)';

function GlassPanel({
    children,
    className,
    outerStyle,
    innerStyle,
}: {
    children: React.ReactNode;
    className?: string;
    outerStyle?: React.CSSProperties;
    innerStyle?: React.CSSProperties;
}) {
    return (
        <div
            className={className}
            style={{
                background: 'linear-gradient(135deg, rgba(71,184,255,0.32) 0%, rgba(199,158,97,0.32) 100%)',
                padding: 2,
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                ...outerStyle,
            }}
        >
            <div style={{
                background: GLASS_BG,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 12,
                height: '100%',
                boxShadow: 'inset 0 0 12px rgba(255,255,255,0.015)',
                ...innerStyle,
            }}>
                {children}
            </div>
        </div>
    );
}

export default function TotemQRScan() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(true);
    const [cameraReady, setCameraReady] = useState(false);
    const [identifiedGuardian, setIdentifiedGuardian] = useState<any>(null);
    const [scanSuccess, setScanSuccess] = useState(false);
    useInactivityTimer({ timeoutMs: 60000, redirectTo: '/totem' });

    useEffect(() => {
        let stream: MediaStream | null = null;
        let animId: number;
        let resolved = false;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                    videoRef.current.onloadeddata = () => {
                        setCameraReady(true);
                        animId = requestAnimationFrame(scan);
                    };
                }
            } catch {
                setError('Não foi possível acessar a câmera. Verifique as permissões do dispositivo.');
            }
        };

        const scan = () => {
            if (resolved || !videoRef.current || !canvasRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video.readyState < video.HAVE_ENOUGH_DATA) {
                animId = requestAnimationFrame(scan);
                return;
            }
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // "Calibration": Focus on the central square area matching the UI
            const scanSize = Math.min(canvas.width, canvas.height) * 0.7;
            const sx = (canvas.width - scanSize) / 2;
            const sy = (canvas.height - scanSize) / 2;

            const imageData = ctx.getImageData(sx, sy, scanSize, scanSize);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth'
            });

            if (code) {
                resolved = true;
                handleQRData(code.data);
                return;
            }
            animId = requestAnimationFrame(scan);
        };

        if (scanning) startCamera();

        return () => {
            stream?.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animId);
        };
    }, [scanning]);

    const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
    useInactivityTimer({ timeoutMs: 60000, redirectTo: '/totem' });

    // Load initial selection
    useEffect(() => {
        const state = window.history.state?.usr;
        if (state?.selectedStudents) {
            setSelectedStudents(state.selectedStudents);
        }
    }, []);

    const handleQRData = async (qrData: string) => {
        try {
            let responsavelId = '';

            // Try parent_qr_cards table
            const { data: card } = await supabase
                .from('parent_qr_cards')
                .select('responsavel_id')
                .eq('qr_code', qrData)
                .eq('active', true)
                .maybeSingle();

            if (card?.responsavel_id) {
                responsavelId = card.responsavel_id;
            } else if (qrData.startsWith('LaSalleCheguei-')) {
                const parts = qrData.split('-');
                const candidate = parts.slice(1, -1).join('-');
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate))
                    responsavelId = candidate;
            } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrData)) {
                responsavelId = qrData;
            }

            if (!responsavelId) throw new Error('QR Code não reconhecido ou inválido.');

            // Fetch guardian info
            const { data: guardian } = await supabase
                .from('responsaveis')
                .select('id, nome_completo, foto_url, cpf')
                .eq('id', responsavelId)
                .single();

            if (!guardian) throw new Error('Responsável não encontrado no sistema.');

            // Collect all responsavel IDs with same CPF — try both formats (handles duplicate registrations with different CPF formats)
            let responsavelIds: string[] = [responsavelId];
            if ((guardian as any).cpf) {
                const rawCpf: string = (guardian as any).cpf;
                const cleanCpf = rawCpf.replace(/\D/g, '');
                const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                const { data: samesCpf } = await supabase
                    .from('responsaveis')
                    .select('id')
                    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`);
                if (samesCpf && samesCpf.length > 0) {
                    responsavelIds = [...new Set([responsavelId, ...samesCpf.map((r: any) => r.id)])];
                }
            }

            // Step 1: collect aluno_ids from both link tables for ALL responsavel IDs
            const [authsRes, junctionRes] = await Promise.all([
                supabase.from('autorizacoes').select('aluno_id').in('responsavel_id', responsavelIds).eq('ativa', true),
                supabase.from('alunos_responsaveis').select('aluno_id').in('responsavel_id', responsavelIds)
            ]);

            const alunoIds = new Set<string>([
                ...(authsRes.data?.map((a: any) => a.aluno_id) || []),
                ...(junctionRes.data?.map((j: any) => j.aluno_id) || [])
            ]);

            if (alunoIds.size === 0) throw new Error('Nenhum aluno vinculado a este QR Code.');

            // Step 2: fetch full student records by IDs
            const { data: alunosData } = await supabase
                .from('alunos')
                .select('*')
                .in('id', Array.from(alunoIds));

            const newStudents: Student[] = alunosData || [];

            if (newStudents.length === 0) throw new Error('Nenhum aluno vinculado a este QR Code.');

            // Merge avoiding duplicates with previously selected students
            const merged = [...selectedStudents];
            newStudents.forEach(ns => {
                if (!merged.some(ms => ms.id === ns.id)) merged.push(ns);
            });

            setSelectedStudents(merged);
            setIdentifiedGuardian(guardian);
            setScanSuccess(true);

            // Navigate automatically after a brief success feedback
            setTimeout(() => {
                navigate('/totem/confirmacao', {
                    state: {
                        students: merged,
                        mode: 'qr',
                        guardian: guardian
                    }
                });
            }, 800);

        } catch (e: any) {
            setError(e.message || 'Erro ao processar QR Code.');
            setScanning(false);
            setScanSuccess(false);
        }
    };

    const handleNext = () => {
        if (selectedStudents.length === 0) return;
        navigate('/totem/confirmacao', {
            state: {
                students: selectedStudents,
                mode: 'qr',
                guardian: identifiedGuardian
            }
        });
    };

    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: '#050b1d',
            color: '#fff',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            position: 'relative',
        }}>
            {/* Scoped styles */}
            <style>{`
                .tqr-bg {
                    background-image:
                        radial-gradient(circle at 10% 10%, #1a2540 0%, transparent 40%),
                        radial-gradient(circle at 90% 90%, #0d121f 0%, transparent 40%),
                        repeating-linear-gradient(
                            rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px,
                            transparent 1px, transparent 15px
                        );
                    background-size: 100% 100%, 100% 100%, 15px 15px;
                }
                .tqr-back-btn {
                    display: flex; align-items: center; gap: 8px;
                    padding: 9px 18px;
                    background: transparent;
                    border: 1px solid ${GOLD};
                    border-radius: 6px; cursor: pointer;
                    color: ${GOLD}; font-size: 13px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 1px;
                    transition: all 0.2s ease; font-family: inherit;
                }
                .tqr-back-btn:hover { background: rgba(199,158,97,0.1); box-shadow: 0 0 10px rgba(199,158,97,0.2); }
                .tqr-step-badge-1 { color: ${GOLD}; border: 1px solid ${GOLD}; box-shadow: 0 0 10px rgba(199,158,97,0.2); }
                .tqr-step-badge-2 { color: ${CYAN}; border: 1px solid ${CYAN}; box-shadow: 0 0 10px rgba(71,184,255,0.2); }
                .tqr-step-badge-3 { color: ${GOLD}; border: 1px solid ${GOLD}; box-shadow: 0 0 10px rgba(199,158,97,0.2); }
                .tqr-retry-btn {
                    width: 100%; padding: 8px;
                    background: rgba(255,69,0,0.1);
                    border: 1px solid rgba(255,69,0,0.4);
                    border-radius: 6px; cursor: pointer;
                    color: rgba(255,127,80,0.9); font-size: 12px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 1px;
                    transition: all 0.2s ease; font-family: inherit;
                }
                .tqr-retry-btn:hover { background: rgba(255,69,0,0.25); box-shadow: 0 0 10px rgba(255,69,0,0.3); }
                .tqr-next-btn {
                    width: 100%; padding: 12px;
                    background: linear-gradient(135deg, ${GREEN} 0%, rgba(18,30,60,0.9) 100%);
                    border: none; border-radius: 20px; cursor: pointer;
                    color: #07111e; font-size: 13px; font-weight: 800;
                    text-transform: uppercase; letter-spacing: 2px;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    box-shadow: 0 4px 20px rgba(52,211,153,0.25);
                    transition: all 0.2s ease; font-family: inherit;
                }
                .tqr-next-btn:hover { opacity: 0.9; }
                @keyframes tqr-scan-line {
                    0% { top: 0; }
                    50% { top: calc(100% - 2px); }
                    100% { top: 0; }
                }
                .tqr-scan-line { animation: tqr-scan-line 2s ease-in-out infinite; }
                @media (max-width: 1024px) {
                    .tqr-main { flex-direction: column !important; align-items: center; }
                    .tqr-sidebar { width: 100% !important; max-width: 500px; order: 2; }
                    .tqr-camera { order: 1; }
                }
            `}</style>

            {/* Background */}
            <div className="tqr-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <header style={{
                position: 'relative', zIndex: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '18px 40px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: `1px solid rgba(199,158,97,0.2)`,
            }}>
                {/* Back */}
                <button className="tqr-back-btn" onClick={() => navigate('/totem/identificar')}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    Voltar
                </button>

                {/* Center title */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                    <h1 style={{
                        margin: 0, fontSize: 22, fontWeight: 800,
                        background: `linear-gradient(90deg, ${CYAN}, #a64dff)`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textTransform: 'uppercase', letterSpacing: -0.5,
                    }}>
                        Escanear QR Code
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_MUTED, fontWeight: 400 }}>
                        Aproxime os cartões para adicionar alunos
                    </p>
                </div>

                {/* Right: students badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {selectedStudents.length > 0 && (
                        <GlassPanel outerStyle={{ boxShadow: `0 4px 16px rgba(41,128,185,0.25)` }}>
                            <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 800, color: CYAN, textTransform: 'uppercase', letterSpacing: 1 }}>
                                {selectedStudents.length} aluno{selectedStudents.length > 1 ? 's' : ''}
                            </div>
                        </GlassPanel>
                    )}
                    <div style={{
                        border: `1px solid ${GREEN}`,
                        color: GREEN,
                        padding: '4px 12px', borderRadius: 12,
                        fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
                    }}>
                        Ao Vivo
                    </div>
                </div>
            </header>

            {/* ── MAIN: camera LEFT | sidebar RIGHT ───────────────────────────── */}
            <div
                className="tqr-main"
                style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}
            >
                {/* Camera */}
                <div
                    className="tqr-camera"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'rgba(0,0,0,0.2)' }}
                >
                    {/* Metallic gradient-border camera frame */}
                    <div style={{
                        position: 'relative',
                        width: '100%', maxWidth: 560,
                        aspectRatio: '1',
                        background: '#01040a',
                        overflow: 'hidden',
                        borderRadius: 4,
                        boxShadow: `0 0 40px rgba(71,184,255,0.15), inset 0 0 20px rgba(199,158,97,0.08)`,
                        outline: `2px solid transparent`,
                        // Metallic gradient border via box-shadow outline trick
                        border: '1px solid transparent',
                        backgroundClip: 'padding-box',
                    }}>
                        {/* Gradient border overlay */}
                        <div style={{
                            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, borderRadius: 4,
                            background: 'transparent',
                            boxShadow: `inset 0 0 0 1px rgba(199,158,97,0.3)`,
                        }} />

                        {/* Inner frame line */}
                        <div style={{
                            position: 'absolute', top: 10, right: 10, bottom: 10, left: 10,
                            border: '1px solid rgba(199,158,97,0.12)',
                            borderRadius: 4, pointerEvents: 'none', zIndex: 5,
                        }} />

                        {/* Video */}
                        <video
                            ref={videoRef}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
                            playsInline
                            muted
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Scanner UI overlay */}
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                            {/* Darkened corners */}
                            <div style={{ position: 'absolute', inset: 0, border: '60px solid rgba(0,0,0,0.3)' }} />

                            {/* Target box */}
                            <div style={{
                                position: 'absolute',
                                top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 224, height: 224,
                                border: `2px solid ${scanSuccess ? GREEN : `${CYAN}80`}`,
                                borderRadius: 24,
                                background: scanSuccess ? 'rgba(52,211,153,0.08)' : 'transparent',
                                transition: 'all 0.3s ease',
                            }}>
                                {/* Corner brackets */}
                                {[
                                    { top: -1, left: -1, borderTop: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderLeft: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '12px 0 0 0' },
                                    { top: -1, right: -1, borderTop: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRight: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '0 12px 0 0' },
                                    { bottom: -1, left: -1, borderBottom: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderLeft: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '0 0 0 12px' },
                                    { bottom: -1, right: -1, borderBottom: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRight: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '0 0 12px 0' },
                                ].map((s, i) => (
                                    <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s }} />
                                ))}

                                {/* Scan line */}
                                {cameraReady && !scanSuccess && (
                                    <div className="tqr-scan-line" style={{
                                        position: 'absolute', left: 16, right: 16, height: 2,
                                        background: CYAN,
                                        boxShadow: `0 0 12px rgba(71,184,255,0.8)`,
                                    }} />
                                )}
                            </div>

                            {/* Status pill */}
                            <div style={{
                                position: 'absolute', bottom: 16, left: 0, right: 0,
                                display: 'flex', justifyContent: 'center',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 20px', borderRadius: 30,
                                    backdropFilter: 'blur(8px)',
                                    background: scanSuccess ? 'rgba(52,211,153,0.15)' : 'rgba(1,4,10,0.8)',
                                    border: `1px solid ${scanSuccess ? GREEN : `${CYAN}50`}`,
                                    boxShadow: scanSuccess ? `0 0 20px rgba(52,211,153,0.25)` : `0 0 20px rgba(71,184,255,0.15)`,
                                    transition: 'all 0.3s ease',
                                }}>
                                    <div style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        background: scanSuccess ? GREEN : CYAN,
                                        boxShadow: `0 0 10px ${scanSuccess ? 'rgba(52,211,153,0.8)' : 'rgba(71,184,255,0.8)'}`,
                                        animation: 'pulse 2s infinite',
                                    }} />
                                    <span style={{
                                        fontSize: 13, fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: 2,
                                        color: scanSuccess ? GREEN : CYAN,
                                    }}>
                                        {scanSuccess ? 'Identificado!' : (cameraReady ? 'Buscando QR Code...' : 'Iniciando câmera...')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Camera loading overlay */}
                        {!cameraReady && !error && (
                            <div style={{
                                position: 'absolute', inset: 0, zIndex: 20,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.7)',
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        width: 56, height: 56, borderRadius: '50%',
                                        border: `4px solid ${CYAN}`,
                                        borderTopColor: 'transparent',
                                        margin: '0 auto 16px',
                                        animation: 'spin 1s linear infinite',
                                    }} className="animate-spin" />
                                    <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 3 }}>
                                        Iniciando câmera...
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right sidebar */}
                <div
                    className="tqr-sidebar"
                    style={{
                        width: 360, flexShrink: 0,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        padding: '28px 24px', gap: 20,
                        borderLeft: `1px solid rgba(199,158,97,0.15)`,
                        overflowY: 'auto',
                    }}
                >
                    {/* How-to card */}
                    <GlassPanel outerStyle={{ boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 0 15px rgba(199,158,97,0.04)` }}>
                        <div style={{
                            padding: '28px 24px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
                        }}>
                            {/* QR icon */}
                            <div style={{
                                width: 72, height: 72, borderRadius: 16,
                                background: 'radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.88))',
                                display: 'grid', placeItems: 'center',
                                border: `1.5px solid rgba(41,128,185,0.4)`,
                                boxShadow: `0 0 28px rgba(41,128,185,0.22), inset 0 0 10px rgba(0,0,0,0.2)`,
                            }}>
                                <QrCode style={{ width: 32, height: 32, color: BLUE_COL, filter: `drop-shadow(0 0 8px rgba(41,128,185,0.5))` }} />
                            </div>

                            {/* Title */}
                            <h2 style={{
                                margin: 0, fontSize: 16, fontWeight: 800,
                                color: GOLD, textTransform: 'uppercase', letterSpacing: 2,
                            }}>
                                Como Usar
                            </h2>

                            {/* Steps */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
                                {[
                                    { step: '1', text: 'Aproxime o código QR da câmera à esquerda.', cls: 'tqr-step-badge-1' },
                                    { step: '2', text: 'Aguarde o bipe/confirmação visual.', cls: 'tqr-step-badge-2' },
                                    { step: '3', text: 'Aproxime outro cartão ou finalize.', cls: 'tqr-step-badge-3' },
                                ].map(({ step, text, cls }) => (
                                    <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                        <div
                                            className={cls}
                                            style={{
                                                width: 32, height: 32, borderRadius: 6,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 15, fontWeight: 800, flexShrink: 0,
                                                background: 'rgba(1,4,10,0.6)',
                                            }}
                                        >
                                            {step}
                                        </div>
                                        <p style={{ fontSize: 14, color: TEXT_MUTED, lineHeight: 1.6, margin: 0 }}>
                                            {text}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Finalizar button */}
                            {selectedStudents.length > 0 && (
                                <button className="tqr-next-btn" onClick={handleNext}>
                                    Finalizar ({selectedStudents.length})
                                    <ChevronRight style={{ width: 16, height: 16 }} />
                                </button>
                            )}
                        </div>
                    </GlassPanel>

                    {/* Error / troubleshooting box */}
                    {error && (
                        <div style={{
                            borderRadius: 10,
                            border: '1px solid rgba(255,69,0,0.4)',
                            background: 'rgba(255,69,0,0.05)',
                            padding: '16px 18px',
                            display: 'flex', flexDirection: 'column', gap: 12,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <AlertCircle style={{ width: 16, height: 16, color: 'rgba(255,127,80,0.9)', flexShrink: 0, marginTop: 1 }} />
                                <p style={{ fontSize: 13, color: 'rgba(255,127,80,0.9)', lineHeight: 1.5, margin: 0 }}>{error}</p>
                            </div>
                            <button
                                className="tqr-retry-btn"
                                onClick={() => { setError(null); setScanning(true); setCameraReady(false); }}
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Selection tray */}
            {selectedStudents.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, height: 88, zIndex: 20,
                    background: 'rgba(5,11,29,0.9)',
                    backdropFilter: 'blur(16px)',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center',
                    padding: '0 32px', gap: 16,
                }}>
                    <div style={{ flex: 1, display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                        {selectedStudents.map(s => (
                            <div key={s.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '6px 12px 6px 8px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 20, flexShrink: 0,
                            }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                                    {s.foto_url
                                        ? <img src={s.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <UserIcon style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.3)' }} />
                                    }
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                                    {s.nome_completo.split(' ')[0]}
                                </span>
                                <button
                                    onClick={() => setSelectedStudents(prev => prev.filter(st => st.id !== s.id))}
                                    style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 900, lineHeight: 1, marginLeft: 4, fontFamily: 'inherit' }}
                                >×</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
            <footer style={{
                position: 'relative', zIndex: 2,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 40px',
                background: 'rgba(0,0,0,0.6)',
                borderTop: `1px solid rgba(199,158,97,0.15)`,
                fontSize: 11, color: TEXT_MUTED,
                textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: GREEN, boxShadow: `0 0 6px ${GREEN}`,
                    }} />
                    <span>Sistema Ativo</span>
                    <span style={{ color: `${TEXT_MUTED}60`, margin: '0 8px' }}>·</span>
                    <Settings style={{ width: 12, height: 12, color: GOLD }} />
                    <span>Sistema de Retirada Segura — La Salle</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wifi style={{ width: 12, height: 12, color: GOLD }} />
                    <span>Status do Link:</span>
                    <span style={{ color: GREEN }}>Estável</span>
                </div>
            </footer>
        </div>
    );
}

const UserIcon = ({ style }: { style?: React.CSSProperties }) => (
    <svg style={style} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
);

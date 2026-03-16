import { useRef, useEffect, useState, useCallback } from 'react';
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

// localStorage key — marks that camera permission was granted on this device before
const CAM_GRANTED_KEY = 'sisra_cam_granted';

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
    // true if we know camera was already granted on this device (skip "needs permission" hint)
    const [camPreviouslyGranted] = useState(() => {
        try { return localStorage.getItem(CAM_GRANTED_KEY) === '1'; } catch { return false; }
    });
    useInactivityTimer({ timeoutMs: 60000, redirectTo: '/totem' });

    useEffect(() => {
        let stream: MediaStream | null = null;
        let animId: number;
        let resolved = false;
        let lastScanTime = 0;

        const startCamera = async () => {
            try {
                // ── Permission pre-check (avoids showing a blocked camera) ────────
                if ('permissions' in navigator) {
                    try {
                        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
                        if (perm.state === 'denied') {
                            setError('Câmera bloqueada. Acesse as configurações do navegador e libere o acesso à câmera para este site.');
                            return;
                        }
                    } catch {
                        // Permissions API not supported on this browser — proceed normally
                    }
                }

                // ── Request camera stream ──────────────────────────────────────────
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width:  { ideal: 1280 },
                        height: { ideal: 720 },
                    }
                });

                // Mark on this device that camera was granted (persists across sessions)
                try { localStorage.setItem(CAM_GRANTED_KEY, '1'); } catch {}

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {}); // some browsers need explicit play
                    videoRef.current.onloadeddata = () => {
                        setCameraReady(true);
                        animId = requestAnimationFrame(scan);
                    };
                }
            } catch (err: any) {
                if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                    setError('Acesso à câmera foi negado. Acesse as configurações do navegador para liberar a câmera.');
                } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
                    setError('Nenhuma câmera encontrada neste dispositivo.');
                } else if (err?.name === 'NotReadableError') {
                    setError('A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.');
                } else {
                    setError('Não foi possível acessar a câmera. Verifique as permissões do dispositivo.');
                }
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

            // ── Throttle: process one frame every ~150ms (≈6 fps) ────────────────
            // Prevents CPU hammering while still catching all QR presentations
            const now = Date.now();
            if (now - lastScanTime < 150) {
                animId = requestAnimationFrame(scan);
                return;
            }
            lastScanTime = now;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            canvas.width  = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // ── Pass 1: Central 70% square — fast path, matches UI target box ────
            const scanSize = Math.min(canvas.width, canvas.height) * 0.7;
            const sx = (canvas.width  - scanSize) / 2;
            const sy = (canvas.height - scanSize) / 2;
            const centralData = ctx.getImageData(sx, sy, scanSize, scanSize);
            let code = jsQR(centralData.data, centralData.width, centralData.height, {
                inversionAttempts: 'attemptBoth'
            });

            // ── Pass 2: Full image fallback — catches QR codes near edges ─────────
            if (!code) {
                const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                code = jsQR(fullData.data, fullData.width, fullData.height, {
                    inversionAttempts: 'attemptBoth'
                });
            }

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

    const handleQRData = useCallback(async (qrData: string) => {
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
    }, [selectedStudents, navigate]);

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

    const handleRetry = () => {
        setError(null);
        setScanning(true);
        setCameraReady(false);
        setScanSuccess(false);
    };

    return (
        <div style={{
            width: '100vw', height: '100dvh',
            background: '#050b1d',
            color: '#fff',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            position: 'relative',
        }}>
            {/* ── Scoped styles ─────────────────────────────────────────────────── */}
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
                    padding: 8px 14px;
                    background: transparent;
                    border: 1px solid ${GOLD};
                    border-radius: 6px; cursor: pointer;
                    color: ${GOLD}; font-size: 12px; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 1px;
                    transition: all 0.2s ease; font-family: inherit;
                    white-space: nowrap;
                }
                .tqr-back-btn:hover { background: rgba(199,158,97,0.1); box-shadow: 0 0 10px rgba(199,158,97,0.2); }
                .tqr-step-badge-1 { color: ${GOLD}; border: 1px solid ${GOLD}; box-shadow: 0 0 8px rgba(199,158,97,0.2); }
                .tqr-step-badge-2 { color: ${CYAN}; border: 1px solid ${CYAN}; box-shadow: 0 0 8px rgba(71,184,255,0.2); }
                .tqr-step-badge-3 { color: ${GOLD}; border: 1px solid ${GOLD}; box-shadow: 0 0 8px rgba(199,158,97,0.2); }
                .tqr-retry-btn {
                    width: 100%; padding: 9px;
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
                    background: ${GREEN};
                    border: none; border-radius: 20px; cursor: pointer;
                    color: #07111e; font-size: 13px; font-weight: 800;
                    text-transform: uppercase; letter-spacing: 2px;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    box-shadow: 0 4px 20px rgba(52,211,153,0.3);
                    transition: all 0.2s ease; font-family: inherit;
                }
                .tqr-next-btn:hover { opacity: 0.9; transform: translateY(-1px); }
                @keyframes tqr-scan-line {
                    0%   { top: 4px; opacity: 0.8; }
                    50%  { top: calc(100% - 6px); opacity: 1; }
                    100% { top: 4px; opacity: 0.8; }
                }
                .tqr-scan-line { animation: tqr-scan-line 2s ease-in-out infinite; }
                @keyframes tqr-spin { to { transform: rotate(360deg); } }
                .tqr-spinner { animation: tqr-spin 1s linear infinite; }

                /* ── Responsive layout ─────────────────────────────────────────── */

                /* Default: landscape/desktop — side by side */
                .tqr-main {
                    flex: 1;
                    display: flex;
                    flex-direction: row;
                    overflow: hidden;
                    position: relative;
                    z-index: 2;
                }
                .tqr-camera {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: clamp(12px, 2vw, 32px);
                    background: rgba(0,0,0,0.2);
                    min-width: 0;
                }
                .tqr-cam-frame {
                    position: relative;
                    /* Square aspect that fills available space without overflow */
                    width: min(100%, calc(100vh - 200px));
                    aspect-ratio: 1;
                    max-width: 580px;
                    background: #01040a;
                    overflow: hidden;
                    border-radius: 6px;
                    box-shadow: 0 0 40px rgba(71,184,255,0.15), inset 0 0 20px rgba(199,158,97,0.08);
                    border: 1px solid rgba(199,158,97,0.25);
                }
                .tqr-sidebar {
                    width: clamp(260px, 28vw, 380px);
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: clamp(16px, 2vw, 28px) clamp(14px, 1.5vw, 24px);
                    gap: 16px;
                    border-left: 1px solid rgba(199,158,97,0.15);
                    overflow-y: auto;
                }
                /* Scan target box — scales with viewport */
                .tqr-target {
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: clamp(140px, 42%, 260px);
                    height: clamp(140px, 42%, 260px);
                    border-radius: 20px;
                    transition: all 0.3s ease;
                }
                .tqr-footer {
                    position: relative; z-index: 2;
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 9px clamp(16px, 3vw, 40px);
                    background: rgba(0,0,0,0.6);
                    border-top: 1px solid rgba(199,158,97,0.15);
                    font-size: 11px; color: ${TEXT_MUTED};
                    text-transform: uppercase; font-weight: 700; letter-spacing: 1px;
                    flex-shrink: 0;
                }

                /* Portrait tablets / large phones in portrait */
                @media (orientation: portrait) and (max-width: 1024px) {
                    .tqr-main { flex-direction: column; }
                    .tqr-camera { flex: unset; padding: 16px 16px 8px; }
                    .tqr-cam-frame {
                        width: min(88vw, 480px);
                        max-width: none;
                    }
                    .tqr-sidebar {
                        width: 100%;
                        flex-direction: row;
                        flex-wrap: wrap;
                        border-left: none;
                        border-top: 1px solid rgba(199,158,97,0.15);
                        justify-content: center;
                        padding: 12px 16px;
                        gap: 12px;
                        flex-shrink: 0;
                        overflow-y: visible;
                    }
                    .tqr-how-card { flex: 1; min-width: 280px; max-width: 500px; }
                }

                /* Small phones in landscape (short height) */
                @media (orientation: landscape) and (max-height: 500px) {
                    .tqr-sidebar { display: none; }
                    .tqr-cam-frame {
                        width: min(calc(100vh - 140px), 420px);
                    }
                    .tqr-footer { display: none; }
                }

                /* Very small screens */
                @media (max-width: 480px) {
                    .tqr-footer-text { display: none; }
                }
            `}</style>

            {/* Background */}
            <div className="tqr-bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <header style={{
                position: 'relative', zIndex: 2, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'clamp(10px, 1.5vh, 18px) clamp(14px, 3vw, 40px)',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: `1px solid rgba(199,158,97,0.2)`,
                gap: 12,
            }}>
                {/* Back */}
                <button className="tqr-back-btn" onClick={() => navigate('/totem/identificar')}>
                    <ArrowLeft style={{ width: 15, height: 15 }} />
                    Voltar
                </button>

                {/* Center title */}
                <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                    <h1 style={{
                        margin: 0, fontSize: 'clamp(14px, 2.5vw, 22px)', fontWeight: 800,
                        background: `linear-gradient(90deg, ${CYAN}, #a64dff)`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        textTransform: 'uppercase', letterSpacing: -0.5,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        Escanear QR Code
                    </h1>
                    <p className="tqr-footer-text" style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_MUTED, fontWeight: 400 }}>
                        Aproxime os cartões para adicionar alunos
                    </p>
                </div>

                {/* Right: badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {selectedStudents.length > 0 && (
                        <GlassPanel outerStyle={{ boxShadow: `0 4px 16px rgba(41,128,185,0.25)` }}>
                            <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 800, color: CYAN, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>
                                {selectedStudents.length} aluno{selectedStudents.length > 1 ? 's' : ''}
                            </div>
                        </GlassPanel>
                    )}
                    <div style={{
                        border: `1px solid ${GREEN}`, color: GREEN,
                        padding: '4px 10px', borderRadius: 12,
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap',
                    }}>
                        Ao Vivo
                    </div>
                </div>
            </header>

            {/* ── MAIN ────────────────────────────────────────────────────────── */}
            <div className="tqr-main">

                {/* Camera panel */}
                <div className="tqr-camera">
                    <div className="tqr-cam-frame">
                        {/* Inner frame accent */}
                        <div style={{
                            position: 'absolute', top: 10, right: 10, bottom: 10, left: 10,
                            border: '1px solid rgba(199,158,97,0.1)', borderRadius: 4,
                            pointerEvents: 'none', zIndex: 5,
                        }} />

                        {/* Video feed */}
                        <video
                            ref={videoRef}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }}
                            playsInline
                            autoPlay
                            muted
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        {/* Scanner UI overlay */}
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                            {/* Darkened border */}
                            <div style={{ position: 'absolute', inset: 0, border: '50px solid rgba(0,0,0,0.28)' }} />

                            {/* Target box */}
                            <div
                                className="tqr-target"
                                style={{
                                    border: `2px solid ${scanSuccess ? GREEN : `${CYAN}80`}`,
                                    background: scanSuccess ? 'rgba(52,211,153,0.08)' : 'transparent',
                                }}
                            >
                                {/* Corner brackets */}
                                {([
                                    { top: -1, left:  -1, borderTop:    `4px solid ${scanSuccess ? GREEN : CYAN}`, borderLeft:   `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '12px 0 0 0' },
                                    { top: -1, right: -1, borderTop:    `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRight:  `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '0 12px 0 0' },
                                    { bottom: -1, left:  -1, borderBottom: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderLeft:  `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '0 0 0 12px' },
                                    { bottom: -1, right: -1, borderBottom: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRight: `4px solid ${scanSuccess ? GREEN : CYAN}`, borderRadius: '0 0 12px 0' },
                                ] as React.CSSProperties[]).map((s, i) => (
                                    <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s }} />
                                ))}

                                {/* Scan line */}
                                {cameraReady && !scanSuccess && (
                                    <div className="tqr-scan-line" style={{
                                        position: 'absolute', left: 12, right: 12, height: 2,
                                        background: CYAN,
                                        boxShadow: `0 0 12px rgba(71,184,255,0.8)`,
                                    }} />
                                )}
                            </div>

                            {/* Status pill */}
                            <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 16px', borderRadius: 30,
                                    backdropFilter: 'blur(8px)',
                                    background: scanSuccess ? 'rgba(52,211,153,0.15)' : 'rgba(1,4,10,0.8)',
                                    border: `1px solid ${scanSuccess ? GREEN : `${CYAN}50`}`,
                                    transition: 'all 0.3s ease',
                                }}>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: scanSuccess ? GREEN : CYAN,
                                        boxShadow: `0 0 8px ${scanSuccess ? 'rgba(52,211,153,0.8)' : 'rgba(71,184,255,0.8)'}`,
                                    }} />
                                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: scanSuccess ? GREEN : CYAN }}>
                                        {scanSuccess ? 'Identificado!' : (cameraReady ? 'Buscando QR Code...' : 'Iniciando câmera...')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Loading overlay — shown only while camera is starting */}
                        {!cameraReady && !error && (
                            <div style={{
                                position: 'absolute', inset: 0, zIndex: 20,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.75)',
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div className="tqr-spinner" style={{
                                        width: 48, height: 48, borderRadius: '50%',
                                        border: `4px solid rgba(71,184,255,0.2)`,
                                        borderTopColor: CYAN,
                                        margin: '0 auto 14px',
                                    }} />
                                    <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 3 }}>
                                        {camPreviouslyGranted ? 'Iniciando câmera...' : 'Aguardando permissão...'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right sidebar */}
                <div className="tqr-sidebar">
                    {/* How-to card */}
                    <GlassPanel
                        className="tqr-how-card"
                        outerStyle={{ boxShadow: `0 8px 32px rgba(0,0,0,0.4)` }}
                    >
                        <div style={{ padding: 'clamp(16px,2vw,24px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                            {/* QR icon */}
                            <div style={{
                                width: 64, height: 64, borderRadius: 14,
                                background: 'radial-gradient(circle, rgba(22,28,44,0.3), rgba(10,15,31,0.88))',
                                display: 'grid', placeItems: 'center',
                                border: `1.5px solid rgba(41,128,185,0.4)`,
                                boxShadow: `0 0 24px rgba(41,128,185,0.22), inset 0 0 10px rgba(0,0,0,0.2)`,
                            }}>
                                <QrCode style={{ width: 28, height: 28, color: BLUE_COL, filter: `drop-shadow(0 0 8px rgba(41,128,185,0.5))` }} />
                            </div>

                            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: GOLD, textTransform: 'uppercase', letterSpacing: 2 }}>
                                Como Usar
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
                                {[
                                    { step: '1', text: 'Aproxime o código QR da câmera à esquerda.', cls: 'tqr-step-badge-1' },
                                    { step: '2', text: 'Aguarde o bipe/confirmação visual.',          cls: 'tqr-step-badge-2' },
                                    { step: '3', text: 'Aproxime outro cartão ou finalize.',          cls: 'tqr-step-badge-3' },
                                ].map(({ step, text, cls }) => (
                                    <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <div className={cls} style={{
                                            width: 30, height: 30, borderRadius: 6,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 14, fontWeight: 800, flexShrink: 0,
                                            background: 'rgba(1,4,10,0.6)',
                                        }}>{step}</div>
                                        <p style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6, margin: 0 }}>{text}</p>
                                    </div>
                                ))}
                            </div>

                            {selectedStudents.length > 0 && (
                                <button className="tqr-next-btn" onClick={handleNext}>
                                    Finalizar ({selectedStudents.length})
                                    <ChevronRight style={{ width: 15, height: 15 }} />
                                </button>
                            )}
                        </div>
                    </GlassPanel>

                    {/* Error box */}
                    {error && (
                        <div style={{
                            borderRadius: 10,
                            border: '1px solid rgba(255,69,0,0.4)',
                            background: 'rgba(255,69,0,0.05)',
                            padding: '14px 16px',
                            display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <AlertCircle style={{ width: 15, height: 15, color: 'rgba(255,127,80,0.9)', flexShrink: 0, marginTop: 2 }} />
                                <p style={{ fontSize: 12, color: 'rgba(255,127,80,0.9)', lineHeight: 1.5, margin: 0 }}>{error}</p>
                            </div>
                            <button className="tqr-retry-btn" onClick={handleRetry}>
                                Tentar Novamente
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Selection tray */}
            {selectedStudents.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
                    background: 'rgba(5,11,29,0.92)',
                    backdropFilter: 'blur(16px)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center',
                    padding: '10px clamp(16px,3vw,32px)', gap: 12,
                    minHeight: 72,
                }}>
                    <div style={{ flex: 1, display: 'flex', gap: 10, overflowX: 'auto' }}>
                        {selectedStudents.map(s => (
                            <div key={s.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '5px 10px 5px 6px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 20, flexShrink: 0,
                            }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
                                    {s.foto_url
                                        ? <img src={s.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : <UserIcon style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.3)', margin: '8px auto 0', display: 'block' }} />
                                    }
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                                    {s.nome_completo.split(' ')[0]}
                                </span>
                                <button
                                    onClick={() => setSelectedStudents(prev => prev.filter(st => st.id !== s.id))}
                                    style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 900, lineHeight: 1, padding: '0 2px', fontFamily: 'inherit' }}
                                >×</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
            <footer className="tqr-footer" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
                    <span>Sistema Ativo</span>
                    <span className="tqr-footer-text" style={{ color: `${TEXT_MUTED}60`, margin: '0 6px' }}>·</span>
                    <Settings className="tqr-footer-text" style={{ width: 12, height: 12, color: GOLD }} />
                    <span className="tqr-footer-text">Sistema de Retirada Segura — La Salle</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wifi style={{ width: 12, height: 12, color: GOLD }} />
                    <span>Status:</span>
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

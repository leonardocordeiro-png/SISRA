import { useRef, useEffect, useState } from 'react';
import { X, QrCode, Camera, CameraOff, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

type CameraError = {
    title: string;
    message: string;
    hint: string;
    icon: 'permission' | 'notfound' | 'inuse' | 'https' | 'generic';
};

function diagnoseCameraError(error: unknown): CameraError {
    if (!window.isSecureContext) {
        return {
            title: 'Conexão não segura',
            message: 'A câmera só funciona em conexões HTTPS.',
            hint: 'Acesse o sistema via HTTPS ou utilize localhost.',
            icon: 'https',
        };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        return {
            title: 'Câmera não suportada',
            message: 'Este navegador não suporta acesso à câmera.',
            hint: 'Use Chrome, Edge ou Safari atualizados.',
            icon: 'generic',
        };
    }
    const name = (error as DOMException)?.name ?? '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return {
            title: 'Permissão negada',
            message: 'O acesso à câmera foi bloqueado.',
            hint: 'Clique no ícone de cadeado na barra do navegador e permita o acesso à câmera.',
            icon: 'permission',
        };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return {
            title: 'Câmera não encontrada',
            message: 'Nenhuma câmera foi detectada neste dispositivo.',
            hint: 'Conecte uma webcam ou use um dispositivo com câmera integrada.',
            icon: 'notfound',
        };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
        return {
            title: 'Câmera em uso',
            message: 'A câmera está sendo usada por outro aplicativo.',
            hint: 'Feche outros programas que possam estar usando a câmera e tente novamente.',
            icon: 'inuse',
        };
    }
    return {
        title: 'Erro de câmera',
        message: 'Não foi possível iniciar a câmera.',
        hint: 'Verifique as permissões do navegador e tente novamente.',
        icon: 'generic',
    };
}

export default function QRScannerModal({ isOpen, onClose, onScan }: QRScannerModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationIdRef = useRef<number>(0);
    const [cameraError, setCameraError] = useState<CameraError | null>(null);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        if (!isOpen) return;

        setCameraError(null);
        let cancelled = false;

        const scanQRCode = () => {
            if (cancelled) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'dontInvert',
                    });
                    if (code) {
                        onScan(code.data);
                        return;
                    }
                }
            }
            animationIdRef.current = requestAnimationFrame(scanQRCode);
        };

        const startCamera = async () => {
            // Try rear camera first, fall back to any camera (desktop)
            const constraints: MediaStreamConstraints[] = [
                { video: { facingMode: 'environment' } },
                { video: true },
            ];

            let stream: MediaStream | null = null;
            let lastError: unknown = null;

            for (const constraint of constraints) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraint);
                    break;
                } catch (err) {
                    lastError = err;
                }
            }

            if (!stream) {
                if (!cancelled) setCameraError(diagnoseCameraError(lastError));
                return;
            }

            streamRef.current = stream;
            if (videoRef.current && !cancelled) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                animationIdRef.current = requestAnimationFrame(scanQRCode);
            }
        };

        startCamera();

        return () => {
            cancelled = true;
            cancelAnimationFrame(animationIdRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, [isOpen, retryKey]);

    if (!isOpen) return null;

    const errorIcons = {
        permission: <ShieldAlert className="w-10 h-10 text-amber-400" />,
        notfound: <CameraOff className="w-10 h-10 text-slate-400" />,
        inuse: <Camera className="w-10 h-10 text-rose-400" />,
        https: <WifiOff className="w-10 h-10 text-rose-400" />,
        generic: <CameraOff className="w-10 h-10 text-slate-400" />,
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#0f172a] w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl shadow-emerald-500/10 border border-white/10 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <QrCode className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black italic tracking-tighter text-white uppercase">Escanear QR de Identidade</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aproxime o cartão da câmera</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Camera error state */}
                {cameraError ? (
                    <div className="m-6 rounded-3xl border border-white/10 bg-[#020617]/60 flex flex-col items-center justify-center gap-5 p-10 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            {errorIcons[cameraError.icon]}
                        </div>
                        <div className="space-y-1.5">
                            <p className="font-black text-white uppercase tracking-tight text-base">{cameraError.title}</p>
                            <p className="text-sm text-slate-400 leading-relaxed">{cameraError.message}</p>
                        </div>
                        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl max-w-xs">
                            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide leading-relaxed">{cameraError.hint}</p>
                        </div>
                        <button
                            onClick={() => setRetryKey(k => k + 1)}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-[#020617] rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Tentar novamente
                        </button>
                    </div>
                ) : (
                    /* Camera active state */
                    <div className="relative aspect-square bg-black overflow-hidden m-6 rounded-3xl border-2 border-white/5">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            playsInline
                            muted
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanner Overlay UI */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 border-[40px] border-slate-900/40"></div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-emerald-500/50 rounded-3xl">
                                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
                                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
                                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
                                <div className="absolute inset-x-4 top-0 h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-scan-line"></div>
                            </div>
                            <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="px-6 py-3 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Buscando QR Code...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-6 pt-0 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-relaxed max-w-[220px] mx-auto">
                        Aponte a câmera para o código impresso no cartão de segurança do aluno.
                    </p>
                </div>
            </div>
        </div>
    );
}

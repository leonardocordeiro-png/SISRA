import { useRef, useEffect } from 'react';
import { X, QrCode } from 'lucide-react';
import jsQR from 'jsqr';
import { useToast } from '../../components/ui/Toast';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

export default function QRScannerModal({ isOpen, onClose, onScan }: QRScannerModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const toast = useToast();

    useEffect(() => {
        let stream: MediaStream | null = null;
        let animationId: number;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                    requestAnimationFrame(scanQRCode);
                }
            } catch (error) {
                console.error('Erro ao acessar câmera:', error);
                toast.error('Erro de câmera', 'Não foi possível acessar a câmera. Verifique as permissões.');
                onClose();
            }
        };

        const scanQRCode = () => {
            if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                const context = canvas.getContext('2d');

                if (context) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'dontInvert',
                    });

                    if (code) {
                        onScan(code.data);
                        return; // Stop scanning once found
                    }
                }
            }
            animationId = requestAnimationFrame(scanQRCode);
        };

        if (isOpen) {
            startCamera();
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            cancelAnimationFrame(animationId);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#0f172a] w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl shadow-emerald-500/10 border border-white/10 flex flex-col">
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

                <div className="relative aspect-square bg-black overflow-hidden m-6 rounded-3xl border-2 border-white/5">
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanner Overlay UI */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 border-[40px] border-slate-900/40"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-emerald-500/50 rounded-3xl">
                            {/* Corner Markers */}
                            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
                            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
                            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>

                            {/* Scanning Animation */}
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

                <div className="p-8 pt-0 text-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-relaxed max-w-[200px] mx-auto">
                        Aponte a câmera para o código impresso no cartão de segurança do aluno.
                    </p>
                </div>
            </div>
        </div>
    );
}

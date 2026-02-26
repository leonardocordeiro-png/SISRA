import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, QrCode, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';
import jsQR from 'jsqr';
import type { Student } from '../../types';

export default function TotemQRScan() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(true);
    const [cameraReady, setCameraReady] = useState(false);
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
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
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

    const handleQRData = async (qrData: string) => {
        setScanning(false);
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

            const [{ data: guardian }, { data: auths }] = await Promise.all([
                supabase.from('responsaveis').select('id, nome_completo, foto_url').eq('id', responsavelId).single(),
                supabase.from('autorizacoes').select('alunos:aluno_id (*)').eq('responsavel_id', responsavelId).eq('ativa', true),
            ]);

            if (!guardian) throw new Error('Responsável não encontrado no sistema.');

            const students: Student[] = (auths || [])
                .map((a: any) => Array.isArray(a.alunos) ? a.alunos[0] : a.alunos)
                .filter((s: any): s is Student => s !== null);

            if (students.length === 0) throw new Error('Nenhum aluno vinculado a este QR Code.');

            navigate('/totem/confirmacao', {
                state: { students, guardian, mode: 'qr' }
            });
        } catch (e: any) {
            setError(e.message || 'Erro ao processar QR Code.');
        }
    };

    return (
        <div
            className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col"
            style={{ width: '1280px', minHeight: '1024px' }}
        >
            {/* Ambient */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] right-[-5%] w-[55%] h-[70%] bg-blue-500/[0.05] blur-[140px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-white/5">
                <button
                    onClick={() => navigate('/totem/identificar')}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all active:scale-95 text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Voltar</span>
                </button>
                <div className="text-center">
                    <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                        <div className="w-1.5 h-7 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                        Escanear QR Code
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        Aproxime o cartão da câmera do terminal
                    </p>
                </div>
                <div className="w-32" />
            </div>

            {/* Main: camera LEFT | instructions RIGHT */}
            <div className="relative z-10 flex-1 flex flex-row gap-0 overflow-hidden">

                {/* Camera view */}
                <div className="flex-1 relative bg-black/60 p-10 flex items-center justify-center">
                    <div className="relative w-full max-w-[560px] aspect-video rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl bg-black">
                        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanner UI overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Darkened corners */}
                            <div className="absolute inset-0 border-[60px] border-black/30" />
                            {/* Target box */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 border-2 border-blue-500/50 rounded-3xl">
                                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
                                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
                                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
                                {/* Scan line */}
                                {cameraReady && <div className="absolute inset-x-4 top-0 h-0.5 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-[scan-line_2s_ease-in-out_infinite]" />}
                            </div>

                            {/* Status pill */}
                            <div className="absolute bottom-4 inset-x-0 flex justify-center">
                                <div className="px-5 py-2.5 bg-slate-900/80 backdrop-blur-md border border-blue-500/30 rounded-full flex items-center gap-2.5">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                    <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                                        {cameraReady ? 'Buscando QR Code...' : 'Iniciando câmera...'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* No camera / error overlay */}
                        {!cameraReady && !error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                    <p className="text-white/60 text-sm font-bold uppercase tracking-widest">Iniciando câmera...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: instructions */}
                <div className="w-[380px] flex-shrink-0 flex flex-col px-10 py-10 border-l border-white/5 gap-8 justify-center">
                    <div className="relative">
                        <div className="absolute -inset-6 bg-blue-500/10 blur-2xl rounded-full animate-pulse" />
                        <div className="relative w-20 h-20 bg-blue-500/10 border-2 border-blue-500/30 rounded-[2rem] flex items-center justify-center shadow-2xl mx-auto">
                            <QrCode className="w-10 h-10 text-blue-400" />
                        </div>
                    </div>

                    <div className="text-center space-y-3">
                        <h2 className="text-2xl font-black italic text-white uppercase tracking-tight">Como usar</h2>
                    </div>

                    <div className="space-y-4">
                        {[
                            { step: '1', text: 'Pegue o cartão QR fornecido pelo aplicativo' },
                            { step: '2', text: 'Aproxime o código QR da câmera à esquerda' },
                            { step: '3', text: 'Mantenha firme até a leitura ser concluída' },
                        ].map(({ step, text }) => (
                            <div key={step} className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                                    {step}
                                </div>
                                <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="flex items-start gap-3 px-5 py-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold">{error}</p>
                                <button
                                    onClick={() => { setError(null); setScanning(true); setCameraReady(false); }}
                                    className="mt-3 text-xs font-black uppercase tracking-widest underline"
                                >
                                    Tentar novamente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

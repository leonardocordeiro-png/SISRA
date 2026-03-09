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
        <div className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col">
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
                        Aproxime os cartões para adicionar alunos
                    </p>
                </div>
                <div className="w-32 flex justify-end">
                    {selectedStudents.length > 0 && (
                        <div className="bg-blue-500 text-white px-4 py-2 rounded-xl font-black text-xs animate-bounce">
                            {selectedStudents.length} ALUNO{selectedStudents.length > 1 ? 'S' : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Main: camera LEFT | instructions RIGHT */}
            <div className="relative z-10 flex-1 flex flex-row gap-0 overflow-hidden">

                {/* Camera view */}
                <div className="flex-1 relative bg-black/60 p-10 flex items-center justify-center">
                    <div className="relative w-full max-w-[560px] aspect-video rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl bg-black">
                        <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                            playsInline
                            muted
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanner UI overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Darkened corners */}
                            <div className="absolute inset-0 border-[60px] border-black/30" />
                            {/* Target box */}
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 border-2 rounded-3xl transition-all duration-300 ${scanSuccess ? 'border-emerald-500 bg-emerald-500/10 scale-110' : 'border-blue-500/50'}`}>
                                <div className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors ${scanSuccess ? 'border-emerald-500' : 'border-blue-500'}`} />
                                <div className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors ${scanSuccess ? 'border-emerald-500' : 'border-blue-500'}`} />
                                <div className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl transition-colors ${scanSuccess ? 'border-emerald-500' : 'border-blue-500'}`} />
                                <div className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-xl transition-colors ${scanSuccess ? 'border-emerald-500' : 'border-blue-500'}`} />
                                {/* Scan line */}
                                {cameraReady && !scanSuccess && <div className="absolute inset-x-4 top-0 h-0.5 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-[scan-line_2s_ease-in-out_infinite]" />}
                            </div>

                            {/* Status pill */}
                            <div className="absolute bottom-4 inset-x-0 flex justify-center">
                                <div className={`px-5 py-2.5 backdrop-blur-md border rounded-full flex items-center gap-2.5 transition-all ${scanSuccess ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-900/80 border-blue-500/30'}`}>
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${scanSuccess ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                    <span className={`text-xs font-black uppercase tracking-widest ${scanSuccess ? 'text-emerald-400' : 'text-blue-400'}`}>
                                        {scanSuccess ? 'Identificado!' : (cameraReady ? 'Buscando QR Code...' : 'Iniciando câmera...')}
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
                <div className="w-[340px] flex-shrink-0 flex flex-col px-8 py-10 border-l border-white/5 gap-8 justify-center">
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
                            { step: '1', text: 'Aproxime o código QR da câmera à esquerda' },
                            { step: '2', text: 'Aguarde o bipe/confirmação visual' },
                            { step: '3', text: 'Aproxime outro cartão ou finalize' },
                        ].map(({ step, text }) => (
                            <div key={step} className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                                    {step}
                                </div>
                                <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
                            </div>
                        ))}
                    </div>

                    {selectedStudents.length > 0 && (
                        <button
                            onClick={handleNext}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
                        >
                            Finalizar ({selectedStudents.length}) →
                        </button>
                    )}

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

            {/* Selection Tray Overlay at bottom */}
            {selectedStudents.length > 0 && (
                <div className="fixed bottom-0 inset-x-0 h-24 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex items-center px-12 gap-6 z-20">
                    <div className="flex-1 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {selectedStudents.map(s => (
                            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-full shrink-0">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
                                    {s.foto_url ? <img src={s.foto_url} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-slate-500 mx-auto mt-2" />}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-tight text-white/70">{s.nome_completo.split(' ')[0]}</span>
                                <button onClick={() => setSelectedStudents(prev => prev.filter(st => st.id !== s.id))} className="text-rose-500 hover:text-rose-400 ml-1">×</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const UserIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
);

import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCcw, Check, ShieldCheck, FlipHorizontal } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { compressAndResizeImage } from '../../lib/imageUtils';

interface CameraCaptureProps {
    onCapture: (image: string) => void;
    onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const webcamRef = useRef<Webcam>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [permissionError, setPermissionError] = useState(false);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const toast = useToast();

    const toggleCamera = useCallback(() => {
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    }, []);

    const capture = useCallback(async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setIsOptimizing(true);
            try {
                // Use centralized compression (max 1024px, 0.8 quality)
                const optimized = await compressAndResizeImage(imageSrc, 1024, 0.8);
                setCapturedImage(optimized);
            } catch (err) {
                console.error('[CameraCapture] Optimization error:', err);
                setCapturedImage(imageSrc);
            } finally {
                setIsOptimizing(false);
            }
        }
    }, [webcamRef]);

    const handleUserMediaError = useCallback(() => {
        setPermissionError(true);
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-[100] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Capturar Foto</h3>
                        <p className="text-xs text-slate-500">
                            {facingMode === 'user' ? 'Modo Selfie: Imagem espelhada para facilitar.' : 'Câmera Principal: Visão direta.'}
                        </p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="relative aspect-[3/4] bg-black flex items-center justify-center overflow-hidden">
                    {permissionError ? (
                        <div className="p-12 text-center space-y-4">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900">Permissão Negada</h4>
                            <p className="text-sm text-slate-500">Não conseguimos acessar sua câmera. Por favor, verifique as permissões do seu navegador.</p>
                            <button
                                onClick={onCancel}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm"
                            >
                                Voltar
                            </button>
                        </div>
                    ) : !capturedImage ? (
                        <>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                mirrored={facingMode === 'user'}
                                videoConstraints={{
                                    facingMode: facingMode,
                                    width: { ideal: 1080 },
                                    height: { ideal: 1440 }, // High quality source for better processing
                                    aspectRatio: 3 / 4
                                }}
                                onUserMediaError={handleUserMediaError}
                                className="w-full h-full object-cover"
                            />

                            <button
                                onClick={toggleCamera}
                                className="absolute top-6 right-6 p-4 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-2xl hover:bg-white/30 transition-all z-10"
                                title="Inverter Câmera"
                            >
                                <RefreshCcw className="w-6 h-6" />
                            </button>
                        </>
                    ) : (
                        <div className="relative w-full h-full">
                            <img
                                src={capturedImage}
                                alt="Captured"
                                className="w-full h-full object-cover animate-in fade-in duration-300"
                                onError={() => setCapturedImage(null)}
                            />
                            {isOptimizing && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <RefreshCcw className="w-10 h-10 text-white animate-spin" />
                                        <p className="text-white font-bold text-sm uppercase tracking-widest">Otimizando Imagem...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!capturedImage && !permissionError && (
                        <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40">
                            <div className="w-full h-full border-2 border-dashed border-white/50 rounded-[2rem] scale-90"></div>
                        </div>
                    )}
                </div>

                <div className="p-8 flex justify-center gap-4">
                    {!capturedImage ? (
                        <button
                            onClick={capture}
                            disabled={permissionError || isOptimizing}
                            className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 active:scale-95 disabled:opacity-50"
                        >
                            <Camera className="w-6 h-6" /> Tirar Foto
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setCapturedImage(null)}
                                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                <FlipHorizontal className="w-5 h-5" /> Repetir
                            </button>
                            <button
                                onClick={() => {
                                    if (capturedImage && capturedImage.startsWith('data:image/')) {
                                        onCapture(capturedImage);
                                    } else {
                                        toast.error('Erro na captura', 'Erro na captura da imagem. Por favor, tente novamente.');
                                        setCapturedImage(null);
                                    }
                                }}
                                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 px-12"
                            >
                                <Check className="w-5 h-5" /> Usar Esta Foto
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

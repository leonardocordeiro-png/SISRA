import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, RefreshCcw, Check, ShieldCheck } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface CameraCaptureProps {
    onCapture: (image: string) => void;
    onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const webcamRef = useRef<Webcam>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [permissionError, setPermissionError] = useState(false);
    const toast = useToast();

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCapturedImage(imageSrc);
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
                        <p className="text-xs text-slate-500">Posicione o rosto dentro do quadro.</p>
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
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/png"
                            videoConstraints={{
                                facingMode: "user",
                                width: { ideal: 720 },
                                height: { ideal: 1280 }, // Increased height for better mobile portrait
                                aspectRatio: 0.5625 // 9:16 portrait
                            }}
                            onUserMediaError={handleUserMediaError}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img
                            src={capturedImage}
                            alt="Captured"
                            className="w-full h-full object-cover animate-in fade-in duration-300"
                            onError={() => setCapturedImage(null)}
                        />
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
                            disabled={permissionError}
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
                                <RefreshCcw className="w-5 h-5" /> Repetir
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

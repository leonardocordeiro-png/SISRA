import { useEffect, useRef, useState } from 'react';
import { Download, Printer, ScanLine, GraduationCap, Calendar, Smartphone, Loader2, AlertCircle } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import domtoimage from 'dom-to-image-more';
import NavigationControls from '../../components/NavigationControls';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin: gera o QR único da escola para auto-cadastro de responsáveis na
 * recepção. O QR aponta para /parent/autocadastro/:escolaId — o responsável
 * identifica o aluno por matrícula + data de nascimento e se cadastra sozinho.
 */
export default function AutoCadastroQR() {
    const toast = useToast();
    const { escolaId } = useAuth();
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);
    const [downloading, setDownloading] = useState(false);

    const registrationUrl = escolaId
        ? `${window.location.origin}/parent/autocadastro/${escolaId}`
        : '';

    useEffect(() => {
        if (!registrationUrl || !qrRef.current) return;

        // Render at high resolution (constrained via CSS) so the QR stays crisp
        // when the poster is scaled up for A3 printing.
        qrCode.current = new QRCodeStyling({
            width: 1000,
            height: 1000,
            data: registrationUrl,
            type: 'canvas',
            dotsOptions: { color: '#1F3057', type: 'rounded' },
            backgroundOptions: { color: '#ffffff' },
            cornersSquareOptions: { color: '#6B3D8F', type: 'extra-rounded' },
        });

        qrRef.current.innerHTML = '';
        qrCode.current.append(qrRef.current);
    }, [registrationUrl]);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(registrationUrl);
            toast.success('Link copiado', 'Cole onde quiser divulgar o auto-cadastro.');
        } catch {
            toast.error('Não foi possível copiar', registrationUrl);
        }
    };

    const handleDownload = async () => {
        const el = document.getElementById('autocadastro-poster');
        if (!el) return;
        setDownloading(true);
        try {
            // Export at 2x for a high-resolution, print-ready image.
            const scale = 2;
            const dataUrl = await domtoimage.toPng(el, {
                bgcolor: '#ffffff',
                width: el.offsetWidth * scale,
                height: el.offsetHeight * scale,
                style: { transform: `scale(${scale})`, transformOrigin: 'top left' },
                cacheBust: true,
            });
            const link = document.createElement('a');
            link.download = 'qr-autocadastro-responsaveis.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Sucesso', 'Pôster baixado!');
        } catch (err) {
            console.error('Error downloading poster:', err);
            toast.error('Erro ao baixar', 'Tente imprimir a tela.');
        } finally {
            setDownloading(false);
        }
    };

    if (!escolaId) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center max-w-md">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Escola não identificada</h2>
                    <p className="text-slate-500">Entre novamente para carregar o contexto da escola.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 min-h-screen text-slate-800 font-display">
            <style>
                {`
                /* High-res QR canvas shown at a fixed size on screen */
                #autocadastro-poster canvas { width: 300px !important; height: 300px !important; display: block; }

                @media print {
                    /* A3 sheet with no browser headers/footers (URL, date, page number) */
                    @page { size: A3; margin: 0; }
                    html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
                    body * { visibility: hidden !important; }
                    #autocadastro-poster, #autocadastro-poster * { visibility: visible !important; }
                    /* Center on the page and scale up uniformly for A3 */
                    #autocadastro-poster {
                        position: fixed !important;
                        top: 50% !important;
                        left: 50% !important;
                        transform: translate(-50%, -50%) scale(1.55) !important;
                        transform-origin: center center !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                }
                `}
            </style>
            <div className="max-w-3xl mx-auto px-6 py-8">
                <NavigationControls />

                <div className="mb-8 text-center md:text-left no-print">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">QR de Auto-cadastro de Responsáveis</h1>
                    <p className="text-slate-500 max-w-2xl">
                        Imprima e fixe este QR na recepção. O responsável escaneia, identifica o aluno pela
                        <strong> matrícula</strong> e <strong>data de nascimento</strong>, e cadastra seus próprios dados — sem precisar de link individual.
                    </p>
                </div>

                {/* Printable poster */}
                <div
                    id="autocadastro-poster"
                    className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden max-w-xl mx-auto"
                    style={{ backgroundColor: '#ffffff' }}
                >
                    <div className="bg-slate-900 px-10 py-8 text-center" style={{ backgroundColor: '#0f172a' }}>
                        <p className="text-xs font-black text-violet-300 uppercase tracking-[0.3em] mb-2" style={{ color: '#c4b5fd' }}>Cadastro de Responsável</p>
                        <h2 className="text-2xl font-black text-white italic tracking-tight">Escaneie para se cadastrar</h2>
                    </div>

                    <div className="p-10 flex flex-col items-center">
                        <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
                            <div ref={qrRef} />
                        </div>

                        <div className="mt-8 w-full space-y-4">
                            <Step icon={<ScanLine className="w-5 h-5" />} n={1} text="Escaneie este QR com a câmera do celular" />
                            <Step icon={<GraduationCap className="w-5 h-5" />} n={2} text="Informe a matrícula do aluno" />
                            <Step icon={<Calendar className="w-5 h-5" />} n={3} text="Confirme com a data de nascimento do aluno" />
                            <Step icon={<Smartphone className="w-5 h-5" />} n={4} text="Cadastre seus dados e receba seu cartão QR" />
                        </div>
                    </div>

                    <div className="bg-slate-100 px-10 py-5 text-center" style={{ backgroundColor: '#f1f5f9' }}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Sistema SISRA · Acesso Seguro</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center no-print">
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-sm text-slate-700 transition-all border border-slate-200 disabled:opacity-50"
                    >
                        {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Baixar Pôster
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-violet-600 hover:bg-violet-700 rounded-2xl font-bold text-sm text-white transition-all shadow-lg shadow-violet-500/20"
                    >
                        <Printer className="w-5 h-5" /> Imprimir
                    </button>
                    <button
                        onClick={handleCopyLink}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-slate-50 rounded-2xl font-bold text-sm text-slate-600 transition-all border border-slate-200"
                    >
                        Copiar Link
                    </button>
                </div>
            </div>
        </div>
    );
}

function Step({ icon, n, text }: { icon: React.ReactNode; n: number; text: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                {icon}
            </div>
            <p className="text-sm font-bold text-slate-700">
                <span className="text-violet-600" style={{ color: '#7c3aed' }}>{n}.</span> {text}
            </p>
        </div>
    );
}

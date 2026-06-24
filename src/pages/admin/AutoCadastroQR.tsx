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
    const [printing, setPrinting] = useState(false);
    // Quando definido, a impressão usa esta imagem (PNG limpo) em vez do DOM,
    // garantindo qualidade e centralização sem distorção/corte.
    const [printSrc, setPrintSrc] = useState<string | null>(null);

    const registrationUrl = escolaId
        ? `${window.location.origin}/parent/autocadastro/${escolaId}`
        : '';

    useEffect(() => {
        if (!registrationUrl || !qrRef.current) return;

        // O tamanho do canvas precisa BATER com o tamanho exibido. Forçar um
        // backing maior via CSS faz o dom-to-image-more inflar a largura do clone
        // (usa o tamanho do atributo do canvas), o que cortava o cabeçalho/rodapé
        // e fazia o QR sumir na captura. Renderiza no tamanho real exibido.
        qrCode.current = new QRCodeStyling({
            width: 360,
            height: 360,
            data: registrationUrl,
            type: 'canvas',
            dotsOptions: { color: '#1F3057', type: 'rounded' },
            backgroundOptions: { color: '#ffffff' },
            cornersSquareOptions: { color: '#6B3D8F', type: 'extra-rounded' },
        });

        qrRef.current.innerHTML = '';
        qrCode.current.append(qrRef.current);
    }, [registrationUrl]);

    // Dispara a impressão assim que a imagem do pôster estiver pronta no DOM.
    useEffect(() => {
        if (!printSrc) return;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (cancelled) return;
            window.print();
            setPrintSrc(null);
            setPrinting(false);
        };
        img.onerror = () => {
            if (cancelled) return;
            setPrintSrc(null);
            setPrinting(false);
            toast.error('Erro ao preparar impressão', 'Tente novamente.');
        };
        img.src = printSrc;
        return () => { cancelled = true; };
    }, [printSrc]);

    /**
     * Captura o pôster como PNG de alta resolução usando a mesma técnica do
     * cartão QR (/admin/cartoes-qr): zera bordas/contornos/sombras durante a
     * captura para o domtoimage não inserir artefatos, e exporta em 2x.
     */
    const capturePosterPng = async (): Promise<string> => {
        const el = document.getElementById('autocadastro-poster');
        if (!el) throw new Error('Pôster não encontrado.');

        // Tailwind v4 preflight sets `border-style: solid` on every element (with
        // width 0, invisible in the browser). dom-to-image-more honors the solid
        // style and draws a currentColor hairline around each element — the black
        // boxes. Force `border: none` (kills the style, not just the color),
        // outline none and shadows off on every element during capture.
        const captureStyle = document.createElement('style');
        captureStyle.id = 'poster-capture-override';
        captureStyle.innerHTML = `
            /* Largura fixa e folgada durante a captura: o título em text-2xl
               transborda levemente a caixa de 576px e o dom-to-image-more renderiza
               o texto um pouco mais largo que a tela, cortando a faixa da direita.
               Com 640px tudo cabe e fica centralizado. */
            #autocadastro-poster {
                width: 640px !important;
                max-width: 640px !important;
            }
            #autocadastro-poster,
            #autocadastro-poster *,
            #autocadastro-poster *::before,
            #autocadastro-poster *::after {
                border: 0 none transparent !important;
                border-image: none !important;
                outline: 0 none transparent !important;
                box-shadow: none !important;
                text-shadow: none !important;
            }
        `;
        document.head.appendChild(captureStyle);

        const allElements = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[];
        const savedStyles = allElements.map(node => node.getAttribute('style'));
        allElements.forEach(node => {
            node.style.setProperty('border', 'none', 'important');
            node.style.setProperty('outline', 'none', 'important');
            node.style.setProperty('box-shadow', 'none', 'important');
            node.style.setProperty('text-shadow', 'none', 'important');
        });

        await new Promise(resolve => setTimeout(resolve, 250));

        try {
            // Capture at natural size (same as the /admin/cartoes-qr card). A scale
            // transform here misaligns the full-width header/footer backgrounds.
            // The QR is rendered at high resolution and the print layer fits it to
            // the A3 sheet, so quality stays good.
            return await domtoimage.toPng(el, {
                bgcolor: '#ffffff',
                width: el.offsetWidth,
                height: el.offsetHeight,
                cacheBust: true,
            });
        } finally {
            captureStyle.remove();
            allElements.forEach((node, i) => {
                if (savedStyles[i] !== null) node.setAttribute('style', savedStyles[i]!);
                else node.removeAttribute('style');
            });
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(registrationUrl);
            toast.success('Link copiado', 'Cole onde quiser divulgar o auto-cadastro.');
        } catch {
            toast.error('Não foi possível copiar', registrationUrl);
        }
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const dataUrl = await capturePosterPng();
            const link = document.createElement('a');
            link.download = 'qr-autocadastro-responsaveis.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Sucesso', 'Pôster baixado!');
        } catch (err) {
            console.error('Error downloading poster:', err);
            document.getElementById('poster-capture-override')?.remove();
            toast.error('Erro ao baixar', 'Tente novamente.');
        } finally {
            setDownloading(false);
        }
    };

    const handlePrint = async () => {
        setPrinting(true);
        try {
            const dataUrl = await capturePosterPng();
            setPrintSrc(dataUrl); // o useEffect dispara window.print()
        } catch (err) {
            console.error('Error preparing print:', err);
            document.getElementById('poster-capture-override')?.remove();
            setPrinting(false);
            toast.error('Erro ao imprimir', 'Tente novamente.');
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
                #autocadastro-poster canvas { display: block; }

                /* Camada de impressão baseada em imagem (oculta na tela) */
                #poster-print-layer { display: none; }

                @media print {
                    /* Folha A3 sem cabeçalhos/rodapés do navegador (URL, data, nº da página) */
                    @page { size: A3; margin: 0; }
                    html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
                    body * { visibility: hidden !important; }
                    #poster-print-layer, #poster-print-layer * { visibility: visible !important; }
                    /* Imagem centralizada que se ajusta à folha sem cortar nem distorcer */
                    #poster-print-layer {
                        display: flex !important;
                        position: fixed !important;
                        inset: 0 !important;
                        align-items: center;
                        justify-content: center;
                        padding: 12mm;
                        background: #ffffff;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    #poster-print-layer img {
                        max-width: 100%;
                        max-height: 100%;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                    }
                    .no-print { display: none !important; }
                }
                `}
            </style>

            {/* Camada usada apenas na impressão */}
            {printSrc && (
                <div id="poster-print-layer">
                    <img src={printSrc} alt="Pôster de auto-cadastro" />
                </div>
            )}

            <div className="max-w-3xl mx-auto px-6 py-8">
                <NavigationControls />

                <div className="mb-8 text-center md:text-left no-print">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">QR de Auto-cadastro de Responsáveis</h1>
                    <p className="text-slate-500 max-w-2xl">
                        Imprima e fixe este QR na recepção. O responsável escaneia, identifica o aluno pela
                        <strong> matrícula</strong> e <strong>data de nascimento</strong>, e cadastra seus próprios dados — sem precisar de link individual.
                    </p>
                </div>

                {/* Pôster (capturado para PNG na impressão/download) */}
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

                {/* Ações */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center no-print">
                    <button
                        onClick={handleDownload}
                        disabled={downloading || printing}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-sm text-slate-700 transition-all border border-slate-200 disabled:opacity-50"
                    >
                        {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Baixar Pôster (PNG)
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={printing || downloading}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-violet-600 hover:bg-violet-700 rounded-2xl font-bold text-sm text-white transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
                    >
                        {printing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />} Imprimir (A3)
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

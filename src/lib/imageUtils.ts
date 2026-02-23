/**
 * Converte um arquivo de imagem para uma data URL válida.
 * Suporta HEIC/HEIF (iPhone) com conversão automática para JPEG.
 * 
 * Estratégia de conversão HEIC (3 camadas):
 * 1. createImageBitmap → Canvas (usa decodificador nativo do SO)
 * 2. libheif-js com HEVC decoder (libde265) via WASM
 * 3. Mensagem amigável pedindo JPEG/PNG
 */
export async function fileToDataUrl(file: File): Promise<string> {
    const name = file.name.toLowerCase();
    const isHeic = name.endsWith('.heic') || name.endsWith('.heif') ||
        file.type === 'image/heic' || file.type === 'image/heif';
    const hasNoMime = !file.type || file.type === 'application/octet-stream';
    const needsConversion = isHeic || hasNoMime;

    if (needsConversion) {
        console.log('[imageUtils] Arquivo precisa de conversão. Nome:', file.name, 'Tipo:', file.type || '(vazio)', 'Tamanho:', file.size);

        // ═══ CAMADA 1: Decodificador nativo do navegador/SO ═══
        try {
            console.log('[imageUtils] Tentando createImageBitmap (decodificador nativo)...');
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(bitmap, 0, 0);
                bitmap.close();
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                console.log('[imageUtils] ✅ Conversão via createImageBitmap OK! Dimensões:', canvas.width, 'x', canvas.height);
                return dataUrl;
            }
            bitmap.close();
        } catch (err: any) {
            console.warn('[imageUtils] createImageBitmap falhou:', err?.message || err);
        }

        // ═══ CAMADA 2: libheif-js com HEVC decoder (libde265) ═══
        try {
            console.log('[imageUtils] Tentando libheif-js (WASM com HEVC decoder)...');
            const buffer = await file.arrayBuffer();
            const dataUrl = await decodeHeicWithLibheif(new Uint8Array(buffer));
            console.log('[imageUtils] ✅ Conversão via libheif-js OK!');
            return dataUrl;
        } catch (err: any) {
            console.error('[imageUtils] libheif-js falhou:', err?.message || err);
        }

        // ═══ CAMADA 3: Verificar se é realmente HEIC ═══
        if (isHeic || await detectHeicSignature(file)) {
            throw new Error(
                'HEIC_NOT_SUPPORTED: Não foi possível converter o arquivo HEIC. ' +
                'Por favor, salve a foto como JPEG ou PNG antes de enviar.\n\n' +
                'No iPhone: Ajustes → Câmera → Formatos → Mais Compatível'
            );
        }

        console.log('[imageUtils] Arquivo sem MIME type mas não é HEIC, carregando direto...');
    }

    return readFileAsDataUrl(file);
}

/**
 * Decodifica um arquivo HEIC usando libheif-js com o decoder HEVC (libde265).
 * Usa o wasm-bundle que inclui o decoder HEVC embutido.
 */
async function decodeHeicWithLibheif(heicData: Uint8Array): Promise<string> {
    // Import dinâmico do wasm-bundle que inclui o HEVC decoder (libde265)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const libheifModule = await import('libheif-js/wasm-bundle') as any;
    const libheif = libheifModule.default || libheifModule;

    console.log('[imageUtils] libheif carregado. Tipo:', typeof libheif, 'HeifDecoder:', typeof libheif.HeifDecoder);

    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(heicData.buffer);

    if (!images || images.length === 0) {
        throw new Error('Nenhuma imagem encontrada no arquivo HEIC');
    }

    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();

    console.log('[imageUtils] HEIC decodificado. Dimensões:', width, 'x', height);

    // Criar canvas e ImageData para renderizar
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Não foi possível criar contexto canvas');
    }

    const imageData = ctx.createImageData(width, height);

    // Renderizar a imagem HEIC no ImageData via callback
    await new Promise<void>((resolve, reject) => {
        image.display(imageData, (displayData: ImageData | null) => {
            if (!displayData) {
                reject(new Error('Falha ao renderizar imagem HEIC'));
                return;
            }
            resolve();
        });
    });

    // Colocar o ImageData no canvas e exportar como JPEG
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    console.log('[imageUtils] JPEG gerado via canvas. DataURL length:', dataUrl.length);
    return dataUrl;
}

/**
 * Detecta se um arquivo é HEIC pela assinatura binária (magic bytes).
 */
async function detectHeicSignature(file: File): Promise<boolean> {
    try {
        const buffer = await file.slice(0, 24).arrayBuffer();
        const view = new Uint8Array(buffer);
        const text = String.fromCharCode(...view);
        return /ftyp(heic|heix|hevc|mif1|msf1)/i.test(text);
    } catch {
        return false;
    }
}

/**
 * Lê um File como data URL.
 */
function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            if (result) {
                console.log('[imageUtils] ✅ Data URL gerada, length:', result.length, 'prefix:', result.substring(0, 40));
                resolve(result);
            } else {
                reject(new Error('FileReader não produziu resultado'));
            }
        };
        reader.onerror = () => reject(reader.error || new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
    });
}

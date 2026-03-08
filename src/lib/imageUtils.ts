/**
 * Comprime e redimensiona uma imagem (Base64) usando Canvas.
 * Garante que a imagem final seja um JPEG leve.
 */
export function compressAndResizeImage(base64Str: string, maxWidth = 1024, quality = 0.8): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Redimensionamento proporcional
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxWidth) {
                    width *= maxWidth / height;
                    height = maxWidth;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                // Exporta como JPEG com a qualidade definida
                resolve(canvas.toDataURL('image/jpeg', quality));
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(base64Str);
        img.src = base64Str;
    });
}

/**
 * Converte um arquivo de imagem para uma data URL válida.
 * Suporta HEIC/HEIF (iPhone) com conversão automática para JPEG e compressão de saída.
 */
export async function fileToDataUrl(file: File): Promise<string> {
    const name = file.name.toLowerCase();
    const isHeic = name.endsWith('.heic') || name.endsWith('.heif') ||
        file.type === 'image/heic' || file.type === 'image/heif';
    const hasNoMime = !file.type || file.type === 'application/octet-stream';
    const needsConversion = isHeic || hasNoMime;

    let resultDataUrl: string;

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
                resultDataUrl = canvas.toDataURL('image/jpeg', 0.95);
                console.log('[imageUtils] ✅ Conversão via createImageBitmap OK!');
                return compressAndResizeImage(resultDataUrl);
            }
            bitmap.close();
        } catch (err: any) {
            console.warn('[imageUtils] createImageBitmap falhou:', err?.message || err);
        }

        // ═══ CAMADA 2: libheif-js com HEVC decoder (libde265) ═══
        try {
            console.log('[imageUtils] Tentando libheif-js (WASM com HEVC decoder)...');
            const buffer = await file.arrayBuffer();
            resultDataUrl = await decodeHeicWithLibheif(new Uint8Array(buffer));
            console.log('[imageUtils] ✅ Conversão via libheif-js OK!');
            return compressAndResizeImage(resultDataUrl);
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

    // Leitura padrão para arquivos que não são HEIC ou se as tentativas acima falharam
    const rawDataUrl = await readFileAsDataUrl(file);
    // Sempre aplicar compressão/redimensionamento para garantir payload leve
    return compressAndResizeImage(rawDataUrl);
}

/**
 * Decodifica um arquivo HEIC usando libheif-js com o decoder HEVC (libde265).
 */
async function decodeHeicWithLibheif(heicData: Uint8Array): Promise<string> {
    const libheifModule = await import('libheif-js/wasm-bundle') as any;
    const libheif = libheifModule.default || libheifModule;

    const decoder = new libheif.HeifDecoder();
    const images = decoder.decode(heicData.buffer);

    if (!images || images.length === 0) {
        throw new Error('Nenhuma imagem encontrada no arquivo HEIC');
    }

    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Não foi possível criar contexto canvas');
    }

    const imageData = ctx.createImageData(width, height);

    await new Promise<void>((resolve, reject) => {
        image.display(imageData, (displayData: ImageData | null) => {
            if (!displayData) {
                reject(new Error('Falha ao renderizar imagem HEIC'));
                return;
            }
            resolve();
        });
    });

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
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
                resolve(result);
            } else {
                reject(new Error('FileReader não produziu resultado'));
            }
        };
        reader.onerror = () => reject(reader.error || new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
    });
}

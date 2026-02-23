declare module 'libheif-js/wasm-bundle' {
    interface HeifImage {
        get_width(): number;
        get_height(): number;
        display(imageData: ImageData, callback: (data: ImageData | null) => void): void;
    }

    interface HeifDecoderInstance {
        decode(buffer: ArrayBuffer): HeifImage[];
    }

    interface HeifDecoderConstructor {
        new(): HeifDecoderInstance;
    }

    interface LibHeif {
        HeifDecoder: HeifDecoderConstructor;
    }

    const libheif: LibHeif;
    export default libheif;
}

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';

type PhotoZoomState = { url: string; label?: string } | null;

const PhotoZoomContext = createContext<{
    openPhoto: (url: string, label?: string) => void;
}>({ openPhoto: () => {} });

export function usePhotoZoom() {
    return useContext(PhotoZoomContext);
}

export function PhotoZoomProvider({ children }: { children: React.ReactNode }) {
    const [photo, setPhoto] = useState<PhotoZoomState>(null);

    const openPhoto = useCallback((url: string, label?: string) => {
        if (url) setPhoto({ url, label });
    }, []);

    useEffect(() => {
        if (!photo) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPhoto(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [photo]);

    return (
        <PhotoZoomContext.Provider value={{ openPhoto }}>
            {children}

            {photo && (
                <div
                    onClick={() => setPhoto(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.92)',
                        backdropFilter: 'blur(14px)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '24px',
                        animation: 'fadeIn 0.2s ease',
                    }}
                >
                    <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>

                    {/* Close button */}
                    <button
                        onClick={() => setPhoto(null)}
                        style={{
                            position: 'absolute', top: 16, right: 16,
                            width: 44, height: 44, borderRadius: 12,
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <X size={20} />
                    </button>

                    {/* Photo */}
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: 'min(90vw, 560px)',
                            maxHeight: 'min(80dvh, 560px)',
                            borderRadius: 20,
                            overflow: 'hidden',
                            boxShadow: '0 30px 80px rgba(0,0,0,0.8)',
                            border: '3px solid rgba(255,255,255,0.12)',
                        }}
                    >
                        <img
                            src={photo.url}
                            alt={photo.label || 'Foto'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    </div>

                    {/* Label */}
                    {photo.label && (
                        <p style={{
                            marginTop: 16, fontSize: 14, fontWeight: 600,
                            color: 'rgba(255,255,255,0.7)', textAlign: 'center',
                            fontFamily: 'system-ui, sans-serif', letterSpacing: '0.02em',
                        }}>
                            {photo.label}
                        </p>
                    )}

                    <p style={{
                        marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)',
                        fontFamily: 'system-ui, sans-serif',
                    }}>
                        Clique fora ou pressione Esc para fechar
                    </p>
                </div>
            )}
        </PhotoZoomContext.Provider>
    );
}

/** Wrapper para qualquer <img> que deve ser clicável para ampliar */
export function ZoomablePhoto({
    src, alt, className, style, fallback,
}: {
    src: string | null | undefined;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    fallback?: React.ReactNode;
}) {
    const { openPhoto } = usePhotoZoom();
    if (!src) return <>{fallback ?? null}</>;
    return (
        <div style={{ position: 'relative', display: 'inline-block', cursor: 'zoom-in' }}
             title="Clique para ampliar">
            <img
                src={src}
                alt={alt}
                className={className}
                style={style}
                onClick={() => openPhoto(src, alt)}
            />
            <div style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 20, height: 20, borderRadius: 6,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s',
                pointerEvents: 'none',
            }} className="zoom-hint">
                <ZoomIn size={12} color="#fff" />
            </div>
            <style>{`
                div:hover > .zoom-hint { opacity: 1 !important; }
            `}</style>
        </div>
    );
}

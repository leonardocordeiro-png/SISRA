import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

const backButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 22px',
    background: '#104699',
    border: '1.5px solid #0b3475',
    borderRadius: 14,
    color: '#ffffff',
    fontWeight: 900,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(16,70,153,0.28)',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
};

const homeButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 22px',
    background: '#fbd12d',
    border: '1.5px solid #c79e18',
    borderRadius: 14,
    color: '#1f2937',
    fontWeight: 900,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(199,158,24,0.22)',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
};

function resetButtonState(element: HTMLButtonElement, style: CSSProperties) {
    element.style.background = String(style.background);
    element.style.transform = 'translateY(0)';
    element.style.boxShadow = String(style.boxShadow);
}

export default function NavigationControls() {
    const navigate = useNavigate();

    return (
        <div className="flex items-center gap-3 mb-10 no-print animate-in fade-in slide-in-from-left-4 duration-700">
            <button
                onClick={() => navigate(-1)}
                style={backButtonStyle}
                onMouseEnter={e => {
                    e.currentTarget.style.background = '#0b3475';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(16,70,153,0.36)';
                }}
                onMouseLeave={e => resetButtonState(e.currentTarget, backButtonStyle)}
                onFocus={e => {
                    e.currentTarget.style.outline = '3px solid rgba(16,70,153,0.28)';
                    e.currentTarget.style.outlineOffset = '3px';
                }}
                onBlur={e => {
                    e.currentTarget.style.outline = 'none';
                }}
                title="Voltar para a pagina anterior"
            >
                <ArrowLeft size={15} strokeWidth={2.4} />
                <span>Voltar</span>
            </button>

            <button
                onClick={() => navigate('/')}
                style={homeButtonStyle}
                onMouseEnter={e => {
                    e.currentTarget.style.background = '#eab308';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(199,158,24,0.32)';
                }}
                onMouseLeave={e => resetButtonState(e.currentTarget, homeButtonStyle)}
                onFocus={e => {
                    e.currentTarget.style.outline = '3px solid rgba(199,158,24,0.32)';
                    e.currentTarget.style.outlineOffset = '3px';
                }}
                onBlur={e => {
                    e.currentTarget.style.outline = 'none';
                }}
                title="Ir para a selecao de modulos"
            >
                <Home size={15} strokeWidth={2.4} />
                <span>Inicio</span>
            </button>
        </div>
    );
}

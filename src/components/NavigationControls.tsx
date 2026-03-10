import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NavigationControls() {
    const navigate = useNavigate();

    return (
        <div className="flex items-center gap-3 mb-10 no-print animate-in fade-in slide-in-from-left-4 duration-700">
            <button
                onClick={() => navigate(-1)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px',
                    background: 'rgba(16,70,153,0.25)',
                    border: '1.5px solid rgba(16,70,153,0.7)',
                    borderRadius: 14,
                    color: '#a8c4f0',
                    fontWeight: 900,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 16px rgba(16,70,153,0.25)',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,70,153,0.55)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#104699';
                    (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(16,70,153,0.45)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,70,153,0.25)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,70,153,0.7)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#a8c4f0';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(16,70,153,0.25)';
                }}
                title="Voltar para a página anterior"
            >
                <ArrowLeft size={15} />
                <span>Voltar</span>
            </button>

            <button
                onClick={() => navigate('/')}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px',
                    background: 'rgba(251,209,45,0.12)',
                    border: '1.5px solid rgba(251,209,45,0.55)',
                    borderRadius: 14,
                    color: '#f0d870',
                    fontWeight: 900,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 16px rgba(251,209,45,0.12)',
                    transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,209,45,0.28)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#fbd12d';
                    (e.currentTarget as HTMLButtonElement).style.color = '#fbd12d';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(251,209,45,0.25)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,209,45,0.12)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(251,209,45,0.55)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#f0d870';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(251,209,45,0.12)';
                }}
                title="Ir para a seleção de módulos"
            >
                <Home size={15} />
                <span>Início</span>
            </button>
        </div>
    );
}

import { Delete, CornerDownLeft, Space } from 'lucide-react';

interface TotemKeyboardProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
    maxLength?: number;
}

const ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export default function TotemKeyboard({ value, onChange, onSubmit, maxLength = 40 }: TotemKeyboardProps) {
    const press = (char: string) => {
        if (value.length < maxLength) onChange(value + char);
    };
    const backspace = () => onChange(value.slice(0, -1));
    const space = () => {
        if (value.length < maxLength && value.length > 0 && value[value.length - 1] !== ' ') onChange(value + ' ');
    };

    const keyBase = 'flex items-center justify-center rounded-2xl font-black text-xl text-white select-none transition-all duration-150 active:scale-95 active:brightness-75 cursor-pointer';

    return (
        <div className="flex flex-col gap-2 w-full select-none">
            {ROWS.map((row, ri) => (
                <div key={ri} className="flex gap-2 justify-center">
                    {row.map(key => (
                        <button
                            key={key}
                            onPointerDown={e => { e.preventDefault(); press(key); }}
                            className={`${keyBase} w-[84px] h-[72px] bg-white/[0.08] border border-white/10 hover:bg-white/[0.15] shadow-md`}
                        >
                            {key}
                        </button>
                    ))}
                    {ri === 2 && (
                        <button
                            onPointerDown={e => { e.preventDefault(); backspace(); }}
                            className={`${keyBase} w-[120px] h-[72px] bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400`}
                        >
                            <Delete className="w-7 h-7" />
                        </button>
                    )}
                </div>
            ))}

            {/* Bottom row */}
            <div className="flex gap-2 justify-center">
                <button
                    onPointerDown={e => { e.preventDefault(); space(); }}
                    className={`${keyBase} flex-1 max-w-[480px] h-[72px] bg-white/[0.08] border border-white/10 hover:bg-white/[0.15]`}
                >
                    <Space className="w-6 h-6 mr-2 opacity-60" />
                    <span className="text-base font-bold text-white/50 uppercase tracking-widest">Espaço</span>
                </button>
                {onSubmit && (
                    <button
                        onPointerDown={e => { e.preventDefault(); onSubmit(); }}
                        disabled={value.trim().length < 3}
                        className={`${keyBase} w-[160px] h-[72px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950`}
                    >
                        <CornerDownLeft className="w-7 h-7" />
                    </button>
                )}
            </div>
        </div>
    );
}

import { Delete, CornerDownLeft } from 'lucide-react';

interface TotemNumPadProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
    maxLength?: number;
}

// Rows: letters A-Z grouped by 6, then numbers
const LETTER_ROWS = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    ['I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'],
    ['Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
];

export default function TotemNumPad({ value, onChange, onSubmit, maxLength = 8 }: TotemNumPadProps) {
    const press = (char: string) => {
        if (value.length < maxLength) onChange((value + char).toUpperCase());
    };
    const backspace = () => onChange(value.slice(0, -1));

    const keyBase = 'flex items-center justify-center rounded-2xl font-black text-xl text-white select-none transition-all duration-150 active:scale-95 active:brightness-75 cursor-pointer';

    return (
        <div className="flex flex-col gap-2.5 w-full select-none">
            {LETTER_ROWS.map((row, ri) => (
                <div key={ri} className="flex gap-2 justify-center">
                    {row.map(key => (
                        <button
                            key={key}
                            onPointerDown={e => { e.preventDefault(); press(key); }}
                            className={`${keyBase} w-[72px] h-[64px] ${ri === 3
                                ? 'bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 text-violet-300'
                                : 'bg-white/[0.08] border border-white/10 hover:bg-white/[0.15]'
                                } shadow-md`}
                        >
                            {key}
                        </button>
                    ))}
                    {ri === LETTER_ROWS.length - 1 && (
                        <>
                            <button
                                onPointerDown={e => { e.preventDefault(); backspace(); }}
                                className={`${keyBase} w-[72px] h-[64px] bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400`}
                            >
                                <Delete className="w-6 h-6" />
                            </button>
                            {onSubmit && (
                                <button
                                    onPointerDown={e => { e.preventDefault(); onSubmit(); }}
                                    disabled={value.length < 4}
                                    className={`${keyBase} w-[72px] h-[64px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950`}
                                >
                                    <CornerDownLeft className="w-6 h-6" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

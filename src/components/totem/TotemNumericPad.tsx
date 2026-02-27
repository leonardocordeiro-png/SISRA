import { Delete, CornerDownLeft } from 'lucide-react';

interface TotemNumericPadProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
    maxLength?: number;
}

const NUMBERS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['0'],
];

export default function TotemNumericPad({ value, onChange, onSubmit, maxLength = 11 }: TotemNumericPadProps) {
    const press = (char: string) => {
        if (value.length < maxLength) onChange(value + char);
    };
    const backspace = () => onChange(value.slice(0, -1));

    const keyBase = 'flex items-center justify-center rounded-2xl font-black text-2xl text-white select-none transition-all duration-150 active:scale-95 active:brightness-75 cursor-pointer';

    return (
        <div className="flex flex-col gap-3 w-full max-w-[400px] mx-auto select-none">
            {NUMBERS.map((row, ri) => (
                <div key={ri} className="flex gap-3 justify-center">
                    {row.map(key => (
                        <button
                            key={key}
                            onPointerDown={e => { e.preventDefault(); press(key); }}
                            className={`${keyBase} w-[100px] h-[80px] bg-white/[0.08] border border-white/10 hover:bg-white/[0.15] shadow-md`}
                        >
                            {key}
                        </button>
                    ))}
                    {ri === 3 && (
                        <>
                            <button
                                onPointerDown={e => { e.preventDefault(); backspace(); }}
                                className={`${keyBase} w-[100px] h-[80px] bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400`}
                            >
                                <Delete className="w-8 h-8" />
                            </button>
                            {onSubmit && (
                                <button
                                    onPointerDown={e => { e.preventDefault(); onSubmit(); }}
                                    disabled={value.length < 1}
                                    className={`${keyBase} w-[100px] h-[80px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950`}
                                >
                                    <CornerDownLeft className="w-8 h-8" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

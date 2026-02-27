import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInactivityTimer } from '../../components/totem/InactivityTimer';
import TotemNumPad from '../../components/totem/TotemNumPad';
import type { Student } from '../../types';

export default function TotemCodeEntry() {
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useInactivityTimer({ timeoutMs: 45000, redirectTo: '/totem' });

    const handleSubmit = async () => {
        if (code.length < 4) return;
        setLoading(true);
        setError(null);

        try {
            // Look up guardian by access code
            const { data: resp, error: err } = await supabase
                .from('responsaveis')
                .select('id, nome_completo, foto_url')
                .eq('codigo_acesso', code.toUpperCase())
                .maybeSingle();

            if (err || !resp) {
                setError('Código não encontrado. Verifique e tente novamente.');
                setLoading(false);
                return;
            }

            // Get authorized students
            const { data: auths } = await supabase
                .from('autorizacoes')
                .select('alunos:aluno_id (*)')
                .eq('responsavel_id', resp.id)
                .eq('ativa', true);

            const students: Student[] = (auths || [])
                .map((a: any) => Array.isArray(a.alunos) ? a.alunos[0] : a.alunos)
                .filter((s: any): s is Student => s !== null);

            if (students.length === 0) {
                setError('Nenhum aluno vinculado a este código.');
                setLoading(false);
                return;
            }

            navigate('/totem/confirmacao', {
                state: {
                    students,
                    guardian: { id: resp.id, nome_completo: resp.nome_completo, foto_url: resp.foto_url },
                    mode: 'code',
                }
            });
        } catch {
            setError('Erro de comunicação. Tente novamente.');
            setLoading(false);
        }
    };

    const codeChars = code.toUpperCase().padEnd(8, '·').split('');

    return (
        <div className="w-screen h-screen bg-[#020617] text-white overflow-hidden relative flex flex-col">
            {/* Ambient */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[70%] bg-violet-500/[0.05] blur-[140px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-white/5">
                <button
                    onClick={() => navigate('/totem/identificar')}
                    className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all active:scale-95 text-slate-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Voltar</span>
                </button>
                <div className="text-center">
                    <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                        <div className="w-1.5 h-7 bg-violet-500 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.6)]" />
                        Código de Acesso
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        Código impresso no cartão QR do responsável
                    </p>
                </div>
                <div className="w-32" />
            </div>

            {/* Main: LEFT instructions + display | RIGHT keyboard */}
            <div className="relative z-10 flex-1 flex flex-row gap-0 overflow-hidden">

                {/* Left: instructions + code display */}
                {/* Left: instructions + code display */}
                <div className="flex flex-col w-[350px] flex-shrink-0 px-6 py-10 border-r border-white/5 gap-8 justify-center">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="absolute -inset-6 bg-violet-500/10 blur-2xl rounded-full animate-pulse" />
                            <div className="relative w-24 h-24 bg-violet-500/10 border-2 border-violet-500/30 rounded-[2rem] flex items-center justify-center shadow-2xl">
                                <Hash className="w-12 h-12 text-violet-400" />
                            </div>
                        </div>
                    </div>

                    {/* Instruction */}
                    <div className="text-center space-y-3">
                        <h2 className="text-2xl font-black italic text-white uppercase tracking-tight">
                            Digite seu código
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Seu código único é encontrado no cartão QR impresso que foi gerado no aplicativo.
                            Ele é composto por letras e números.
                        </p>
                    </div>

                    {/* Code display */}
                    <div className="flex gap-2 justify-center">
                        {codeChars.map((char, i) => (
                            <div
                                key={i}
                                className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all duration-200 
                                    ${i < code.length
                                        ? 'bg-violet-500/20 border-violet-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]'
                                        : 'bg-white/[0.04] border-white/10 text-white/20'
                                    }`}
                            >
                                {char}
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-3 px-5 py-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-bold">{error}</p>
                        </div>
                    )}

                    {/* Submit button */}
                    <button
                        onClick={handleSubmit}
                        disabled={code.length < 4 || loading}
                        className="w-full py-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_30px_rgba(124,58,237,0.3)] flex items-center justify-center gap-3"
                    >
                        {loading
                            ? <><Loader2 className="w-6 h-6 animate-spin" /> Verificando...</>
                            : 'Confirmar Código →'
                        }
                    </button>
                </div>

                {/* Right: numpad keyboard */}
                <div className="flex-1 flex flex-col items-center justify-center px-10 py-8">
                    <p className="text-slate-600 text-xs font-black uppercase tracking-widest mb-6">
                        Teclado Virtual — Toque nas teclas
                    </p>
                    <TotemNumPad
                        value={code}
                        onChange={v => { setCode(v); setError(null); }}
                        onSubmit={handleSubmit}
                        maxLength={8}
                    />
                </div>
            </div>
        </div>
    );
}

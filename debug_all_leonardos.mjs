import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
    'https://dfwlsrmdedbtfqtsbovc.supabase.co',
    'sb_publishable_sviojNcP8mZX_8MU71L23A_nxL5D4Jn'
);

async function debug() {
    const lines = [];
    const log = (...args) => {
        const line = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ');
        lines.push(line);
        console.log(line);
    };

    log('=== SEARCHING FOR ALL GUARDIANS NAMED LEONARDO ===');
    const { data: guardians } = await supabase
        .from('responsaveis')
        .select('*')
        .ilike('nome_completo', '%Leonardo%');

    log(JSON.stringify(guardians, null, 2));

    if (guardians && guardians.length > 0) {
        for (const g of guardians) {
            log(`\n--- Students linked to ${g.nome_completo} (ID: ${g.id}, CPF: ${g.cpf}) ---`);
            const { data: ar } = await supabase
                .from('alunos_responsaveis')
                .select('aluno_id, alunos(nome_completo)')
                .eq('responsavel_id', g.id);
            log('AR:', JSON.stringify(ar, null, 2));

            const { data: au } = await supabase
                .from('autorizacoes')
                .select('aluno_id, alunos(nome_completo)')
                .eq('responsavel_id', g.id);
            log('AUTH:', JSON.stringify(au, null, 2));
        }
    }

    fs.writeFileSync('debug_all_leonardos.txt', lines.join('\n'));
}

debug();

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

    log('=== ANDRÉA DETAILS ===');
    const { data: andrea } = await supabase.from('responsaveis').select('*').ilike('nome_completo', '%Andréa%');
    log(andrea);

    if (andrea?.length > 0) {
        for (const a of andrea) {
            log(`\nLinks for ${a.nome_completo} (ID: ${a.id}):`);
            const { data: ar } = await supabase.from('alunos_responsaveis').select('alunos(nome_completo)').eq('responsavel_id', a.id);
            ar?.forEach(l => log(`- AR: ${l.alunos?.nome_completo}`));

            const { data: au } = await supabase.from('autorizacoes').select('alunos(nome_completo)').eq('responsavel_id', a.id);
            au?.forEach(l => log(`- AU: ${l.alunos?.nome_completo}`));
        }
    }

    fs.writeFileSync('debug_andrea.txt', lines.join('\n'));
}

debug();

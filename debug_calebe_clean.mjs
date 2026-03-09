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

    const calebeId = '249fcc3c-ab8b-448e-a594-7cbaec7aa157';

    log('=== CALEBE GUARDIANS (alunos_responsaveis) ===');
    const { data: ar } = await supabase
        .from('alunos_responsaveis')
        .select(`
            responsavel_id,
            responsaveis (
                id,
                nome_completo,
                cpf
            )
        `)
        .eq('aluno_id', calebeId);

    log(JSON.stringify(ar, null, 2));

    log('\n=== CALEBE AUTHORIZATIONS (autorizacoes) ===');
    const { data: au } = await supabase
        .from('autorizacoes')
        .select(`
            responsavel_id,
            responsaveis (
                id,
                nome_completo,
                cpf
            )
        `)
        .eq('aluno_id', calebeId);

    log(JSON.stringify(au, null, 2));

    fs.writeFileSync('debug_calebe_links_clean.txt', lines.join('\n'));
}

debug();

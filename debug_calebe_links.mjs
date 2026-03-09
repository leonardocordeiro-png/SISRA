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

    log('=== ALL AUTHORIZATIONS FOR CALEBE ===');
    const { data: auths } = await supabase
        .from('autorizacoes')
        .select('*, responsaveis(*)')
        .eq('aluno_id', calebeId);

    log(auths);

    log('\n=== ALL LINKS IN alunos_responsaveis FOR CALEBE ===');
    const { data: ar } = await supabase
        .from('alunos_responsaveis')
        .select('*, responsaveis(*)')
        .eq('aluno_id', calebeId);

    log(ar);

    fs.writeFileSync('debug_calebe_final.txt', lines.join('\n'));
}

debug();

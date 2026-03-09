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

    const aliceId = '2f6a1190-f3ca-4731-8e7e-1232cd0414bb';
    const calebeId = '249fcc3c-ab8b-448e-a594-7cbaec7aa157';

    log('=== ALICE LINKS ===');
    const { data: aliceJ } = await supabase.from('alunos_responsaveis').select('responsaveis(*)').eq('aluno_id', aliceId);
    aliceJ?.forEach(r => log(`- AR: ${r.responsaveis.nome_completo} | CPF: ${r.responsaveis.cpf}`));

    const { data: aliceA } = await supabase.from('autorizacoes').select('responsaveis(*)').eq('aluno_id', aliceId);
    aliceA?.forEach(r => log(`- AU: ${r.responsaveis.nome_completo} | CPF: ${r.responsaveis.cpf}`));

    log('\n=== CALEBE LINKS ===');
    const { data: calebeJ } = await supabase.from('alunos_responsaveis').select('responsaveis(*)').eq('aluno_id', calebeId);
    calebeJ?.forEach(r => log(`- AR: ${r.responsaveis.nome_completo} | CPF: ${r.responsaveis.cpf}`));

    const { data: calebeA } = await supabase.from('autorizacoes').select('responsaveis(*)').eq('aluno_id', calebeId);
    calebeA?.forEach(r => log(`- AU: ${r.responsaveis.nome_completo} | CPF: ${r.responsaveis.cpf}`));

    fs.writeFileSync('debug_final_check.txt', lines.join('\n'));
}

debug();

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

    log('=== CALEBE DETAILS ===');
    const { data: calebe } = await supabase.from('alunos').select('*').eq('id', calebeId).single();
    log(calebe);

    log('\n=== LEONARDO DETAILS (both) ===');
    const { data: leonardos } = await supabase.from('responsaveis').select('*').ilike('nome_completo', '%Leonardo Dyego%');
    log(leonardos);

    log('\n=== ANYONE WITH SAME PHONE AS LEONARDO? ===');
    const phones = leonardos?.map(l => l.celular).filter(Boolean) || [];
    if (phones.length > 0) {
        const { data: others } = await supabase.from('responsaveis').select('id, nome_completo, cpf, celular').in('celular', phones);
        log(others);
    }

    fs.writeFileSync('debug_calebe_deep.txt', lines.join('\n'));
}

debug();

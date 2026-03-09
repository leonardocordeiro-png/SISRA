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

    log('=== SEARCHING FOR ALL STUDENTS WITH SURNAME CORDEIRO OR CARVALHO ===');
    const { data: students } = await supabase
        .from('alunos')
        .select('*')
        .or('nome_completo.ilike.%Cordeiro%,nome_completo.ilike.%Carvalho%');

    log(JSON.stringify(students, null, 2));

    fs.writeFileSync('debug_family_students.txt', lines.join('\n'));
}

debug();

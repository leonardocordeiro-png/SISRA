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

    log('=== SEARCHING FOR ALL STUDENTS NAMED CALEBE ===');
    const { data: students } = await supabase
        .from('alunos')
        .select('*')
        .ilike('nome_completo', '%Calebe%');

    log(JSON.stringify(students, null, 2));

    if (students && students.length > 0) {
        for (const s of students) {
            log(`\n--- Links for ${s.nome_completo} (ID: ${s.id}) ---`);
            const { data: ar } = await supabase
                .from('alunos_responsaveis')
                .select('responsavel_id, responsaveis(nome_completo, cpf)')
                .eq('aluno_id', s.id);
            log('AR:', JSON.stringify(ar, null, 2));

            const { data: au } = await supabase
                .from('autorizacoes')
                .select('responsavel_id, responsaveis(nome_completo, cpf)')
                .eq('aluno_id', s.id);
            log('AUTH:', JSON.stringify(au, null, 2));
        }
    }

    fs.writeFileSync('debug_all_calebes.txt', lines.join('\n'));
}

debug();

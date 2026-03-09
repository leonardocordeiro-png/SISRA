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

    const cpfClean = '00516208390';
    const cpfFormatted = '005.162.083-90';

    log(`=== SEARCHING ALL GUARDIANS WITH CPF ${cpfClean} OR ${cpfFormatted} ===`);
    const { data: guardians } = await supabase
        .from('responsaveis')
        .select('*')
        .or(`cpf.eq.${cpfClean},cpf.eq.${cpfFormatted}`);

    log(`Found ${guardians?.length || 0} guardians.`);
    guardians?.forEach(g => {
        log(`- ID: ${g.id} | Name: ${g.nome_completo} | CPF: ${g.cpf}`);
    });

    if (guardians?.length > 0) {
        const ids = guardians.map(g => g.id);
        log('\n--- Checking ALL links for these IDs ---');
        const { data: ar } = await supabase.from('alunos_responsaveis').select('responsavel_id, aluno_id, alunos(nome_completo)').in('responsavel_id', ids);
        ar?.forEach(link => log(`AR: Resp ID ${link.responsavel_id} -> Aluno: ${link.alunos?.nome_completo} (${link.aluno_id})`));

        const { data: au } = await supabase.from('autorizacoes').select('responsavel_id, aluno_id, alunos(nome_completo)').in('responsavel_id', ids);
        au?.forEach(link => log(`AU: Resp ID ${link.responsavel_id} -> Aluno: ${link.alunos?.nome_completo} (${link.aluno_id})`));
    }

    fs.writeFileSync('debug_cpf_only.txt', lines.join('\n'));
}

debug();

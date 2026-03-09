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

    log('=== PESQUISA POR SOBRENOME "CORDEIRO" NOS ALUNOS ===');
    const { data: students } = await supabase
        .from('alunos')
        .select('id, nome_completo, responsavel_nome, responsavel_celular')
        .ilike('nome_completo', '%Cordeiro%');

    log(`Encontrados ${students?.length || 0} alunos:`);
    for (const s of students || []) {
        log(`\nAluno: ${s.nome_completo} (${s.id})`);
        log(`  Responsável (campo texto): ${s.responsavel_nome} | Celular: ${s.responsavel_celular}`);

        const { data: j } = await supabase.from('alunos_responsaveis').select('responsavel_id, responsaveis(id, nome_completo, cpf)').eq('aluno_id', s.id);
        const { data: a } = await supabase.from('autorizacoes').select('responsavel_id, responsaveis(id, nome_completo, cpf, ativa)').eq('aluno_id', s.id);

        log('  Links oficiais (alunos_responsaveis):');
        j?.forEach(r => log(`    - ${r.responsaveis?.nome_completo} | CPF: ${r.responsaveis?.cpf}`));

        log('  Autorizações (autorizacoes):');
        a?.forEach(r => log(`    - ${r.responsaveis?.nome_completo} | CPF: ${r.responsaveis?.cpf} | Ativa: ${r.ativa}`));
    }

    fs.writeFileSync('debug_cordeiro_links.txt', lines.join('\n'));
}

debug();

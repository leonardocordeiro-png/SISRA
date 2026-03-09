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

    log('=== PESQUISA POR NOME "LEONARDO" ===');
    const { data: guardians } = await supabase
        .from('responsaveis')
        .select('id, nome_completo, cpf, codigo_acesso')
        .ilike('nome_completo', '%Leonardo%');

    log(`Encontrados ${guardians?.length || 0} responsáveis:`);
    const guardianIds = guardians?.map(g => g.id) || [];

    if (guardianIds.length > 0) {
        log('\n--- VÍNCULOS EM alunos_responsaveis ---');
        const { data: junctions } = await supabase
            .from('alunos_responsaveis')
            .select('responsavel_id, aluno_id, alunos(id, nome_completo, turma)')
            .in('responsavel_id', guardianIds);

        junctions?.forEach(j => {
            const g = guardians.find(r => r.id === j.responsavel_id);
            log(`Resp: ${g.nome_completo} (${g.id}) | Aluno: ${j.alunos?.nome_completo} (${j.aluno_id}) | Turma: ${j.alunos?.turma}`);
        });

        log('\n--- VÍNCULOS EM autorizacoes ---');
        const { data: auths } = await supabase
            .from('autorizacoes')
            .select('responsavel_id, aluno_id, ativa, alunos(id, nome_completo, turma)')
            .in('responsavel_id', guardianIds);

        auths?.forEach(a => {
            const g = guardians.find(r => r.id === a.responsavel_id);
            log(`Resp: ${g.nome_completo} (${g.id}) | Aluno: ${a.alunos?.nome_completo} (${a.aluno_id}) | Ativa: ${a.ativa} | Turma: ${a.alunos?.turma}`);
        });
    }

    log('\n=== TODOS OS VÍNCULOS PARA O ALUNO "CALEBE" (se existir) ===');
    const { data: calebe } = await supabase.from('alunos').select('id, nome_completo').ilike('nome_completo', '%Calebe%');
    if (calebe?.length) {
        for (const c of calebe) {
            log(`\nAluno: ${c.nome_completo} (${c.id})`);
            const { data: j } = await supabase.from('alunos_responsaveis').select('responsavel_id, responsaveis(id, nome_completo, cpf)').eq('aluno_id', c.id);
            const { data: a } = await supabase.from('autorizacoes').select('responsavel_id, responsaveis(id, nome_completo, cpf)').eq('aluno_id', c.id);

            log('  Responsáveis vinculados (alunos_responsaveis):');
            j?.forEach(r => log(`    - ${r.responsaveis?.nome_completo} | CPF: ${r.responsaveis?.cpf}`));

            log('  Responsáveis autorizados (autorizacoes):');
            a?.forEach(r => log(`    - ${r.responsaveis?.nome_completo} | CPF: ${r.responsaveis?.cpf}`));
        }
    }

    fs.writeFileSync('debug_leornado_students.txt', lines.join('\n'));
}

debug();

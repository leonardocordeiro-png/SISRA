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

    // Simulate Andréa's search (CPF 72669446191)
    const cpf = '72669446191';
    log(`--- SIMULATING FETCH FOR CPF ${cpf} (Andréa) ---`);

    const { data: guardians } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('cpf', cpf);

    const respIds = guardians.map(g => g.id);
    log('Found Guardian IDs:', respIds);

    if (respIds.length > 0) {
        // 1. Get from alunos_responsaveis
        const { data: arLinks } = await supabase
            .from('alunos_responsaveis')
            .select('aluno_id')
            .in('responsavel_id', respIds);

        // 2. Get from autorizacoes
        const { data: authLinks } = await supabase
            .from('autorizacoes')
            .select('aluno_id')
            .in('responsavel_id', respIds);

        const studentIds = Array.from(new Set([
            ...(arLinks?.map(l => l.aluno_id) || []),
            ...(authLinks?.map(l => l.aluno_id) || [])
        ]));

        log('Found Student IDs:', studentIds);

        if (studentIds.length > 0) {
            const { data: students } = await supabase
                .from('alunos')
                .select('*')
                .in('id', studentIds);

            log('Students found:', students.map(s => s.nome_completo));
        } else {
            log('No students found for these IDs.');
        }
    }

    fs.writeFileSync('debug_sim_totem.txt', lines.join('\n'));
}

debug();

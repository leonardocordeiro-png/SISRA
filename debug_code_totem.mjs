import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
    'https://dfwlsrmdedbtfqtsbovc.supabase.co',
    'sb_publishable_sviojNcP8mZX_8MU71L23A_nxL5D4Jn'
);

const lines = [];
const log = (msg) => { lines.push(msg); };

// 1. Todos os responsáveis
const { data: resps } = await supabase
    .from('responsaveis')
    .select('id, nome_completo, cpf, codigo_acesso')
    .limit(50);
log('--- RESPONSÁVEIS ---');
for (const r of resps || []) {
    log(`codigo="${r.codigo_acesso ?? 'NULL'}" | len=${r.codigo_acesso?.length ?? 0} | nome="${r.nome_completo}" | id=${r.id}`);
}

// 2. autorizacoes count
const { count: authTotal } = await supabase.from('autorizacoes').select('*', { count: 'exact', head: true });
log(`\n--- AUTORIZACOES total: ${authTotal} ---`);
const { data: auths } = await supabase.from('autorizacoes').select('responsavel_id, aluno_id, ativa').limit(20);
for (const a of auths || []) log(`  resp=${a.responsavel_id} | aluno=${a.aluno_id} | ativa=${a.ativa}`);

// 3. alunos_responsaveis count
const { count: jTotal } = await supabase.from('alunos_responsaveis').select('*', { count: 'exact', head: true });
log(`\n--- ALUNOS_RESPONSAVEIS total: ${jTotal} ---`);
const { data: junctions } = await supabase.from('alunos_responsaveis').select('responsavel_id, aluno_id').limit(20);
for (const j of junctions || []) log(`  resp=${j.responsavel_id} | aluno=${j.aluno_id}`);

// 4. alunos
const { data: alunos } = await supabase.from('alunos').select('id, nome_completo, turma').limit(10);
log(`\n--- ALUNOS (${alunos?.length}) ---`);
for (const a of alunos || []) log(`  id=${a.id} | nome="${a.nome_completo}" | turma="${a.turma}"`);

fs.writeFileSync('debug_output2.txt', lines.join('\n'), 'utf8');
console.log('Resultado salvo em debug_output2.txt');

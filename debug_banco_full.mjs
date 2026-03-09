import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
    'https://dfwlsrmdedbtfqtsbovc.supabase.co',
    'sb_publishable_sviojNcP8mZX_8MU71L23A_nxL5D4Jn'
);

const lines = [];
const log = (...args) => lines.push(args.join(' '));

// 1. Verificar estrutura da logs_auditoria
const { data: auditRows, error: auditErr } = await supabase
    .from('logs_auditoria')
    .select('*')
    .limit(3);
log(`--- LOGS_AUDITORIA: ${auditErr?.message || 'OK'} | rows: ${auditRows?.length || 0} ---`);
if (auditRows?.[0]) log(JSON.stringify(Object.keys(auditRows[0])));
if (auditRows?.length) log(JSON.stringify(auditRows[0], null, 2));

// 2. Verificar solicitacoes_retirada
const { data: solRows, error: solErr } = await supabase
    .from('solicitacoes_retirada')
    .select('*')
    .limit(5);
log(`\n--- SOLICITACOES_RETIRADA: ${solErr?.message || 'OK'} | rows: ${solRows?.length || 0} ---`);
if (solRows?.[0]) log(JSON.stringify(Object.keys(solRows[0])));
if (solRows?.length) log(JSON.stringify(solRows[0], null, 2));

// 3. Verificar quantos alunos têm vinculo (ao menos 1)
const { data: alunosComVinculo } = await supabase
    .from('alunos_responsaveis')
    .select('aluno_id');
const uniqueAlunos = new Set(alunosComVinculo?.map(a => a.aluno_id) || []);
log(`\n--- ALUNOS COM VÍNCULO EM alunos_responsaveis: ${uniqueAlunos.size} ---`);

// 4. Busca por CPF com normalização
const cpfFormatado = '005.162.083-90';
const cpfLimpo = '00516208390';
const { data: r1 } = await supabase.from('responsaveis').select('id, cpf, nome_completo').eq('cpf', cpfFormatado);
const { data: r2 } = await supabase.from('responsaveis').select('id, cpf, nome_completo').eq('cpf', cpfLimpo);
log(`\n--- CPF eq "${cpfFormatado}": ${r1?.length || 0} ---`);
r1?.forEach(r => log(`  ${r.id} | ${r.nome_completo}`));
log(`--- CPF eq "${cpfLimpo}": ${r2?.length || 0} ---`);
r2?.forEach(r => log(`  ${r.id} | ${r.nome_completo}`));

fs.writeFileSync('debug_banco2.txt', lines.join('\n'), 'utf8');
console.log('Salvo em debug_banco2.txt');

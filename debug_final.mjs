import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const rid = '167b7a88-c12b-422b-9e80-73174a612292'; // Leonardo Cordeiro
    const code = '0B4910';
    const results = {};

    results.autorizacoes_leonardo = (await supabase
        .from('autorizacoes')
        .select('*')
        .eq('responsavel_id', rid)).data;

    results.alunos_responsaveis_leonardo = (await supabase
        .from('alunos_responsaveis')
        .select('*')
        .eq('responsavel_id', rid)).data;

    results.responsible_with_code = (await supabase
        .from('responsaveis')
        .select('id, nome_completo, codigo_acesso')
        .eq('codigo_acesso', code)).data;

    if (results.responsible_with_code && results.responsible_with_code.length > 0) {
        results.active_auths_for_code = (await supabase
            .from('autorizacoes')
            .select('*, alunos:aluno_id (*)')
            .eq('responsavel_id', results.responsible_with_code[0].id)
            .eq('ativa', true)).data;
    }

    fs.writeFileSync('debug_results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to debug_results.json');
}

checkTables();

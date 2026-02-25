import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
    const result = {};

    const targetCpf = '00516208390';

    const { data: resp } = await supabase.from('responsaveis').select('*').eq('cpf', targetCpf);
    result.responsaveis_with_target_cpf = resp;

    const { data: allResp } = await supabase.from('responsaveis').select('*').limit(5);
    result.sample_responsaveis = allResp;

    const { data: allLinks } = await supabase.from('alunos_responsaveis').select('*');
    result.all_links = allLinks;

    fs.writeFileSync('db-state.json', JSON.stringify(result, null, 2));
}

exportData();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
    const { data: auths } = await supabase.from('autorizacoes').select('*');
    console.log('Total auths:', auths?.length);

    const { data: students } = await supabase.from('alunos').select('id, nome_completo');
    console.log('Students:', students);

    const { data: responsaveis } = await supabase.from('responsaveis').select('id, nome_completo, cpf');
    console.log('Responsaveis:', responsaveis);

    const { data: links } = await supabase.from('alunos_responsaveis').select('*');
    console.log('Links:', links);
}

exportData();

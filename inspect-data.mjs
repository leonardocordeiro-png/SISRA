import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
    console.log("--- Guardians containing '005' ---");
    const { data: q1 } = await supabase.from('responsaveis').select('id, nome_completo, cpf').ilike('cpf', '%005%');
    console.log(q1);

    console.log("\n--- Authorizations ---");
    const { data: q2 } = await supabase.from('autorizacoes').select('*');
    console.log(q2);

    console.log("\n--- Students ---");
    const { data: q3 } = await supabase.from('alunos').select('id, nome_completo');
    console.log(q3);

    console.log("\n--- Junction Table (Links) ---");
    const { data: q4 } = await supabase.from('alunos_responsaveis').select('*');
    console.log(q4);
}

inspectData();

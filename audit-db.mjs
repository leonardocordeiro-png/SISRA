import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fullAudit() {
    const result = {};

    const { data: responsaveis } = await supabase.from('responsaveis').select('id, nome_completo, cpf');
    result.responsaveis = responsaveis;

    const { data: students } = await supabase.from('alunos').select('id, nome_completo');
    result.students = students;

    const { data: authorizations } = await supabase.from('autorizacoes').select('*');
    result.authorizations = authorizations;

    const { data: links } = await supabase.from('alunos_responsaveis').select('*');
    result.links = links;

    fs.writeFileSync('db_audit.json', JSON.stringify(result, null, 2));
    console.log('Audit saved to db_audit.json');
}

fullAudit();

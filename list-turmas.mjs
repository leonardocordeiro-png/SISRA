import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTurmas() {
    const { data, error } = await supabase.from('turmas').select('nome').eq('ativa', true).order('nome');
    if (error) {
        console.error(error);
        return;
    }
    console.log('--- TURMAS ATIVAS ---');
    data.forEach(t => console.log(t.nome));
    console.log('--- END ---');
}

listTurmas();

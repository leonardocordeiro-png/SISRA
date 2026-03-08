import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ESCOLA_ID = 'e6328325-1845-420a-b333-87a747953259'; // Default from ClassroomManagement.tsx

const CLASSES = [
    { serie: '1º Ano', secao: '111M' }, { serie: '1º Ano', secao: '112T' }, { serie: '1º Ano', secao: '113T' },
    { serie: '2º Ano', secao: '121M' }, { serie: '2º Ano', secao: '122T' }, { serie: '2º Ano', secao: '123T' },
    { serie: '3º Ano', secao: '131M' }, { serie: '3º Ano', secao: '132M' }, { serie: '3º Ano', secao: '133T' },
    { serie: '4º Ano', secao: '141M' }, { serie: '4º Ano', secao: '142M' }, { serie: '4º Ano', secao: '143T' }, { serie: '4º Ano', secao: '144T' },
    { serie: '5º Ano', secao: '151M' }, { serie: '5º Ano', secao: '152M' }, { serie: '5º Ano', secao: '153T' }, { serie: '5º Ano', secao: '154T' }
];

async function populate() {
    console.log('Populating Turmas...');
    for (const item of CLASSES) {
        const nomeCompleto = `${item.serie} - Ensino Fundamental I (${item.secao})`;
        const { data: existing } = await supabase.from('turmas').select('id').eq('nome', nomeCompleto).single();

        if (!existing) {
            console.log(`Creating: ${nomeCompleto}`);
            await supabase.from('turmas').insert({
                escola_id: ESCOLA_ID,
                nome: nomeCompleto,
                ativa: true
            });
        } else {
            console.log(`Skipping: ${nomeCompleto} (already exists)`);
        }
    }
    console.log('Finished!');
}

populate();

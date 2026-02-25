import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function repair() {
    const studentId = '478d0242-1d87-4f6c-8692-44ae1ecd8fce'; // Alice de Carvalho Cordeiro
    const guardianId = '167b7a88-c12b-422b-9e80-73174a612292'; // Leonardo Dyego (numeric CPF)
    const duplicateId = '101b5be6-0403-4e5c-aa57-c599c3829c19'; // Leonardo Dyego (punctuated CPF)

    console.log('Starting repair...');

    // 1. Delete duplicate punctuated record
    const { error: delError } = await supabase.from('responsaveis').delete().eq('id', duplicateId);
    if (delError) console.error('Error deleting duplicate:', delError);
    else console.log('Deleted duplicate punctuated guardian.');

    // 2. Create Authorization
    const { error: authError } = await supabase.from('autorizacoes').insert({
        aluno_id: studentId,
        responsavel_id: guardianId,
        tipo_autorizacao: 'PRINCIPAL',
        parentesco: 'Pai',
        ativa: true
    });
    if (authError) console.error('Error creating authorization:', authError);
    else console.log('Created authorization for Leo -> Alice.');

    // 3. Create Link
    const { error: linkError } = await supabase.from('alunos_responsaveis').insert({
        aluno_id: studentId,
        responsavel_id: guardianId
    });
    if (linkError) console.error('Error creating link:', linkError);
    else console.log('Created junction link for Leo -> Alice.');

    console.log('Repair complete!');
}

repair();

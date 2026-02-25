import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixData() {
    const targetCpf = '00516208390';
    const { data: resp } = await supabase.from('responsaveis').select('*').eq('cpf', targetCpf).single();

    if (resp) {
        // Check if there are auths
        const { data: auths } = await supabase.from('autorizacoes').select('*').eq('responsavel_id', resp.id);
        console.log('Auths for this guardian:', auths);

        // If there is an auth, let's create the link!
        if (auths && auths.length > 0) {
            for (const auth of auths) {
                // Check if link exists
                const { data: link } = await supabase.from('alunos_responsaveis')
                    .select('*')
                    .eq('aluno_id', auth.aluno_id)
                    .eq('responsavel_id', resp.id)
                    .single();

                if (!link) {
                    console.log(`Fixing missing link for Aluno: ${auth.aluno_id} and Responsavel: ${resp.id}`);
                    const { error: insertError } = await supabase.from('alunos_responsaveis')
                        .insert({
                            aluno_id: auth.aluno_id,
                            responsavel_id: resp.id
                        });
                    if (insertError) {
                        console.error('Failed to fix link:', insertError);
                    } else {
                        console.log('Link fixed successfully!');
                    }
                } else {
                    console.log('Link already exists.');
                }
            }
        } else {
            console.log('No authorizations found for this guardian either.');
        }
    }
}

checkAndFixData();

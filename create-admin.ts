import 'dotenv/config';
import { supabase } from './src/lib/supabase';

async function createAdminUser() {
    const email = 'leonardo.cordeiro@lasalle.org.br';
    const password = 'Admin@2026';

    console.log(`\n🔐 Criando usuário administrador...`);

    try {
        console.log('1. Verificando/Criando usuário no Auth...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log(`✅ Usuário ${email} já existe no Auth.`);
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (signInError) {
                    console.error('❌ Erro no Login:', signInError.message);
                    throw signInError;
                }

                console.log(`✅ Login realizado! ID: ${signInData.user.id}`);
                await createProfile(signInData.user.id, email);
            } else {
                console.error('❌ Erro no Sign Up:', authError.message);
                throw authError;
            }
        } else if (authData.user) {
            console.log(`✅ Auth User criado! ID: ${authData.user.id}`);
            await createProfile(authData.user.id, email);
        }

    } catch (error: any) {
        console.error(`❌ Falha no processo:`, error.message || error);
        process.exit(1);
    }
}

async function createProfile(userId: string, email: string) {
    const escola_id = 'e6328325-1845-420a-b333-87a747953259';
    console.log(`2. Criando perfil para escola: ${escola_id}...`);

    const { error: profileError } = await supabase
        .from('usuarios')
        .upsert({
            id: userId,
            escola_id: escola_id,
            nome: 'Leonardo Cordeiro',
            email: email,
            tipo_usuario: 'ADMIN',
            ativo: true
        }, { onConflict: 'id' });

    if (profileError) {
        console.error('❌ Erro ao criar/atualizar perfil:', profileError);
        throw profileError;
    }

    console.log(`✅ Perfil pronto na tabela usuarios!`);
    console.log(`\n✨ ADMINISTRADOR CONFIGURADO COM SUCESSO!`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: Admin@2026`);
}

createAdminUser();

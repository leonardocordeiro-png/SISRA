import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfwlsrmdedbtfqtsbovc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmd2xzcm1kZWRidGZxdHNib3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDUzMzEsImV4cCI6MjA4NjUyMTMzMX0.HNaPkktLTQSyeaHHHS_k6JeghzoLeIDZAH1UKdH5Va8';
const escola_id = 'e6328325-1845-420a-b333-87a747953259';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Verificando se a escola existe...');
    const { data: existing } = await supabase.from('escolas').select('id').eq('id', escola_id);

    if (existing && existing.length > 0) {
        console.log('Escola já existe.');
        return;
    }

    console.log('Criando registro da escola...');
    const { error } = await supabase.from('escolas').insert({
        id: escola_id,
        nome: 'Colégio La Salle',
        website: 'https://lasalle.org.br',
        endereco: 'Rua Jose Bonifacio, 212 - Canoas, RS',
        logo_url: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&q=80&w=200'
    });

    if (error) {
        console.error('ERRO AO CRIAR ESCOLA:', error.message);
    } else {
        console.log('ESCOLA CRIADA COM SUCESSO!');
    }
}

seed();

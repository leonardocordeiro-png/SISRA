import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfwlsrmdedbtfqtsbovc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmd2xzcm1kZWRidGZxdHNib3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDUzMzEsImV4cCI6MjA4NjUyMTMzMX0.HNaPkktLTQSyeaHHHS_k6JeghzoLeIDZAH1UKdH5Va8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlunos() {
    console.log('--- ALUNOS ---');
    const { data, error } = await supabase.from('alunos').select('nome').limit(5);
    if (error) {
        console.error('ERROR:', error.message);
    } else {
        console.log('ALUNOS_DATA:', data);
    }
}

checkAlunos();

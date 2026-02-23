import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfwlsrmdedbtfqtsbovc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmd2xzcm1kZWRidGZxdHNib3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDUzMzEsImV4cCI6MjA4NjUyMTMzMX0.HNaPkktLTQSyeaHHHS_k6JeghzoLeIDZAH1UKdH5Va8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    console.log('--- USUARIOS ---');
    const { data: users, error: errU } = await supabase.from('usuarios').select('email, escola_id').limit(5);
    console.log(users || errU);

    console.log('--- ESCOLAS ---');
    const { data: schools, error: errE } = await supabase.from('escolas').select('*');
    console.log(schools || errE);
}

checkAll();

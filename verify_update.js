import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfwlsrmdedbtfqtsbovc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmd2xzcm1kZWRidGZxdHNib3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDUzMzEsImV4cCI6MjA4NjUyMTMzMX0.HNaPkktLTQSyeaHHHS_k6JeghzoLeIDZAH1UKdH5Va8';
const escola_id = 'e6328325-1845-420a-b333-87a747953259';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    try {
        console.log('Tentando atualizar a coluna logo_url...');
        const { data, error } = await supabase
            .from('escolas')
            .update({ logo_url: 'https://verify_test.png' })
            .eq('id', escola_id)
            .select();

        if (error) {
            console.error('VERIFY_FAILED:', error.message);
            process.exit(1);
        }

        console.log('VERIFY_SUCCESS: Colunas detectadas e operacionais.');
        console.log('Campos retornados:', Object.keys(data[0]).join(', '));
    } catch (err) {
        console.error('FATAL:', err.message);
        process.exit(1);
    }
}

verify();

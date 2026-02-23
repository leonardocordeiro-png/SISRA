import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfwlsrmdedbtfqtsbovc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmd2xzcm1kZWRidGZxdHNib3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDUzMzEsImV4cCI6MjA4NjUyMTMzMX0.HNaPkktLTQSyeaHHHS_k6JeghzoLeIDZAH1UKdH5Va8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    try {
        const { data, error } = await supabase.from('escolas').select('*').limit(1);
        if (error) {
            console.error('ERROR:', error.message);
            process.exit(1);
        }
        if (!data || data.length === 0) {
            console.error('ERROR: No schools found');
            process.exit(1);
        }
        const columns = Object.keys(data[0]);
        console.log('COLUMNS_LIST_START');
        columns.forEach(col => console.log(col));
        console.log('COLUMNS_LIST_END');
    } catch (err) {
        console.error('FATAL:', err.message);
        process.exit(1);
    }
}

verify();

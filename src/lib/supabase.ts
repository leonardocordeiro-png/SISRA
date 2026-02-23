import { createClient } from '@supabase/supabase-js';

// Load environment variables if running in Node.js
if (typeof process !== 'undefined' && process.env) {
    try {
        const dotenv = await import('dotenv');
        dotenv.config();
    } catch (e) {
        // Dotenv might not be available in all environments
    }
}
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined);
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined);

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Supabase URL e Anon Key são obrigatórios. ' +
        'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env'
    );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

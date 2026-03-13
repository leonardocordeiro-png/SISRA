import { createClient } from '@supabase/supabase-js';

// .trim() removes \r\n that can sneak in from .env files saved with CRLF
// line endings, which would corrupt the WebSocket URL (%0D%0A in apikey).
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim();

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Supabase URL e Anon Key são obrigatórios. ' +
        'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env'
    );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

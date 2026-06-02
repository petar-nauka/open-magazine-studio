import { createClient } from '@supabase/supabase-js';

// Read env defensively: trim whitespace/newlines and treat an empty value as
// missing, so a blank or malformed .env entry doesn't white-screen the whole app
// (createClient throws synchronously on an empty/invalid URL).
function envValue(raw: string | undefined, fallback: string): string {
  const v = (raw ?? '').trim();
  return v || fallback;
}

const supabaseUrl = envValue(import.meta.env.VITE_SUPABASE_URL, 'http://localhost:54321');
const supabaseAnonKey = envValue(import.meta.env.VITE_SUPABASE_ANON_KEY, 'placeholder');

if (supabaseAnonKey === 'placeholder' || supabaseUrl === 'http://localhost:54321') {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
    'Create magazine-pdf/.env with both values and restart `npm run dev`.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

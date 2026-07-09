import { createBrowserClient } from '@supabase/ssr';

// Se por acaso as variáveis sumirem no build, ele usa uma URL falsa temporária para não quebrar o processo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hevrxoccodxlxrxwdpwj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ByNB1KIkqdsy_LeoWAkkIA_di9Q1lpz';

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

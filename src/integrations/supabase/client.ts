import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sqmganbjiisitgumsztv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BqU8oLRueee_zMv1ayiJSw_5nr1VwxB';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

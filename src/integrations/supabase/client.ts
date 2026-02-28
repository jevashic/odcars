import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://sqmganbjiisitgumsztv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbWdhbmJqaWlzaXRndW1zenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjkwOTEsImV4cCI6MjA4NzI0NTA5MX0.NIVT-p-_wa0PKaufK8vPYsgyegDFAiHAuUw60uWQYrQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Expose to window for the health monitor to find (development only)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
    window.supabase = supabase;
    console.log('🔗 Supabase client exposed to window object');
}

// Log configuration only in development
if (import.meta.env.DEV) {
    console.log('🔗 Supabase URL:', supabaseUrl);
    console.log('🔑 Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'NOT SET');
    console.log('📊 Environment check:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
        isClientCreated: !!supabase
    });
}
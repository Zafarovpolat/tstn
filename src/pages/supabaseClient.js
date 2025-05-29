import { createClient } from '@supabase/supabase-js';

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables. Check your .env file.');
}

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
    },
});

export const setCurrentUserId = async (userId) => {
    if (!userId) return;
    const { error } = await supabase.rpc('set_current_user_id', { user_id: userId });
    if (error) {
        console.error('Error setting user_id:', error.message);
        throw error;
    }
};
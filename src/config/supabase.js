const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

// Use service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// For public operations (if needed)
const createPublicClient = () => {
    return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '');
};

module.exports = {
    supabase,
    createPublicClient,
    supabaseUrl
};
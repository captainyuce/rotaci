import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
    // We don't throw error here to avoid breaking build if env var is missing during build
    // But API routes using this will fail if key is missing
    console.warn('Missing Supabase Service Role Key')
}

// Create a Supabase client with the SERVICE ROLE key
// This client has admin privileges and bypasses RLS
export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuration Error' }, { status: 500 })
    }

    const email = 'demo_admin_' + Date.now() + '@rotaci.app'
    const password = 'password123'

    try {
        // Create user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Demo Admin', role: 'admin' }
        })

        if (authError) throw authError

        // Create profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: authData.user.id,
                username: email,
                full_name: 'Demo Admin',
                role: 'admin'
            })

        if (profileError) throw profileError

        return NextResponse.json({ email, password })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

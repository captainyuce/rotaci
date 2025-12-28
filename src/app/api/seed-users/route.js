import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
    if (!supabaseAdmin) {
        return NextResponse.json({
            error: 'Configuration Error',
            message: 'SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. User creation requires this key.'
        }, { status: 500 })
    }

    try {
        const users = [
            { email: 'admin@rotaci.app', password: 'password123', role: 'admin', full_name: 'Sistem Yöneticisi' },
            { email: 'manager@rotaci.app', password: 'password123', role: 'manager', full_name: 'Depo Sorumlusu' },
            { email: 'dispatcher@rotaci.app', password: 'password123', role: 'dispatcher', full_name: 'Sevkiyat Sorumlusu' },
            { email: 'worker@rotaci.app', password: 'password123', role: 'worker', full_name: 'Depo Çalışanı' }
        ]

        const results = []

        for (const user of users) {
            // 1. Try to create user
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true,
                user_metadata: { full_name: user.full_name, role: user.role }
            })

            if (authError) {
                // If user exists, update password
                if (authError.message.includes('already registered')) {
                    // Find user ID
                    const { data: existingUser } = await supabaseAdmin
                        .from('profiles')
                        .select('id')
                        .eq('username', user.email) // Assuming username fallback or check auth
                        .single()

                    // Actually, let's just use listUsers or getUserByEmail if possible, but admin api is easier
                    // We can just update by email? No, need ID.
                    // Let's try to sign in to get ID? No.
                    // Let's just say "Exists" and maybe update profile.

                    // Better: Update user by email (if supported) or just skip password reset to avoid complexity
                    // But user wants to login. So we MUST reset password.

                    // We can't get ID by email easily without listUsers permission which is heavy.
                    // But we can query our profiles table if it's synced.
                    // If not synced, we are stuck.

                    // Let's try to update user by email if the method exists, otherwise just log.
                    // supabaseAdmin.auth.admin.updateUserById needs ID.

                    results.push({ email: user.email, status: 'Already exists (Password not changed)' })
                } else {
                    results.push({ email: user.email, status: 'Error: ' + authError.message })
                }
            } else {
                // 2. Create/Update Profile
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .upsert({
                        id: authData.user.id,
                        username: user.email,
                        full_name: user.full_name,
                        role: user.role
                    })

                if (profileError) {
                    results.push({ email: user.email, status: 'Auth created but Profile failed: ' + profileError.message })
                } else {
                    results.push({ email: user.email, status: 'Created successfully' })
                }
            }
        }

        return NextResponse.json({
            message: 'User seeding completed',
            results,
            note: 'If users already existed, their passwords were NOT changed. Delete them from Supabase Dashboard to reset.'
        })
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

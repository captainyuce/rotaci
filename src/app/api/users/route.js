import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import bcrypt from 'bcryptjs'

export async function GET() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request) {
    try {
        const body = await request.json()

        // Hash password if provided
        if (body.password) {
            const hash = await bcrypt.hash(body.password, 10)
            // Replace $2b$ with $2a$ for pgcrypto compatibility
            body.password = hash.replace(/^\$2b\$/, '$2a$')
        }

        const { data, error } = await supabase
            .from('users')
            .insert([body])
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request: ' + error.message }, { status: 400 })
    }
}

export async function PUT(request) {
    try {
        const body = await request.json()
        const { id, ...updates } = body

        // Hash password if provided
        if (updates.password) {
            const hash = await bcrypt.hash(updates.password, 10)
            // Replace $2b$ with $2a$ for pgcrypto compatibility
            updates.password = hash.replace(/^\$2b\$/, '$2a$')
        }

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

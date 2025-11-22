import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request) {
    try {
        const { username, password } = await request.json()

        // 1. Check Users Table
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password) // Note: In production, use hashed passwords!
            .single()

        if (user) {
            return NextResponse.json({ success: true, user })
        }

        // 2. Check Vehicles (for Driver Login via Plate)
        // If username matches a plate, log them in as a driver
        const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('plate', username)
            .single()

        if (vehicle) {
            return NextResponse.json({
                success: true,
                user: {
                    id: vehicle.id,
                    username: vehicle.plate,
                    name: vehicle.name,
                    role: 'driver',
                    vehicleId: vehicle.id
                }
            })
        }

        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })

    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

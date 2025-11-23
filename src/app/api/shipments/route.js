import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
    const { data, error } = await supabase
        .from('shipments')
        .select(`
      *,
      vehicles (
        plate,
        name
      )
    `)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request) {
    try {
        const body = await request.json()

        const { data, error } = await supabase
            .from('shipments')
            .insert([body])
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}

export async function PUT(request) {
    try {
        const body = await request.json()
        const { id, ...updates } = body

        // Get old shipment data to check if vehicle assignment changed
        const { data: oldShipment } = await supabase
            .from('shipments')
            .select('assigned_vehicle_id')
            .eq('id', id)
            .single()

        const { data, error } = await supabase
            .from('shipments')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        // Send push notification if vehicle assignment changed
        if (updates.assigned_vehicle_id && updates.assigned_vehicle_id !== oldShipment?.assigned_vehicle_id) {
            try {
                await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-notification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicleId: updates.assigned_vehicle_id,
                        title: 'Yeni Sevkiyat Atandı! 📦',
                        body: `${data.customer_name} - ${data.delivery_address}`,
                        data: {
                            shipmentId: id,
                            action: 'new_shipment'
                        }
                    })
                })
            } catch (notifError) {
                console.error('Failed to send notification:', notifError)
                // Don't fail the request if notification fails
            }
        }

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
            .from('shipments')
            .delete()
            .eq('id', id);

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

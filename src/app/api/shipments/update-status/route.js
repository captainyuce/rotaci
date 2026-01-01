import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
    // Initialize Supabase client with service role key for admin privileges
    // We do this inside the handler to avoid build-time errors if the key is missing
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    try {
        const { shipmentId, status, userId, notes, lat, lng } = await request.json()

        if (!shipmentId || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Update the shipment status
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        }

        // Add delivery details if provided
        if (status === 'delivered') {
            updateData.delivery_time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            if (lat && lng) {
                updateData.delivery_lat = lat
                updateData.delivery_lng = lng
            }
        }

        const { data: updatedShipment, error: updateError } = await supabase
            .from('shipments')
            .update(updateData)
            .eq('id', shipmentId)
            .select()
            .single()

        if (updateError) throw updateError

        // 2. Check for Subcontractor Trigger
        // If delivered AND has target_subcontractor_id, create production order
        if (status === 'delivered' && updatedShipment.target_subcontractor_id) {
            console.log('Triggering Subcontractor Production Order for:', updatedShipment.id)

            const productionOrder = {
                type: 'pickup', // Will be pickup eventually
                status: 'production', // Special status for subcontractor
                customer_name: updatedShipment.customer_name, // Or maybe the subcontractor name? Keeping customer for reference
                delivery_address: updatedShipment.delivery_address, // Address where it was delivered (subcontractor's place)
                weight: updatedShipment.weight,
                delivery_date: null, // To be filled by subcontractor
                assigned_user_id: updatedShipment.target_subcontractor_id,
                created_by: userId || updatedShipment.created_by,
                parent_shipment_id: updatedShipment.id,
                product_info: updatedShipment.product_info,
                notes: `[Otomatik Oluşturuldu] ${updatedShipment.product_info || ''} üretimi için.`
            }

            const { error: createError } = await supabase
                .from('shipments')
                .insert([productionOrder])

            if (createError) {
                console.error('Error creating production order:', createError)
                // We don't fail the request, but we log the error
            }
        }

        // 3. Log the action (Optional, but good practice)
        // ... (Logging logic can be added here)

        return NextResponse.json({ success: true, data: updatedShipment })

    } catch (error) {
        console.error('Error updating shipment:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

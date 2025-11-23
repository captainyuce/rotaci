import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { optimizeRoute } from '@/lib/routeOptimizer'

export async function POST(request) {
    try {
        const { vehicleId, shipmentIds, departureTime } = await request.json()

        if (!vehicleId || !shipmentIds || shipmentIds.length === 0) {
            return NextResponse.json({ error: 'Vehicle ID and shipment IDs are required' }, { status: 400 })
        }

        // Get vehicle location
        const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', vehicleId)
            .single()

        if (vehicleError || !vehicle) {
            return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
        }

        if (!vehicle.current_lat || !vehicle.current_lng) {
            return NextResponse.json({ error: 'Vehicle location not available' }, { status: 400 })
        }

        // Get shipments
        const { data: shipments, error: shipmentsError } = await supabase
            .from('shipments')
            .select('*')
            .in('id', shipmentIds)

        if (shipmentsError || !shipments) {
            return NextResponse.json({ error: 'Shipments not found' }, { status: 404 })
        }

        // Optimize route
        const result = await optimizeRoute(
            { lat: vehicle.current_lat, lng: vehicle.current_lng },
            shipments,
            {
                departureTime,
                bridgePreference: vehicle.bridge_preference || 'any'
            }
        )

        return NextResponse.json(result)
    } catch (error) {
        console.error('Route optimization error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

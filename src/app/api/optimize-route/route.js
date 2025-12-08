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

        // Get base address from settings
        const { data: settings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'base_address')
            .single()

        let startLocation = null

        // Try vehicle location first
        if (vehicle.current_lat && vehicle.current_lng) {
            startLocation = { lat: vehicle.current_lat, lng: vehicle.current_lng }
        }
        // Fallback to base address
        else if (settings?.value) {
            try {
                const parsed = JSON.parse(settings.value)
                if (parsed.lat && parsed.lng) {
                    startLocation = { lat: parsed.lat, lng: parsed.lng }
                }
            } catch (e) {
                console.error('Error parsing base address:', e)
            }
        }

        if (!startLocation) {
            // Final fallback to Istanbul center if nothing else
            startLocation = { lat: 41.0082, lng: 28.9784 }
        }

        // Get shipments
        const { data: shipments, error: shipmentsError } = await supabase
            .from('shipments')
            .select('*')
            .in('id', shipmentIds)

        if (shipmentsError || !shipments) {
            return NextResponse.json({ error: 'Shipments not found' }, { status: 404 })
        }

        let endLocation = null
        if (settings?.value) {
            try {
                const parsed = JSON.parse(settings.value)
                if (parsed.returnToDepot && parsed.lat && parsed.lng) {
                    endLocation = { lat: parsed.lat, lng: parsed.lng }
                }
            } catch (e) {
                console.error('Error parsing settings for end location:', e)
            }
        }

        // Optimize route
        const result = await optimizeRoute(
            startLocation,
            shipments,
            {
                departureTime,
                bridgePreference: vehicle.bridge_preference || 'any',
                endLocation
            }
        )

        // Save optimization results to database
        if (result.optimizedShipments && result.optimizedShipments.length > 0) {
            // Update each shipment with its new order and ETA
            await Promise.all(result.optimizedShipments.map(s =>
                supabase
                    .from('shipments')
                    .update({
                        delivery_order: s.routeOrder,
                        // We could also save ETA if we had a column for it
                    })
                    .eq('id', s.id)
            ))
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('Route optimization error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

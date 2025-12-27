import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { optimizeRoute } from '@/lib/routeOptimizer'

export async function POST(request) {
    try {
        const { vehicleId, shipmentIds, departureTime, keepOrder, saveToDb, depotLocation: clientDepotLocation } = await request.json()

        if (!vehicleId || !shipmentIds || shipmentIds.length === 0) {
            return NextResponse.json({ error: 'Vehicle ID and shipment IDs are required' }, { status: 400 })
        }

        // Fetch vehicle details
        const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', vehicleId)
            .single()

        if (vehicleError || !vehicle) {
            return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
        }

        // Fetch shipments
        const { data: shipments, error: shipmentsError } = await supabase
            .from('shipments')
            .select('*')
            .in('id', shipmentIds)

        if (shipmentsError || !shipments) {
            return NextResponse.json({ error: 'Error fetching shipments' }, { status: 500 })
        }

        // Get base address from settings (Server-side fetch as fallback)
        const { data: settings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'base_address')
            .single()

        let startLocation = null
        if (vehicle.current_lat && vehicle.current_lng) {
            startLocation = { lat: vehicle.current_lat, lng: vehicle.current_lng }
        }

        // Determine Depot Location
        // Priority: 1. Client passed location (most reliable), 2. Server fetched location
        let depotLocation = clientDepotLocation

        // Fallback Depot (Akalbatu)
        const FALLBACK_DEPOT = { lat: 41.023763, lng: 28.913816 }

        if (!depotLocation && settings?.value) {
            try {
                const parsed = JSON.parse(settings.value)
                if (parsed.lat && parsed.lng) {
                    depotLocation = { lat: parsed.lat, lng: parsed.lng }
                }
            } catch (e) {
                console.error('Error parsing settings for depot location:', e)
            }
        }

        // Ultimate Fallback
        if (!depotLocation) {
            console.warn('Depot location not found in client or settings, using fallback.')
            depotLocation = FALLBACK_DEPOT
        }

        // Ensure startLocation exists by falling back to depot
        if (!startLocation && depotLocation) {
            startLocation = depotLocation
        }

        let endLocation = null
        // Check if specific returnToDepot setting exists (optional, but good for future)
        if (settings?.value) {
            try {
                const parsed = JSON.parse(settings.value)
                if (parsed.returnToDepot && parsed.lat && parsed.lng) {
                    endLocation = { lat: parsed.lat, lng: parsed.lng }
                }
            } catch (e) {
                // Ignore
            }
        }

        // Force return to DEPOT location if no specific end location is set
        // This ensures the route ends at the depot, not the vehicle's start location
        if (!endLocation && depotLocation) {
            endLocation = depotLocation
        } else if (!endLocation) {
            // Fallback to start location only if depot is unknown (shouldn't happen with valid settings)
            endLocation = startLocation
        }

        console.log('Optimization Request - Vehicle:', vehicleId, 'Shipments:', shipmentIds.length)
        console.log('Start Location:', startLocation)
        console.log('End Location (Depot):', endLocation)

        // Optimize route
        const result = await optimizeRoute(
            startLocation,
            shipments,
            {
                departureTime,
                bridgePreference: vehicle.bridge_preference || 'any',
                endLocation,
                keepOrder // Pass keepOrder flag
            }
        )

        // Save optimization results to database ONLY if requested
        if (saveToDb && result.optimizedShipments && result.optimizedShipments.length > 0) {
            // Update each shipment with its new order
            await Promise.all(result.optimizedShipments
                .filter(s => !s.isDepotReturn) // Exclude synthetic depot return
                .map(s =>
                    supabase
                        .from('shipments')
                        .update({
                            route_order: s.routeOrder,
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

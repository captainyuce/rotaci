/**
 * Route Optimization Utility using OSRM API
 * Provides traffic-aware route optimization for delivery vehicles
 */

const OSRM_BASE_URL = 'https://router.project-osrm.org'

// Istanbul Bridge Coordinates (for forcing routes through specific bridges)
// Using approach points on both sides to ensure routing through the bridge
const ISTANBUL_BRIDGES = {
    fsm: {
        lat: 41.1876,
        lng: 29.0802,
        name: 'Yavuz Sultan Selim (3. Köprü)',
        // Approach points to force routing through this bridge
        europeApproach: { lat: 41.1950, lng: 29.0650 },
        asiaApproach: { lat: 41.1800, lng: 29.0950 }
    },
    bosphorus: {
        lat: 41.0422,
        lng: 29.0097,
        name: '15 Temmuz Şehitler (Boğaziçi)',
        europeApproach: { lat: 41.0450, lng: 28.9950 },
        asiaApproach: { lat: 41.0400, lng: 29.0250 }
    },
    fatih: {
        lat: 41.0892,
        lng: 29.0551,
        name: 'Fatih Sultan Mehmet',
        europeApproach: { lat: 41.0950, lng: 29.0400 },
        asiaApproach: { lat: 41.0850, lng: 29.0700 }
    }
}

/**
 * Determine if route crosses Bosphorus (Europe to Asia or vice versa)
 */
function crossesBosphorus(point1, point2) {
    // Simple check: if longitudes are on different sides of ~29.0 (Bosphorus)
    const bosphorusLng = 29.0
    return (point1.lng < bosphorusLng && point2.lng > bosphorusLng) ||
        (point1.lng > bosphorusLng && point2.lng < bosphorusLng)
}

/**
 * Get bridge waypoint based on vehicle preference
 */
function getBridgeWaypoint(bridgePreference) {
    switch (bridgePreference) {
        case 'fsm_only':
            return ISTANBUL_BRIDGES.fsm
        case 'bosphorus_only':
            return ISTANBUL_BRIDGES.bosphorus
        case 'fatih_only':
            return ISTANBUL_BRIDGES.fatih
        default:
            return null // No preference, let OSRM decide
    }
}

const TRAFFIC_FACTOR = 1.5 // Istanbul traffic heuristic (50% slower than OSRM estimate)

/**
 * Calculate optimal route order for shipments
 * @param {Object} vehicleLocation - { lat, lng } of vehicle
 * @param {Array} shipments - Array of shipment objects with delivery_lat, delivery_lng, delivery_time
 * @param {Object} options - Additional options like departureTime, bridgePreference
 * @returns {Promise<Object>} Optimized route with order, distances, and ETAs
 */
export async function optimizeRoute(vehicleLocation, shipments, options = {}) {
    if (!shipments || shipments.length === 0) {
        return { optimizedShipments: [], totalDistance: 0, totalDuration: 0, routes: [] }
    }

    // Filter out shipments without coordinates
    const validShipments = shipments.filter(s => s.delivery_lat && s.delivery_lng)

    if (validShipments.length === 0) {
        return { optimizedShipments: [], totalDistance: 0, totalDuration: 0, routes: [] }
    }

    try {
        // For single shipment, no optimization needed UNLESS endLocation is set
        if (validShipments.length === 1 && !options.endLocation) {
            const route = await getRoute(
                [vehicleLocation.lng, vehicleLocation.lat],
                [validShipments[0].delivery_lng, validShipments[0].delivery_lat],
                options.bridgePreference,
                vehicleLocation,
                validShipments[0]
            )

            const adjustedDuration = route.duration * TRAFFIC_FACTOR

            return {
                optimizedShipments: [{
                    ...validShipments[0],
                    routeOrder: 1,
                    eta: calculateETA(adjustedDuration, options.departureTime),
                    distance: route.distance
                }],
                totalDistance: route.distance,
                totalDuration: adjustedDuration,
                routes: [route.geometry],
                legs: route.legs // Return legs for single shipment too
            }
        }

        // For multiple shipments, use OSRM Trip service for optimization
        const coordinates = [
            [vehicleLocation.lng, vehicleLocation.lat], // Start point
            ...validShipments.map(s => [s.delivery_lng, s.delivery_lat])
        ]

        // Add end location if provided (return to depot)
        if (options.endLocation) {
            coordinates.push([options.endLocation.lng, options.endLocation.lat])
            console.log('Added end location to coordinates:', options.endLocation)
        } else {
            console.log('No end location provided')
        }

        console.log('Total coordinates for OSRM:', coordinates.length)

        // Add bridge waypoint if needed and preference is set
        const bridgeWaypoint = getBridgeWaypoint(options.bridgePreference)
        console.log('Bridge preference:', options.bridgePreference, 'Waypoint:', bridgeWaypoint)

        let bridgeWaypointsAdded = 0
        if (bridgeWaypoint) {
            // Check if any shipment crosses Bosphorus
            // Also check if return trip crosses Bosphorus
            const crossesBridge = validShipments.some(s => {
                const crosses = crossesBosphorus(vehicleLocation, { lat: s.delivery_lat, lng: s.delivery_lng })
                return crosses
            }) || (options.endLocation && crossesBosphorus(validShipments[validShipments.length - 1], options.endLocation))

            console.log('Any shipment crosses Bosphorus?', crossesBridge)

            if (crossesBridge) {
                // Determine direction (Europe to Asia or vice versa)
                const vehicleInEurope = vehicleLocation.lng < 29.0

                // Add approach points to force routing through the bridge
                if (vehicleInEurope) {
                    // Europe to Asia: add Europe approach, bridge center, Asia approach
                    coordinates.splice(1, 0,
                        [bridgeWaypoint.europeApproach.lng, bridgeWaypoint.europeApproach.lat],
                        [bridgeWaypoint.lng, bridgeWaypoint.lat],
                        [bridgeWaypoint.asiaApproach.lng, bridgeWaypoint.asiaApproach.lat]
                    )
                    bridgeWaypointsAdded = 3
                } else {
                    // Asia to Europe: add Asia approach, bridge center, Europe approach
                    coordinates.splice(1, 0,
                        [bridgeWaypoint.asiaApproach.lng, bridgeWaypoint.asiaApproach.lat],
                        [bridgeWaypoint.lng, bridgeWaypoint.lat],
                        [bridgeWaypoint.europeApproach.lng, bridgeWaypoint.europeApproach.lat]
                    )
                    bridgeWaypointsAdded = 3
                }
                console.log(`Forcing route through ${bridgeWaypoint.name} with ${bridgeWaypointsAdded} waypoints`)
            }
        }

        let tripResult;
        if (options.keepOrder) {
            console.log('Keeping original order, using Route service instead of Trip service');
            tripResult = await getRouteWithWaypoints(coordinates);

            // For Route service, the waypoints are in the same order as input
            // We need to construct the result structure similar to Trip service
            tripResult.waypoints = coordinates.map((c, i) => ({
                waypoint_index: i,
                location: c
            }));
        } else {
            tripResult = await getTripOptimization(coordinates);
        }

        // Calculate cumulative metrics from legs
        let currentDuration = 0
        let currentDistance = 0
        const waypointMetrics = {} // Map waypoint_index to { duration, distance }

        // OSRM Trip returns legs between waypoints in optimized order
        // tripResult.legs[i] is the leg from waypoint i to i+1 in the optimized sequence
        // We need to map this back to the original shipment indices

        // The waypoints array tells us the original index of each point in the optimized sequence
        // waypoints[i] corresponds to the i-th point in the optimized path

        tripResult.waypoints.forEach((wp, i) => {
            if (i > 0) {
                const leg = tripResult.legs[i - 1]
                currentDuration += leg.duration * TRAFFIC_FACTOR
                currentDistance += leg.distance
            }
            // Store metrics for this waypoint (using original index)
            waypointMetrics[wp.waypoint_index] = {
                duration: currentDuration,
                distance: currentDistance
            }
        })

        // Map optimized order back to shipments
        const waypointOffset = 1 + bridgeWaypointsAdded // Account for vehicle location + bridge waypoints

        const optimizedShipments = tripResult.waypoints
            .slice(waypointOffset) // Skip vehicle location and bridge waypoints
            .map((waypoint, index) => {
                const shipmentIndex = waypoint.waypoint_index - waypointOffset

                // If shipmentIndex matches validShipments length, it's the End Location (Depot)
                if (shipmentIndex === validShipments.length && options.endLocation) {
                    const metrics = waypointMetrics[waypoint.waypoint_index]
                    return {
                        id: 'depot-return',
                        customer_name: 'Merkez Depo',
                        delivery_address: 'Dönüş',
                        delivery_lat: options.endLocation.lat,
                        delivery_lng: options.endLocation.lng,
                        status: 'returning',
                        type: 'depot',
                        routeOrder: index + 1,
                        eta: calculateETA(metrics.duration, options.departureTime),
                        distance: metrics.distance,
                        isDepotReturn: true
                    }
                }

                // If shipmentIndex is negative, it means this waypoint is one of the bridge waypoints or start point
                if (shipmentIndex < 0) return null

                const shipment = validShipments[shipmentIndex]

                if (!shipment) return null

                const metrics = waypointMetrics[waypoint.waypoint_index]

                return {
                    ...shipment,
                    routeOrder: index + 1,
                    eta: calculateETA(metrics.duration, options.departureTime),
                    distance: metrics.distance // Cumulative distance
                }
            })
            .filter(Boolean) // Remove nulls

        // Sort shipments by delivery time if specified
        // Sort shipments by delivery time ONLY if keepOrder is false
        const finalOrder = options.keepOrder ? optimizedShipments : sortByDeliveryTime(optimizedShipments)

        return {
            optimizedShipments: finalOrder,
            totalDistance: tripResult.distance,
            totalDuration: tripResult.duration * TRAFFIC_FACTOR,
            routes: tripResult.geometry ? [tripResult.geometry] : [],
            legs: tripResult.legs // Return legs for segment rendering
        }
    } catch (error) {
        console.error('Route optimization error:', error)
        // Fallback: return shipments in original order
        return {
            optimizedShipments: validShipments.map((s, i) => ({ ...s, routeOrder: i + 1 })),
            totalDistance: 0,
            totalDuration: 0,
            routes: [],
            error: error.message
        }
    }
}

/**
 * Get route between two points using OSRM
 */
async function getRoute(start, end, bridgePreference = null, startPoint = null, endPoint = null) {
    let coordinates = [start, end]

    // Add bridge waypoint if preference is set and route crosses Bosphorus
    if (bridgePreference && startPoint && endPoint) {
        const bridgeWaypoint = getBridgeWaypoint(bridgePreference)
        if (bridgeWaypoint && crossesBosphorus(startPoint, endPoint)) {
            coordinates = [start, [bridgeWaypoint.lng, bridgeWaypoint.lat], end]
            console.log(`Single route: Forcing through ${bridgeWaypoint.name}`)
        }
    }

    const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';')
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`

    const response = await fetch(url)
    const data = await response.json()

    if (data.code !== 'Ok') {
        throw new Error('OSRM routing failed')
    }

    const route = data.routes[0]
    return {
        distance: route.distance, // meters
        duration: route.duration, // seconds
        geometry: route.geometry.coordinates.map(coord => [coord[1], coord[0]]), // Convert to [lat, lng]
        legs: route.legs // Return legs
    }
}

/**
 * Get optimized trip using OSRM Trip service
 */
async function getTripOptimization(coordinates) {
    const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';')
    const url = `${OSRM_BASE_URL}/trip/v1/driving/${coordString}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson&steps=true`

    const response = await fetch(url)
    const data = await response.json()

    if (data.code !== 'Ok') {
        throw new Error('OSRM trip optimization failed')
    }

    const trip = data.trips[0]
    return {
        distance: trip.distance,
        duration: trip.duration,
        geometry: trip.geometry.coordinates.map(coord => [coord[1], coord[0]]),
        waypoints: data.waypoints,
        legs: trip.legs // Return legs for ETA calculation
    }
}

/**
 * Get route visiting waypoints in order using OSRM Route service
 */
async function getRouteWithWaypoints(coordinates) {
    const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';')
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`

    const response = await fetch(url)
    const data = await response.json()

    if (data.code !== 'Ok') {
        throw new Error('OSRM route calculation failed')
    }

    const route = data.routes[0]
    return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry.coordinates.map(coord => [coord[1], coord[0]]),
        legs: route.legs
    }
}

/**
 * Calculate ETA based on duration and departure time
 */
function calculateETA(durationSeconds, departureTime, legIndex = 0) {
    const now = departureTime ? new Date(departureTime) : new Date()
    const eta = new Date(now.getTime() + (durationSeconds * 1000))
    return eta.toISOString()
}

/**
 * Sort shipments considering delivery time windows
 */
function sortByDeliveryTime(shipments) {
    // If shipments have delivery_time specified, try to respect them
    const withTime = shipments.filter(s => s.delivery_time)
    const withoutTime = shipments.filter(s => !s.delivery_time)

    if (withTime.length === 0) {
        return shipments // Keep optimized order
    }

    // Sort shipments with time by their delivery_time
    withTime.sort((a, b) => {
        const timeA = a.delivery_time.split(':').map(Number)
        const timeB = b.delivery_time.split(':').map(Number)
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1])
    })

    // Interleave shipments without time based on route order
    const result = []
    let withTimeIndex = 0
    let withoutTimeIndex = 0

    shipments.forEach(s => {
        if (s.delivery_time) {
            result.push(withTime[withTimeIndex++])
        } else {
            result.push(withoutTime[withoutTimeIndex++])
        }
    })

    return result.map((s, i) => ({ ...s, routeOrder: i + 1 }))
}

/**
 * Format distance for display
 */
export function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`
    }
    return `${(meters / 1000).toFixed(1)} km`
}

/**
 * Format duration for display
 */
export function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours > 0) {
        return `${hours}s ${minutes}dk`
    }
    return `${minutes}dk`
}

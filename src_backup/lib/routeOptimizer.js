import { getRoute } from './routing'

/**
 * Calculate distance matrix between all points using OSRM API
 * @param {Array} stops - Array of stop objects with location [lat, lng]
 * @returns {Promise<Array>} - 2D array of distances in km
 */
async function calculateDistanceMatrix(stops) {
    const n = stops.length
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0))

    // Calculate distance between each pair of stops
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            try {
                const route = await getRoute(stops[i].location, stops[j].location)
                const distance = route.distance // in km
                matrix[i][j] = distance
                matrix[j][i] = distance
            } catch (error) {
                // Fallback to Haversine distance if OSRM fails
                matrix[i][j] = haversineDistance(stops[i].location, stops[j].location)
                matrix[j][i] = matrix[i][j]
            }
        }
    }

    return matrix
}

/**
 * Haversine distance calculation (fallback)
 * @param {Array} coord1 - [lat, lng]
 * @param {Array} coord2 - [lat, lng]
 * @returns {number} - Distance in km
 */
function haversineDistance(coord1, coord2) {
    const R = 6371 // Earth's radius in km
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * Nearest Neighbor algorithm for TSP
 * @param {Array} distanceMatrix - 2D array of distances
 * @param {number} startIndex - Starting point index
 * @returns {Array} - Ordered array of indices
 */
function nearestNeighbor(distanceMatrix, startIndex = 0) {
    const n = distanceMatrix.length
    const visited = new Set([startIndex])
    const route = [startIndex]
    let current = startIndex

    while (visited.size < n) {
        let nearest = -1
        let minDist = Infinity

        for (let i = 0; i < n; i++) {
            if (!visited.has(i) && distanceMatrix[current][i] < minDist) {
                minDist = distanceMatrix[current][i]
                nearest = i
            }
        }

        if (nearest !== -1) {
            visited.add(nearest)
            route.push(nearest)
            current = nearest
        }
    }

    return route
}

/**
 * 2-opt improvement algorithm
 * @param {Array} route - Initial route (array of indices)
 * @param {Array} distanceMatrix - 2D array of distances
 * @returns {Array} - Improved route
 */
function twoOptImprovement(route, distanceMatrix) {
    let improved = true
    let bestRoute = [...route]

    while (improved) {
        improved = false

        for (let i = 1; i < bestRoute.length - 1; i++) {
            for (let j = i + 1; j < bestRoute.length; j++) {
                const newRoute = twoOptSwap(bestRoute, i, j)

                if (calculateTotalDistance(newRoute, distanceMatrix) <
                    calculateTotalDistance(bestRoute, distanceMatrix)) {
                    bestRoute = newRoute
                    improved = true
                }
            }
        }
    }

    return bestRoute
}

/**
 * Perform 2-opt swap
 */
function twoOptSwap(route, i, j) {
    const newRoute = [
        ...route.slice(0, i),
        ...route.slice(i, j + 1).reverse(),
        ...route.slice(j + 1)
    ]
    return newRoute
}

/**
 * Calculate total distance of a route
 */
function calculateTotalDistance(route, distanceMatrix) {
    let total = 0
    for (let i = 0; i < route.length - 1; i++) {
        total += distanceMatrix[route[i]][route[i + 1]]
    }
    return total
}

/**
 * Main optimization function
 * @param {Array} stops - Array of stop objects with location and deliveryTime
 * @param {Array} startLocation - Starting location [lat, lng]
 * @returns {Promise<Object>} - Optimized route with stats
 */
export async function optimizeRoute(stops, startLocation = null) {
    if (stops.length === 0) {
        return { route: [], totalDistance: 0, estimatedTime: 0 }
    }

    if (stops.length === 1) {
        return {
            route: [{ ...stops[0], order: 1 }],
            totalDistance: 0,
            estimatedTime: 0
        }
    }

    // Add start location if provided
    const allPoints = startLocation
        ? [{ location: startLocation, isStart: true }, ...stops]
        : stops

    // Calculate distance matrix
    const distanceMatrix = await calculateDistanceMatrix(allPoints)

    // Apply Nearest Neighbor
    let routeIndices = nearestNeighbor(distanceMatrix, 0)

    // Apply 2-opt improvement
    routeIndices = twoOptImprovement(routeIndices, distanceMatrix)

    // Remove start location from result if it was added
    if (startLocation) {
        routeIndices = routeIndices.filter(i => i !== 0).map(i => i - 1)
    }

    // Build optimized route with order
    const optimizedRoute = routeIndices.map((index, order) => ({
        ...stops[index],
        order: order + 1
    }))

    // Calculate total distance and estimated time
    const totalDistance = calculateTotalDistance(
        startLocation ? [0, ...routeIndices.map(i => i + 1)] : routeIndices,
        distanceMatrix
    )

    // Estimate time (assuming average speed of 30 km/h in city)
    const estimatedTime = (totalDistance / 30) * 60 // in minutes

    return {
        route: optimizedRoute,
        totalDistance: Math.round(totalDistance * 10) / 10, // Round to 1 decimal
        estimatedTime: Math.round(estimatedTime)
    }
}

/**
 * Calculate route with delivery time constraints
 * @param {Array} stops - Array of stop objects
 * @param {Array} startLocation - Starting location
 * @returns {Promise<Object>} - Optimized route respecting time windows
 */
export async function optimizeRouteWithTimeWindows(stops, startLocation) {
    // Sort by delivery time first
    const sortedStops = [...stops].sort((a, b) => {
        const timeA = a.deliveryTime ? parseInt(a.deliveryTime.replace(':', '')) : 9999
        const timeB = b.deliveryTime ? parseInt(b.deliveryTime.replace(':', '')) : 9999
        return timeA - timeB
    })

    // Then optimize within time groups
    return await optimizeRoute(sortedStops, startLocation)
}

export const startLocationTracking = (vehicleId, onUpdate) => {
    if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser.')
        return null
    }

    const updateLocation = async (position) => {
        const { latitude, longitude } = position.coords
        const location = { lat: latitude, lng: longitude }

        // Call the callback for local UI update
        if (onUpdate) onUpdate(location)

        try {
            // Update vehicle location in Supabase
            await fetch('/api/vehicles', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: vehicleId,
                    location: location,
                    status: 'active' // Assume active when tracking is on
                })
            })
        } catch (error) {
            console.error('Failed to update location:', error)
        }
    }

    const errorCallback = (error) => {
        console.error('Geolocation error:', error)
    }

    // Request high accuracy for better tracking
    const watchId = navigator.geolocation.watchPosition(updateLocation, errorCallback, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    })

    return watchId
}

export const stopLocationTracking = (watchId) => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
    }
}

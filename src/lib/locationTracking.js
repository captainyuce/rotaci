// Location tracking API functions

export async function updateDriverLocation(driverId, location, heading = 0, speed = 0) {
    const res = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, location, heading, speed })
    });
    if (!res.ok) throw new Error('Failed to update location');
    return res.json();
}

export async function getAllDriverLocations() {
    const res = await fetch('/api/location');
    if (!res.ok) throw new Error('Failed to fetch locations');
    return res.json();
}

/**
 * Start tracking driver location using Geolocation API
 * @param {string} driverId - Driver ID
 * @param {Function} onLocationUpdate - Callback when location updates
 * @returns {number} - Watch ID for stopping tracking
 */
export function startLocationTracking(driverId, onLocationUpdate) {
    if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
        async (position) => {
            const location = [
                position.coords.latitude,
                position.coords.longitude
            ];
            const heading = position.coords.heading || 0;
            const speed = position.coords.speed || 0;

            try {
                await updateDriverLocation(driverId, location, heading, speed);
                if (onLocationUpdate) {
                    onLocationUpdate({ location, heading, speed });
                }
            } catch (error) {
                console.error('Failed to update location:', error);
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
        },
        options
    );

    return watchId;
}

/**
 * Stop tracking driver location
 * @param {number} watchId - Watch ID from startLocationTracking
 */
export function stopLocationTracking(watchId) {
    if (navigator.geolocation && watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
}

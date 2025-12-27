'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LocationTracker({ vehicleId }) {
    const lastUpdateRef = useRef(0)
    const watchIdRef = useRef(null)

    useEffect(() => {
        if (!vehicleId) return

        console.log('Starting location tracker for vehicle:', vehicleId)

        if (!('geolocation' in navigator)) {
            console.error('Geolocation is not supported by this browser.')
            return
        }

        const updateLocation = async (position) => {
            const now = Date.now()
            // Limit updates to once every 30 seconds
            if (now - lastUpdateRef.current < 30000) {
                return
            }

            const { latitude, longitude } = position.coords

            console.log('Updating location:', latitude, longitude)

            try {
                const { error } = await supabase
                    .from('vehicles')
                    .update({
                        current_lat: latitude,
                        current_lng: longitude,
                        last_updated: new Date().toISOString()
                    })
                    .eq('id', vehicleId)

                if (error) {
                    console.error('Error updating location:', error)
                } else {
                    lastUpdateRef.current = now
                    console.log('Location updated successfully')
                }
            } catch (err) {
                console.error('Exception updating location:', err)
            }
        }

        const handleError = (error) => {
            console.error('Geolocation error:', error)
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 10000
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            updateLocation,
            handleError,
            options
        )

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
            }
        }
    }, [vehicleId])

    return null // This component doesn't render anything
}

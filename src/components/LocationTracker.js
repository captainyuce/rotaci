'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from './AuthProvider'

export default function LocationTracker() {
    const { user, role } = useAuth()
    const [tracking, setTracking] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (role !== 'driver' || !user?.id) {
            console.log('LocationTracker: Not a driver or no user ID')
            return
        }

        console.log('LocationTracker: Starting for user', user.id)

        let watchId = null

        const startTracking = () => {
            if (!navigator.geolocation) {
                console.error('Geolocation not supported')
                setError('GPS desteklenmiyor')
                return
            }

            console.log('LocationTracker: Requesting GPS permission...')

            // Watch position for real-time GPS updates
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const lat = position.coords.latitude
                    const lng = position.coords.longitude

                    console.log('LocationTracker: GPS position received', { lat, lng })

                    setTracking(true)
                    setError(null)

                    // Update vehicle location in database
                    const { error: updateError } = await supabase
                        .from('vehicles')
                        .update({
                            current_lat: lat,
                            current_lng: lng,
                            status: 'moving',
                            last_updated: new Date().toISOString()
                        })
                        .eq('id', user.id)

                    if (updateError) {
                        console.error('LocationTracker: Database update error', updateError)
                    } else {
                        console.log('LocationTracker: Location updated in database')
                    }
                },
                (error) => {
                    console.error('LocationTracker: GPS error', error.code, error.message)

                    // Try to get position once with relaxed settings
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            const lat = position.coords.latitude
                            const lng = position.coords.longitude

                            console.log('LocationTracker: Fallback GPS position received', { lat, lng })

                            setTracking(true)
                            setError(null)

                            // Update vehicle location in database
                            await supabase
                                .from('vehicles')
                                .update({
                                    current_lat: lat,
                                    current_lng: lng,
                                    status: 'moving',
                                    last_updated: new Date().toISOString()
                                })
                                .eq('id', user.id)
                        },
                        (fallbackError) => {
                            console.error('LocationTracker: Fallback also failed', fallbackError)
                            setTracking(false)
                            setError('Konum alınamadı')

                            // Set vehicle as inactive if GPS fails
                            supabase
                                .from('vehicles')
                                .update({
                                    status: 'idle',
                                    last_updated: new Date().toISOString()
                                })
                                .eq('id', user.id)
                        },
                        {
                            enableHighAccuracy: false, // Use WiFi/IP location
                            timeout: 30000,
                            maximumAge: 60000 // Accept cached location up to 1 minute old
                        }
                    )
                },
                {
                    enableHighAccuracy: false, // Changed to false for better compatibility
                    timeout: 30000, // Increased to 30 seconds
                    maximumAge: 10000 // Accept cached location up to 10 seconds old
                }
            )

            console.log('LocationTracker: GPS watch started with ID', watchId)
        }

        startTracking()

        return () => {
            console.log('LocationTracker: Cleaning up')
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId)
            }
            setTracking(false)

            // Set vehicle as idle when component unmounts
            supabase
                .from('vehicles')
                .update({
                    status: 'idle',
                    last_updated: new Date().toISOString()
                })
                .eq('id', user.id)
        }
    }, [user, role])

    return (
        <div className={`
            w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors
            ${tracking ? 'bg-green-500 text-white' : ''}
            ${!tracking && !error ? 'bg-yellow-400 text-white' : ''}
            ${error ? 'bg-red-500 text-white' : ''}
        `} title={error || (tracking ? 'GPS Aktif' : 'GPS Bekleniyor')}>
            {tracking && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            )}
            {!tracking && !error && (
                <div className="animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                </div>
            )}
            {error && (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.07 4.93 4.93 19.07" /><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            )}
        </div>
    )
}

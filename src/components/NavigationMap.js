'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'

const destinationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

const currentLocationIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

export default function NavigationMap({ destination }) {
    const { user } = useAuth()
    const [currentLocation, setCurrentLocation] = useState(null)
    const [route, setRoute] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Get vehicle location from database
        const fetchVehicleLocation = async () => {
            if (!user?.id) return

            const { data: vehicle } = await supabase
                .from('vehicles')
                .select('current_lat, current_lng, plate')
                .eq('id', user.id)
                .single()

            if (vehicle && vehicle.current_lat && vehicle.current_lng) {
                const location = {
                    lat: vehicle.current_lat,
                    lng: vehicle.current_lng,
                    plate: vehicle.plate
                }
                setCurrentLocation(location)
                fetchRoute(location, destination)
            } else {
                // Fallback to destination area if no vehicle location
                const fallback = {
                    lat: destination.delivery_lat,
                    lng: destination.delivery_lng
                }
                setCurrentLocation(fallback)
                setLoading(false)
            }
        }

        fetchVehicleLocation()

        // Subscribe to vehicle location updates
        const channel = supabase
            .channel('vehicle_location_nav')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'vehicles',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                if (payload.new.current_lat && payload.new.current_lng) {
                    const location = {
                        lat: payload.new.current_lat,
                        lng: payload.new.current_lng,
                        plate: payload.new.plate
                    }
                    setCurrentLocation(location)
                    fetchRoute(location, destination)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [destination, user])

    const fetchRoute = async (origin, dest) => {
        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.delivery_lng},${dest.delivery_lat}?overview=full&geometries=geojson`

            const response = await fetch(url)
            const data = await response.json()

            if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const routeGeometry = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
                setRoute(routeGeometry)
            }
        } catch (error) {
            console.error('Route fetch error:', error)
        } finally {
            setLoading(false)
        }
    }

    if (!currentLocation) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Konum alınıyor...</p>
                </div>
            </div>
        )
    }

    // Calculate center point between current location and destination
    const centerLat = (currentLocation.lat + destination.delivery_lat) / 2
    const centerLng = (currentLocation.lng + destination.delivery_lng) / 2

    return (
        <MapContainer
            center={[centerLat, centerLng]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Current Location Marker */}
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={currentLocationIcon}>
                <Popup>
                    <strong>Mevcut Konumunuz</strong><br />
                    {currentLocation.plate && `Araç: ${currentLocation.plate}`}
                </Popup>
            </Marker>

            {/* Destination Marker */}
            <Marker position={[destination.delivery_lat, destination.delivery_lng]} icon={destinationIcon}>
                <Popup>
                    <strong>{destination.customer_name}</strong><br />
                    {destination.delivery_address}
                </Popup>
            </Marker>

            {/* Route Line */}
            {route && (
                <Polyline
                    positions={route}
                    color="#3b82f6"
                    weight={5}
                    opacity={0.7}
                />
            )}
        </MapContainer>
    )
}

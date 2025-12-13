'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'

// Fix for Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const vehicleIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

const depotIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

const createNumberedIcon = (number, status) => {
    const color = status === 'delivered' ? 'green' : status === 'failed' ? 'red' : 'orange'
    return new L.DivIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color === 'green' ? '#22c55e' : color === 'red' ? '#ef4444' : '#f97316'}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    })
}

function MapBounds({ bounds }) {
    const map = useMap()
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] })
        }
    }, [bounds, map])
    return null
}

export default function DriverRouteMap({ shipments }) {
    const { user } = useAuth()
    const [vehicleLocation, setVehicleLocation] = useState(null)
    const [depotLocation, setDepotLocation] = useState(null)
    const [routeGeometry, setRouteGeometry] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showRoute, setShowRoute] = useState(false) // Toggle for route visibility

    useEffect(() => {
        const fetchData = async () => {
            // Fetch vehicle location
            if (user?.id) {
                const { data: vehicle } = await supabase
                    .from('vehicles')
                    .select('current_lat, current_lng, plate')
                    .eq('id', user.id)
                    .single()

                if (vehicle?.current_lat && vehicle?.current_lng) {
                    setVehicleLocation({
                        lat: vehicle.current_lat,
                        lng: vehicle.current_lng,
                        plate: vehicle.plate
                    })
                }
            }

            // Fetch depot location
            const { data: settings } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'base_address')
                .single()

            if (settings?.value) {
                try {
                    const parsed = JSON.parse(settings.value)
                    if (parsed.lat && parsed.lng) {
                        setDepotLocation(parsed)
                    }
                } catch (e) {
                    console.error('Error parsing depot location:', e)
                }
            }

            setLoading(false)
        }

        fetchData()
    }, [user])

    // Fetch optimized route from admin panel (calculated via API)
    useEffect(() => {
        const fetchOptimizedRoute = async () => {
            if (!user?.id || shipments.length === 0 || !showRoute) return

            try {
                const response = await fetch('/api/optimize-route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicleId: user.id,
                        shipmentIds: shipments
                            .filter(s => s.status !== 'delivered' && s.status !== 'failed')
                            .map(s => s.id),
                        departureTime: new Date().toISOString(),
                        keepOrder: true // Use the order set by admin, don't optimize
                    })
                })

                const data = await response.json()

                if (data.routes && data.routes.length > 0) {
                    setRouteGeometry(data.routes[0])
                }
            } catch (error) {
                console.error('Error fetching optimized route:', error)
            }
        }

        fetchOptimizedRoute()
    }, [user, shipments, showRoute])

    if (loading) return <div className="h-full flex items-center justify-center bg-slate-100">Yükleniyor...</div>

    // Calculate bounds
    const points = []
    if (vehicleLocation) points.push([vehicleLocation.lat, vehicleLocation.lng])
    if (depotLocation) points.push([depotLocation.lat, depotLocation.lng])
    shipments.forEach(s => {
        if (s.delivery_lat && s.delivery_lng) {
            points.push([s.delivery_lat, s.delivery_lng])
        }
    })

    const initialCenter = vehicleLocation
        ? [vehicleLocation.lat, vehicleLocation.lng]
        : depotLocation
            ? [depotLocation.lat, depotLocation.lng]
            : [41.0082, 28.9784] // Istanbul default

    return (
        <div className="relative h-full w-full">
            {/* Route Toggle Button */}
            <button
                onClick={() => setShowRoute(!showRoute)}
                className={`absolute top-4 right-4 z-[1000] px-4 py-2 rounded-lg font-medium shadow-lg transition-colors ${showRoute
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
            >
                {showRoute ? '🗺️ Rotayı Gizle' : '🗺️ Rotayı Göster'}
            </button>

            <MapContainer
                center={initialCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {points.length > 0 && <MapBounds bounds={points} />}

                {/* Vehicle Marker */}
                {vehicleLocation && (
                    <Marker position={[vehicleLocation.lat, vehicleLocation.lng]} icon={vehicleIcon}>
                        <Popup>
                            <strong>Aracınız</strong><br />
                            {vehicleLocation.plate}
                        </Popup>
                    </Marker>
                )}

                {/* Depot Marker */}
                {depotLocation && (
                    <Marker position={[depotLocation.lat, depotLocation.lng]} icon={depotIcon}>
                        <Popup>
                            <strong>Merkez Depo</strong><br />
                            {depotLocation.address}
                        </Popup>
                    </Marker>
                )}

                {/* Shipment Markers */}
                {shipments.map((shipment, index) => {
                    if (!shipment.delivery_lat || !shipment.delivery_lng) return null

                    // Use route_order if available, otherwise index + 1
                    const orderNum = shipment.route_order || (index + 1)

                    return (
                        <Marker
                            key={shipment.id}
                            position={[shipment.delivery_lat, shipment.delivery_lng]}
                            icon={createNumberedIcon(orderNum, shipment.status)}
                        >
                            <Popup>
                                <strong>{orderNum}. {shipment.customer_name}</strong><br />
                                {shipment.delivery_address}<br />
                                <span className={`text-xs font-bold ${shipment.status === 'delivered' ? 'text-green-600' :
                                    shipment.status === 'failed' ? 'text-red-600' : 'text-orange-600'
                                    }`}>
                                    {shipment.status === 'delivered' ? 'Teslim Edildi' :
                                        shipment.status === 'failed' ? 'Başarısız' : 'Bekliyor'}
                                </span>
                            </Popup>
                        </Marker>
                    )
                })}


                {/* Route Line - Shows the route calculated by admin panel */}
                {routeGeometry && (
                    <Polyline
                        positions={routeGeometry}
                        color="#3b82f6"
                        weight={4}
                        opacity={0.7}
                        dashArray="10, 10"
                    />
                )}
            </MapContainer>
        </div>
    )
}

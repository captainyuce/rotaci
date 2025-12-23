'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'
import { supabase } from '@/lib/supabaseClient'
import L from 'leaflet'
import { useDashboard } from '@/contexts/DashboardContext'

// Custom Icons (using simple colors for now, can be enhanced)
const vehicleIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

const shipmentIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

const completedShipmentIcon = new L.divIcon({
    html: `<img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" style="filter: grayscale(100%); width: 25px; height: 41px;">`,
    className: 'bg-transparent',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

const depotIcon = new L.divIcon({
    html: '<div style="font-size: 30px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🏭</div>',
    className: 'bg-transparent',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
})

export default function MapInner() {
    const [vehicles, setVehicles] = useState([])
    const [shipments, setShipments] = useState([])
    const [depotLocation, setDepotLocation] = useState(null)
    const [calculating, setCalculating] = useState(false)
    const { selectedVehicle, optimizedRoutes, setOptimizedRoutes, hiddenShipments = {}, toggleVisibility, activeRouteDate } = useDashboard()

    console.log('MapInner context:', { hiddenShipments, toggleVisibility, activeRouteDate })

    // Helper to determine effective date for filtering
    const getEffectiveDate = (s) => {
        if ((s.status === 'delivered' || s.status === 'unloaded') && s.delivered_at) {
            return new Date(s.delivered_at).toLocaleDateString('en-CA')
        }
        return s.delivery_date
    }

    // Default center (Istanbul)
    const center = [41.0082, 28.9784]

    useEffect(() => {
        fetchData()

        // Realtime Subscription
        const channel = supabase
            .channel('map_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload) => {
                handleVehicleUpdate(payload)
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, (payload) => {
                handleShipmentUpdate(payload)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchData = async () => {
        const { data: vehiclesData } = await supabase.from('vehicles').select('*')
        if (vehiclesData) setVehicles(vehiclesData)

        // Fetch ALL shipments, including delivered ones
        const { data: shipmentsData } = await supabase.from('shipments').select('*')
        if (shipmentsData) setShipments(shipmentsData)

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
    }

    const handleVehicleUpdate = (payload) => {
        if (payload.eventType === 'UPDATE') {
            setVehicles(prev => prev.map(v => v.id === payload.new.id ? payload.new : v))
        } else if (payload.eventType === 'INSERT') {
            setVehicles(prev => [...prev, payload.new])
        } else if (payload.eventType === 'DELETE') {
            setVehicles(prev => prev.filter(v => v.id !== payload.old.id))
        }
    }

    const handleShipmentUpdate = (payload) => {
        if (payload.eventType === 'UPDATE') {
            setShipments(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
        } else if (payload.eventType === 'INSERT') {
            setShipments(prev => [...prev, payload.new])
        } else if (payload.eventType === 'DELETE') {
            setShipments(prev => prev.filter(s => s.id !== payload.old.id))
        }
    }

    const calculateAllRoutes = async () => {
        setCalculating(true)
        const newRoutes = {}

        try {
            await Promise.all(vehicles.map(async (vehicle) => {
                // Only optimize for active shipments (not delivered)
                const vehicleShipments = shipments.filter(s =>
                    s.assigned_vehicle_id === vehicle.id &&
                    s.status !== 'delivered' &&
                    s.status !== 'unloaded' &&
                    s.status !== 'failed'
                )
                if (vehicleShipments.length === 0) return

                try {
                    const response = await fetch('/api/optimize-route', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            vehicleId: vehicle.id,
                            shipmentIds: vehicleShipments.map(s => s.id),
                            departureTime: new Date().toISOString(),
                            keepOrder: true, // Respect DB order
                            saveToDb: false // Don't update DB, just visualize
                        })
                    })

                    const data = await response.json()
                    if (data.routes && data.routes.length > 0) {
                        newRoutes[vehicle.id] = data
                    }
                } catch (err) {
                    console.error(`Error calculating route for vehicle ${vehicle.plate}:`, err)
                }
            }))

            setOptimizedRoutes(newRoutes)
        } catch (error) {
            console.error('Error calculating routes:', error)
            alert('Rotalar hesaplanırken bir hata oluştu.')
        } finally {
            setCalculating(false)
        }
    }

    // Get shipments for selected vehicle
    const selectedVehicleShipments = selectedVehicle
        ? shipments.filter(s => s.assigned_vehicle_id === selectedVehicle.id)
        : []

    // Get optimized route for selected vehicle
    const optimizedRoute = selectedVehicle ? optimizedRoutes[selectedVehicle.id] : null

    return (
        <div className="relative h-full w-full">
            <MapContainer center={center} zoom={11} scrollWheelZoom={true} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                <ZoomControl position="topleft" />
                <style jsx global>{`
                    .leaflet-top.leaflet-left {
                        top: 80px !important;
                        left: 15px !important;
                    }
                `}</style>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Optimized Route Lines - Show for ALL vehicles if available */}
                {/* Optimized Route Lines - Show for ALL vehicles if available */}
                {vehicles.map(vehicle => {
                    const route = optimizedRoutes[vehicle.id]
                    if (!route) return null

                    // Predefined colors for route segments
                    const segmentColors = [
                        '#2563eb', // Blue
                        '#dc2626', // Red
                        '#16a34a', // Green
                        '#d97706', // Amber
                        '#7c3aed', // Violet
                        '#db2777', // Pink
                        '#0891b2', // Cyan
                        '#ea580c', // Orange
                    ]

                    // Check if we have legs (segments)
                    if (route.legs && route.legs.length > 0) {
                        return (
                            <div key={`route-group-${vehicle.id}`}>
                                {route.legs.map((leg, index) => {
                                    // Extract coordinates from steps
                                    const coordinates = leg.steps.flatMap(step =>
                                        step.geometry.coordinates.map(coord => [coord[1], coord[0]])
                                    )

                                    return (
                                        <Polyline
                                            key={`leg-${vehicle.id}-${index}`}
                                            positions={coordinates}
                                            color={segmentColors[index % segmentColors.length]}
                                            weight={5}
                                            opacity={0.8}
                                        />
                                    )
                                })}
                                {/* Finish Marker */}
                                {route.routes && route.routes.length > 0 && route.routes[0].length > 0 && (
                                    <Marker
                                        position={route.routes[0][route.routes[0].length - 1]}
                                        icon={new L.divIcon({
                                            html: '<div style="font-size: 20px;">🏁</div>',
                                            className: 'bg-transparent',
                                            iconSize: [24, 24],
                                            iconAnchor: [12, 12]
                                        })}
                                    >
                                        <Popup>Rota Bitişi ({vehicle.plate})</Popup>
                                    </Marker>
                                )}
                            </div>
                        )
                    }

                    // Fallback to single color route if no legs
                    if (!route.routes || route.routes.length === 0) return null

                    // Generate a consistent color based on vehicle ID or plate
                    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
                    const colorIndex = vehicle.plate.charCodeAt(vehicle.plate.length - 1) % colors.length
                    const color = colors[colorIndex]

                    return (
                        <div key={`route-group-${vehicle.id}`}>
                            {route.routes.map((routeGeometry, index) => (
                                <Polyline
                                    key={`optimized-route-${vehicle.id}-${index}`}
                                    positions={routeGeometry}
                                    color={color}
                                    weight={4}
                                    opacity={0.8}
                                />
                            ))}
                            {/* Finish Marker at the end of the route */}
                            {route.routes.length > 0 && route.routes[0].length > 0 && (
                                <Marker
                                    position={route.routes[0][route.routes[0].length - 1]}
                                    icon={new L.divIcon({
                                        html: '<div style="font-size: 20px;">🏁</div>',
                                        className: 'bg-transparent',
                                        iconSize: [24, 24],
                                        iconAnchor: [12, 12]
                                    })}
                                >
                                    <Popup>Rota Bitişi ({vehicle.plate})</Popup>
                                </Marker>
                            )}
                        </div>
                    )
                })}

                {/* Fallback: Simple lines if no optimized route */}
                {selectedVehicle && !optimizedRoute && selectedVehicle.current_lat && selectedVehicle.current_lng && selectedVehicleShipments.map((shipment, index) => {
                    if (!shipment.delivery_lat || !shipment.delivery_lng) return null

                    return (
                        <Polyline
                            key={`route-${shipment.id}`}
                            positions={[
                                [selectedVehicle.current_lat, selectedVehicle.current_lng],
                                [shipment.delivery_lat, shipment.delivery_lng]
                            ]}
                            color="#3b82f6"
                            weight={3}
                            opacity={0.5}
                            dashArray="10, 10"
                        />
                    )
                })}

                {/* Depot Marker */}
                {depotLocation && (
                    <Marker position={[depotLocation.lat, depotLocation.lng]} icon={depotIcon}>
                        <Popup>
                            <div className="font-sans">
                                <h3 className="font-bold">Merkez Depo</h3>
                                <p className="text-sm">{depotLocation.address}</p>
                                <div className="text-xs text-slate-500 mt-1">🏠 Ana Üs</div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Vehicles */}
                {vehicles.map(vehicle => {
                    // Determine icon based on vehicle type
                    let emoji = '🚐'; // Default (Van/Minivan)

                    if (vehicle.vehicle_type === 'truck') {
                        emoji = '🚛'; // Truck
                    }

                    const dynamicVehicleIcon = new L.divIcon({
                        html: `<div style="font-size: 35px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transform: rotate(${vehicle.heading || 0}deg); transition: transform 0.5s ease;">${emoji}</div>`,
                        className: 'bg-transparent',
                        iconSize: [40, 40],
                        iconAnchor: [20, 20],
                        popupAnchor: [0, -20]
                    });


                    // ... (inside render loop)

                    // Get shipments for this vehicle
                    const vehicleShipments = shipments.filter(s => s.assigned_vehicle_id === vehicle.id)

                    // Filter out hidden shipments for map rendering
                    const visibleShipments = vehicleShipments.filter(s => {
                        if (hiddenShipments[s.id]) return false

                        // If activeRouteDate is set, only show shipments for that date
                        if (activeRouteDate) {
                            return getEffectiveDate(s) === activeRouteDate
                        }

                        return true
                    })

                    const activeShipments = vehicleShipments.filter(s => {
                        // Date filter for list
                        if (activeRouteDate && getEffectiveDate(s) !== activeRouteDate) return false
                        return s.status !== 'delivered' && s.status !== 'unloaded' && s.status !== 'failed'
                    })

                    const completedShipments = vehicleShipments.filter(s => {
                        // Date filter for list
                        if (activeRouteDate && getEffectiveDate(s) !== activeRouteDate) return false
                        return s.status === 'delivered' || s.status === 'unloaded'
                    })

                    // Sort completed shipments by route order or delivered time to draw path
                    const sortedCompleted = [...completedShipments].sort((a, b) => {
                        if (a.route_order && b.route_order) return a.route_order - b.route_order
                        return new Date(a.delivered_at || 0) - new Date(b.delivered_at || 0)
                    })

                    // Create path coordinates for completed shipments
                    // Only include visible shipments in the path
                    const completedPath = sortedCompleted
                        .filter(s => !hiddenShipments[s.id] && s.delivery_lat && s.delivery_lng)
                        .map(s => [s.delivery_lat, s.delivery_lng])

                    return (
                        <div key={`vehicle-group-${vehicle.id}`}>
                            {/* Completed Route Path (Gray) */}
                            {completedPath.length > 1 && (
                                <Polyline
                                    positions={completedPath}
                                    color="#94a3b8" // Slate 400
                                    weight={4}
                                    opacity={0.6}
                                    dashArray="5, 10"
                                />
                            )}

                            {vehicle.current_lat && vehicle.current_lng && (
                                <Marker
                                    key={vehicle.id}
                                    position={[vehicle.current_lat, vehicle.current_lng]}
                                    icon={dynamicVehicleIcon}
                                >
                                    <Popup minWidth={300}>
                                        <div className="font-sans">
                                            {/* ... header ... */}
                                            <div className="border-b border-slate-200 pb-2 mb-2">
                                                <h3 className="font-bold text-lg">{vehicle.plate}</h3>
                                                <p className="text-sm text-slate-600">{vehicle.driver_name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        {vehicle.status === 'moving' ? 'Hareket Halinde' : 'Beklemede'}
                                                    </span>
                                                    {vehicle.speed > 0 && (
                                                        <span className="text-xs font-bold text-blue-600">
                                                            {vehicle.speed} km/s
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {/* ... load status ... */}
                                                <div>
                                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Yük Durumu</p>
                                                    <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                                            style={{ width: `${Math.min((vehicle.current_load / vehicle.capacity) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <p className="text-xs text-slate-700 text-right">
                                                        {vehicle.current_load} / {vehicle.capacity} Palet
                                                    </p>
                                                </div>

                                                {activeShipments.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                                                            Aktif Sevkiyatlar ({activeShipments.length})
                                                        </p>
                                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                                            {activeShipments.map(s => (
                                                                <div key={s.id} className={`text-xs p-1.5 rounded border flex items-center justify-between ${hiddenShipments[s.id] ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-blue-50 border-blue-100'}`}>
                                                                    <div className="truncate flex-1">
                                                                        <div className="font-bold text-slate-800 truncate">{s.customer_name}</div>
                                                                        <div className="text-slate-500 truncate">{s.delivery_address}</div>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            if (typeof toggleVisibility === 'function') {
                                                                                toggleVisibility(s.id)
                                                                            } else {
                                                                                console.error('toggleVisibility is not a function:', toggleVisibility)
                                                                            }
                                                                        }}
                                                                        className="ml-2 p-1 hover:bg-slate-200 rounded text-slate-500"
                                                                        title={hiddenShipments[s.id] ? "Haritada Göster" : "Haritada Gizle"}
                                                                    >
                                                                        {hiddenShipments[s.id] ? '👁️‍🗨️' : '👁️'}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {completedShipments.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">
                                                            Tamamlanan ({completedShipments.length})
                                                        </p>
                                                        <div className="max-h-24 overflow-y-auto space-y-1">
                                                            {completedShipments.map(s => (
                                                                <div key={s.id} className={`text-xs p-1.5 rounded border flex items-center justify-between ${hiddenShipments[s.id] ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-green-50 border-green-100 opacity-75'}`}>
                                                                    <div className="truncate flex-1">
                                                                        <div className="font-bold text-slate-800 truncate flex items-center gap-1">
                                                                            <span>✓</span> {s.customer_name}
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            toggleShipmentVisibility(s.id)
                                                                        }}
                                                                        className="ml-2 p-1 hover:bg-slate-200 rounded text-slate-500"
                                                                        title={hiddenShipments[s.id] ? "Haritada Göster" : "Haritada Gizle"}
                                                                    >
                                                                        {hiddenShipments[s.id] ? '👁️‍🗨️' : '👁️'}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {vehicleShipments.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic text-center py-2">
                                                        Atanmış sevkiyat yok
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            )}
                        </div>
                    )
                })}

                {/* Shipments */}
                {shipments.map(shipment => {
                    // Filter out past shipments (only show today, tomorrow, and future)
                    const today = new Date().toISOString().split('T')[0]
                    const effectiveDate = getEffectiveDate(shipment)

                    if (effectiveDate < today) return null // Hide past shipments

                    // Apply active route date filter
                    if (activeRouteDate && effectiveDate !== activeRouteDate) return null

                    return !hiddenShipments[shipment.id] && shipment.delivery_lat && shipment.delivery_lng && (
                        <Marker
                            key={shipment.id}
                            position={[shipment.delivery_lat, shipment.delivery_lng]}
                            icon={(shipment.status === 'delivered' || shipment.status === 'unloaded') ? completedShipmentIcon : shipmentIcon}
                        >
                            <Popup>
                                <div className="font-sans">
                                    <h3 className="font-bold">{shipment.customer_name}</h3>
                                    <p className="text-sm">{shipment.delivery_address}</p>
                                    <p className="text-xs text-slate-500">{shipment.weight} Palet</p>
                                    {shipment.notes ? (
                                        <div className="mt-2 p-1.5 bg-yellow-50 border border-yellow-100 rounded text-xs text-slate-700 italic">
                                            📝 {shipment.notes}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 mt-1 italic">Not yok</p>
                                    )}
                                    <p className={`text-xs font-medium mt-1 ${shipment.status === 'delivered' || shipment.status === 'unloaded' ? 'text-green-600' : 'text-slate-600'}`}>
                                        Durum: {(shipment.status === 'delivered' || shipment.status === 'unloaded')
                                            ? (shipment.type === 'pickup' ? 'Teslim Alındı' : 'Teslim Edildi')
                                            : 'Bekliyor'}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}

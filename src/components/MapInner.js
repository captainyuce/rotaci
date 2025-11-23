'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
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

export default function MapInner() {
    const [vehicles, setVehicles] = useState([])
    const [shipments, setShipments] = useState([])
    const { selectedVehicle, optimizedRoutes } = useDashboard()

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

        const { data: shipmentsData } = await supabase.from('shipments').select('*').neq('status', 'delivered')
        if (shipmentsData) setShipments(shipmentsData)
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
            // If delivered, remove from map? Or change color?
            // For now, update it.
            setShipments(prev => prev.map(s => s.id === payload.new.id ? payload.new : s))
        } else if (payload.eventType === 'INSERT') {
            setShipments(prev => [...prev, payload.new])
        } else if (payload.eventType === 'DELETE') {
            setShipments(prev => prev.filter(s => s.id !== payload.old.id))
        }
    }

    // Get shipments for selected vehicle
    const selectedVehicleShipments = selectedVehicle
        ? shipments.filter(s => s.assigned_vehicle_id === selectedVehicle.id)
        : []

    // Get optimized route for selected vehicle
    const optimizedRoute = selectedVehicle ? optimizedRoutes[selectedVehicle.id] : null

    return (
        <MapContainer center={center} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Optimized Route Lines - Using actual road geometry */}
            {selectedVehicle && optimizedRoute && optimizedRoute.routes && optimizedRoute.routes.length > 0 && (
                optimizedRoute.routes.map((routeGeometry, index) => (
                    <Polyline
                        key={`optimized-route-${index}`}
                        positions={routeGeometry}
                        color="#3b82f6"
                        weight={4}
                        opacity={0.8}
                    />
                ))
            )}

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

            {/* Vehicles */}
            {vehicles.map(vehicle => {
                // Determine icon based on vehicle type
                let emoji = '🚐'; // Default (Van/Minivan)

                if (vehicle.vehicle_type === 'truck') {
                    emoji = '🚛'; // Truck
                }

                const dynamicVehicleIcon = new L.divIcon({
                    html: `<div style="font-size: 35px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${emoji}</div>`,
                    className: 'bg-transparent',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -20]
                });

                return (
                    vehicle.current_lat && vehicle.current_lng && (
                        <Marker
                            key={vehicle.id}
                            position={[vehicle.current_lat, vehicle.current_lng]}
                            icon={dynamicVehicleIcon}
                        >
                            <Popup>
                                <div className="font-sans">
                                    <h3 className="font-bold">{vehicle.plate}</h3>
                                    <p className="text-sm">{vehicle.driver_name}</p>
                                    <p className="text-xs text-slate-500">
                                        {vehicle.vehicle_type === 'truck' ? 'Kamyon' : 'Panelvan/Minivan'}
                                        {' • '}
                                        Yük: {vehicle.current_load} / {vehicle.capacity} kg
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {vehicle.status === 'moving' ? 'Hareket Halinde' : 'Beklemede'}
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    )
                )
            })}

            {/* Shipments */}
            {shipments.map(shipment => (
                shipment.delivery_lat && shipment.delivery_lng && shipment.status !== 'delivered' && (
                    <Marker
                        key={shipment.id}
                        position={[shipment.delivery_lat, shipment.delivery_lng]}
                        icon={shipmentIcon}
                    >
                        <Popup>
                            <div className="font-sans">
                                <h3 className="font-bold">{shipment.customer_name}</h3>
                                <p className="text-sm">{shipment.delivery_address}</p>
                                <p className="text-xs text-slate-500">{shipment.weight} kg</p>
                                <p className="text-xs font-medium mt-1">
                                    Durum: {shipment.status === 'assigned' ? 'Atandı' : 'Bekliyor'}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                )
            ))}
        </MapContainer>
    )
}

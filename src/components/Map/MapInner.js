'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet'
import { useEffect, useState } from 'react'
import L from 'leaflet'

// Fix for default marker icons in Next.js
const iconUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png';

// Icons will be defined inside the component to avoid SSR issues

function MapEvents({ onMapClick }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng);
        },
    });
    return null;
}

export default function MapInner({ vehicles, onMapClick, selectedLocation, pendingOrders = [] }) {

    const defaultIcon = L.icon({
        iconUrl: iconUrl,
        iconRetinaUrl: iconRetinaUrl,
        shadowUrl: shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
    });

    const truckIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/713/713311.png',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });

    return (
        <MapContainer
            center={[41.0082, 28.9784]}
            zoom={12}
            style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapEvents onMapClick={onMapClick} />

            {selectedLocation && (
                <Marker position={selectedLocation} icon={defaultIcon}>
                    <Popup>Seçilen Konum</Popup>
                </Marker>
            )}

            {/* Pending Orders */}
            {pendingOrders.map(order => (
                <Marker
                    key={`pending-${order.id}`}
                    position={order.location}
                    icon={defaultIcon} // Using default icon for pending, maybe change color later
                    opacity={0.6}
                >
                    <Popup>
                        <strong>{order.customer}</strong><br />
                        Yük: {order.load} kg<br />
                        Saat: {order.deliveryTime}<br />
                        <span style={{ color: 'red' }}>Atanmamış</span>
                    </Popup>
                </Marker>
            ))}

            {vehicles.map(vehicle => (
                <Marker
                    key={vehicle.id}
                    position={vehicle.location}
                    icon={truckIcon}
                >
                    <Popup>
                        <strong>{vehicle.name}</strong><br />
                        Sürücü: {vehicle.driver}<br />
                        Durum: {vehicle.status}
                    </Popup>
                </Marker>
            ))}

            {vehicles.map(vehicle => {
                // Render segments if available (new system)
                if (vehicle.routeSegments && vehicle.routeSegments.length > 0) {
                    return vehicle.routeSegments.map((segment, index) => (
                        <Polyline
                            key={`route-${vehicle.id}-${index}`}
                            positions={segment.coordinates}
                            color={segment.color || 'blue'}
                            weight={5}
                            opacity={0.7}
                        />
                    ));
                }
                // Fallback to old system (simple array)
                else if (vehicle.route && vehicle.route.length > 0) {
                    return (
                        <Polyline
                            key={`route-${vehicle.id}`}
                            positions={vehicle.route}
                            color={vehicle.id === 1 ? 'blue' : vehicle.id === 2 ? 'red' : 'green'}
                        />
                    );
                }
                return null;
            })}
        </MapContainer>
    )
}

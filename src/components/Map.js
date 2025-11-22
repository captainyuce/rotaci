'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in Next.js
const iconUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png'
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png'
const shadowUrl = 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

// Component to update map center when props change
function MapUpdater({ center }) {
    const map = useMap()
    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom())
        }
    }, [center, map])
    return null
}

// Component to handle map clicks
function MapEvents({ onMapClick }) {
    const map = useMap()
    useEffect(() => {
        if (!onMapClick) return

        const handleClick = (e) => {
            onMapClick(e.latlng)
        }

        map.on('click', handleClick)
        return () => map.off('click', handleClick)
    }, [map, onMapClick])
    return null
}

export default function Map({ center, zoom, markers = [], onMapClick, height = '100%' }) {
    return (
        <MapContainer
            center={center || [41.0082, 28.9784]}
            zoom={zoom || 11}
            style={{ height: height, width: '100%', zIndex: 0 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapUpdater center={center} />
            <MapEvents onMapClick={onMapClick} />

            {markers.map((marker, idx) => (
                <Marker
                    key={idx}
                    position={[marker.lat, marker.lng]}
                    icon={marker.icon || DefaultIcon}
                >
                    {marker.popup && <Popup>{marker.popup}</Popup>}
                </Marker>
            ))}
        </MapContainer>
    )
}

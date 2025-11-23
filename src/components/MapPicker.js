'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MapPicker({ center = [41.0082, 28.9784], onLocationSelect }) {
    const mapRef = useRef(null)
    const mapInstanceRef = useRef(null)
    const markerRef = useRef(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted || !mapRef.current || mapInstanceRef.current) return

        // Initialize map
        const map = L.map(mapRef.current).setView(center, 13)
        mapInstanceRef.current = map

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map)

        // Custom marker icon
        const customIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })

        // Add initial marker
        const marker = L.marker(center, { icon: customIcon, draggable: true }).addTo(map)
        markerRef.current = marker

        // Handle map click
        map.on('click', (e) => {
            const { lat, lng } = e.latlng
            marker.setLatLng([lat, lng])
            onLocationSelect(lat, lng)
        })

        // Handle marker drag
        marker.on('dragend', () => {
            const { lat, lng } = marker.getLatLng()
            onLocationSelect(lat, lng)
        })

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }
        }
    }, [mounted, center, onLocationSelect])

    // Update marker position when center changes
    useEffect(() => {
        if (markerRef.current && mapInstanceRef.current) {
            markerRef.current.setLatLng(center)
            mapInstanceRef.current.setView(center, mapInstanceRef.current.getZoom())
        }
    }, [center])

    if (!mounted) {
        return <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
            Harita yükleniyor...
        </div>
    }

    return <div ref={mapRef} className="w-full h-full" />
}

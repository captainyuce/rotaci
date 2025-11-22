'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Truck, Package, AlertCircle } from 'lucide-react'

// Dynamically import Map to avoid SSR issues
const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => <div className="h-96 w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400">Harita Yükleniyor...</div>
})

export default function DashboardPage() {
    const [vehicles, setVehicles] = useState([])
    const [shipments, setShipments] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        try {
            const [vRes, sRes] = await Promise.all([
                fetch('/api/vehicles'),
                fetch('/api/shipments')
            ])

            if (vRes.ok) setVehicles(await vRes.json())
            if (sRes.ok) setShipments(await sRes.json())
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 5000) // Poll every 5 seconds
        return () => clearInterval(interval)
    }, [])

    // Prepare markers for the map
    const markers = [
        ...vehicles.map(v => ({
            lat: v.location?.lat || 41.0082,
            lng: v.location?.lng || 28.9784,
            popup: (
                <div className="p-2">
                    <div className="font-bold text-blue-600">{v.plate}</div>
                    <div className="text-sm">{v.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        Yük: {v.current_load}/{v.capacity} kg
                    </div>
                    <div className={`text-xs font-bold mt-1 ${v.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                        {v.status === 'active' ? 'Hareket Halinde' : 'Beklemede'}
                    </div>
                </div>
            ),
            icon: L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/741/741407.png', // Truck icon
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            })
        })),
        ...shipments.filter(s => s.status === 'pending').map(s => ({
            lat: s.location_lat,
            lng: s.location_lng,
            popup: (
                <div className="p-2">
                    <div className="font-bold">{s.customer}</div>
                    <div className="text-sm">{s.load} kg</div>
                    <div className="text-xs text-orange-600 font-bold mt-1">Bekliyor</div>
                </div>
            )
        }))
    ]

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Aktif Araçlar</p>
                            <h3 className="text-2xl font-bold text-slate-800">
                                {vehicles.filter(v => v.status === 'active').length} / {vehicles.length}
                            </h3>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                            <Truck size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Bekleyen Sevkiyat</p>
                            <h3 className="text-2xl font-bold text-slate-800">
                                {shipments.filter(s => s.status === 'pending').length}
                            </h3>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                            <Package size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Tamamlanan (Bugün)</p>
                            <h3 className="text-2xl font-bold text-slate-800">
                                {shipments.filter(s => s.status === 'delivered').length}
                            </h3>
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <AlertCircle size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Section */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 h-[600px]">
                <h3 className="font-bold text-lg mb-4 text-slate-800">Canlı Harita</h3>
                <div className="h-full rounded-lg overflow-hidden border border-slate-200">
                    <Map markers={markers} height="100%" />
                </div>
            </div>
        </div>
    )
}

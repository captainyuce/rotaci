'use client'

import { useState, useEffect } from 'react'
import { Truck, MapPin, RotateCcw } from 'lucide-react'

export default function VehiclesPage() {
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchVehicles = async () => {
        try {
            const res = await fetch('/api/vehicles')
            if (res.ok) setVehicles(await res.json())
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchVehicles()
        const interval = setInterval(fetchVehicles, 5000)
        return () => clearInterval(interval)
    }, [])

    const resetVehicle = async (id) => {
        if (!confirm('Bu aracın yükünü ve rotasını sıfırlamak istediğinize emin misiniz?')) return
        try {
            const res = await fetch('/api/vehicles', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    current_load: 0,
                    status: 'idle',
                    route: [],
                    route_segments: []
                })
            })
            if (res.ok) fetchVehicles()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Araç Filosu</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{vehicle.plate}</h3>
                                    <p className="text-sm text-slate-500">{vehicle.name}</p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold
                                ${vehicle.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                            `}>
                                {vehicle.status === 'active' ? 'Hareket Halinde' : 'Beklemede'}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Doluluk</span>
                                    <span className="font-bold text-slate-700">{vehicle.current_load} / {vehicle.capacity} kg</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min((vehicle.current_load / vehicle.capacity) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <MapPin size={16} />
                                <span>
                                    {vehicle.location
                                        ? `${vehicle.location.lat.toFixed(4)}, ${vehicle.location.lng.toFixed(4)}`
                                        : 'Konum Yok'}
                                </span>
                            </div>

                            <button
                                onClick={() => resetVehicle(vehicle.id)}
                                className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
                            >
                                <RotateCcw size={16} />
                                Sıfırla
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, MapPin, Navigation, CheckCircle, XCircle, LogOut } from 'lucide-react'
import { startLocationTracking, stopLocationTracking } from '@/lib/locationTracking'

export default function DriverPage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [shipments, setShipments] = useState([])
    const [isTracking, setIsTracking] = useState(false)
    const [watchId, setWatchId] = useState(null)
    const [currentLocation, setCurrentLocation] = useState(null)

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser')
        if (!storedUser) {
            router.push('/login')
            return
        }
        const parsedUser = JSON.parse(storedUser)
        if (parsedUser.role !== 'driver') {
            router.push('/dashboard')
            return
        }
        setUser(parsedUser)
        fetchShipments(parsedUser.vehicleId)
    }, [router])

    const fetchShipments = async (vehicleId) => {
        try {
            const res = await fetch('/api/shipments')
            if (res.ok) {
                const allShipments = await res.json()
                // Filter for this vehicle and not delivered yet (or delivered today)
                const myShipments = allShipments.filter(s =>
                    s.assigned_driver === vehicleId &&
                    (s.status === 'assigned' || s.status === 'pending')
                )
                setShipments(myShipments)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const toggleTracking = () => {
        if (isTracking) {
            stopLocationTracking(watchId)
            setWatchId(null)
            setIsTracking(false)
            // Update status to idle
            if (user?.vehicleId) {
                fetch('/api/vehicles', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: user.vehicleId, status: 'idle' })
                })
            }
        } else {
            const id = startLocationTracking(user.vehicleId, (loc) => {
                setCurrentLocation(loc)
            })
            setWatchId(id)
            setIsTracking(true)
        }
    }

    const updateShipmentStatus = async (id, status) => {
        try {
            const res = await fetch('/api/shipments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            })
            if (res.ok) {
                if (user?.vehicleId) fetchShipments(user.vehicleId)
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleLogout = () => {
        if (isTracking) toggleTracking()
        localStorage.removeItem('currentUser')
        router.push('/login')
    }

    const openNavigation = (lat, lng) => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
    }

    if (!user) return null

    return (
        <div className="min-h-screen bg-slate-100 pb-20">
            {/* Header */}
            <div className="bg-blue-600 text-white p-4 shadow-lg sticky top-0 z-10">
                <div className="flex justify-between items-center mb-2">
                    <h1 className="font-bold text-lg flex items-center gap-2">
                        <Truck /> {user.username}
                    </h1>
                    <button onClick={handleLogout} className="p-2 hover:bg-blue-700 rounded-full">
                        <LogOut size={20} />
                    </button>
                </div>
                <div className="flex justify-between items-center">
                    <div className="text-sm opacity-90">{user.name}</div>
                    <button
                        onClick={toggleTracking}
                        className={`px-4 py-1 rounded-full text-sm font-bold transition-all
                            ${isTracking ? 'bg-green-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}
                        `}
                    >
                        {isTracking ? 'Konum Paylaşılıyor' : 'Takip Kapalı'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {shipments.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        <CheckCircle size={48} className="mx-auto mb-2 opacity-20" />
                        <p>Şu an atanmış aktif görev yok.</p>
                    </div>
                ) : (
                    shipments.map((s) => (
                        <div key={s.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                            <div className="p-4 border-b border-slate-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-800">{s.customer}</h3>
                                        <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                                            <MapPin size={14} />
                                            <span>Konuma Git</span>
                                        </div>
                                    </div>
                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                        {s.delivery_time}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 space-y-2 text-sm text-slate-600">
                                <div className="flex justify-between">
                                    <span>Yük:</span>
                                    <span className="font-medium">{s.load} kg</span>
                                </div>
                                {s.notes && (
                                    <div className="bg-yellow-50 p-2 rounded border border-yellow-100 text-yellow-800 text-xs">
                                        Not: {s.notes}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 divide-x border-t border-slate-200">
                                <button
                                    onClick={() => openNavigation(s.location_lat, s.location_lng)}
                                    className="p-3 flex flex-col items-center justify-center gap-1 hover:bg-slate-50 text-blue-600"
                                >
                                    <Navigation size={20} />
                                    <span className="text-xs font-bold">Yol Tarifi</span>
                                </button>
                                <button
                                    onClick={() => updateShipmentStatus(s.id, 'failed')}
                                    className="p-3 flex flex-col items-center justify-center gap-1 hover:bg-red-50 text-red-600"
                                >
                                    <XCircle size={20} />
                                    <span className="text-xs font-bold">Teslim Edilemedi</span>
                                </button>
                                <button
                                    onClick={() => updateShipmentStatus(s.id, 'delivered')}
                                    className="p-3 flex flex-col items-center justify-center gap-1 hover:bg-green-50 text-green-600"
                                >
                                    <CheckCircle size={20} />
                                    <span className="text-xs font-bold">Teslim Edildi</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

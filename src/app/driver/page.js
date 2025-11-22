'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Map from '@/components/Map/MapComponent'
import { initialVehicles, initialPendingOrders } from '@/lib/data'
import { useRouter } from 'next/navigation'
import { optimizeRoute } from '@/lib/routeOptimizer'
import { Sparkles, Edit3, Navigation, Clock, Package, MapPin } from 'lucide-react'

export default function DriverPage() {
    const router = useRouter()
    const [currentUser, setCurrentUser] = useState(null)
    const [myVehicle, setMyVehicle] = useState(initialVehicles[0])
    const [myShipments, setMyShipments] = useState([])
    const [optimizedRoute, setOptimizedRoute] = useState(null)
    const [isOptimizing, setIsOptimizing] = useState(false)
    const [draggedItem, setDraggedItem] = useState(null)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (!user) {
                router.push('/login');
            } else {
                setCurrentUser(user)
                // Load shipments assigned to this driver
                // For now, using demo data
                setMyShipments(initialPendingOrders.slice(0, 3).map((order, index) => ({
                    ...order,
                    order: index + 1
                })))
            }
        }
    }, []);

    const handleOptimizeRoute = async () => {
        setIsOptimizing(true)
        try {
            const result = await optimizeRoute(myShipments, myVehicle.location)
            setOptimizedRoute(result)
            setMyShipments(result.route)
        } catch (error) {
            console.error('Optimization failed:', error)
            alert('Rota optimizasyonu başarısız oldu!')
        } finally {
            setIsOptimizing(false)
        }
    }

    const handleManualRoute = () => {
        setOptimizedRoute(null)
        // Reset to original order
        setMyShipments(prev => prev.map((s, i) => ({ ...s, order: i + 1 })))
    }

    const handleDragStart = (index) => {
        setDraggedItem(index)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
    }

    const handleDrop = (dropIndex) => {
        if (draggedItem === null) return

        const items = [...myShipments]
        const draggedShipment = items[draggedItem]
        items.splice(draggedItem, 1)
        items.splice(dropIndex, 0, draggedShipment)

        // Update order numbers
        const reordered = items.map((item, index) => ({
            ...item,
            order: index + 1
        }))

        setMyShipments(reordered)
        setDraggedItem(null)
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-blue-600 text-white p-4 shadow-lg">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src="/akalbatu-logo.png" alt="Akalbatu" className="h-6 brightness-0 invert" />
                        <div>
                            <h1 className="text-lg font-bold">Sürücü Paneli</h1>
                            <div className="text-sm opacity-90">{myVehicle.name}</div>
                        </div>
                    </div>
                    <Link href="/" className="text-white hover:underline text-sm">Çıkış</Link>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel - Shipments */}
                <div className="w-96 bg-white border-r overflow-y-auto p-4">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Sevkiyatlarım</h2>
                        <div className="text-sm text-slate-500">{myShipments.length} teslimat</div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                            onClick={handleOptimizeRoute}
                            disabled={isOptimizing || myShipments.length === 0}
                            className="flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            <Sparkles size={18} />
                            {isOptimizing ? 'Hesaplanıyor...' : 'Akıllı Rota'}
                        </button>
                        <button
                            onClick={handleManualRoute}
                            className="flex items-center justify-center gap-2 bg-slate-600 text-white px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors font-medium"
                        >
                            <Edit3 size={18} />
                            Manuel Rota
                        </button>
                    </div>

                    {/* Route Stats */}
                    {optimizedRoute && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                            <div className="text-xs font-bold text-green-700 mb-2">✓ Rota Optimize Edildi</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <div className="text-slate-500 text-xs">Toplam Mesafe</div>
                                    <div className="font-bold text-slate-800">{optimizedRoute.totalDistance} km</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs">Tahmini Süre</div>
                                    <div className="font-bold text-slate-800">{Math.floor(optimizedRoute.estimatedTime / 60)}s {optimizedRoute.estimatedTime % 60}dk</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Shipments List */}
                    <div className="space-y-2">
                        {myShipments.length === 0 ? (
                            <div className="text-center text-slate-400 py-8">
                                <Package size={48} className="mx-auto mb-2 opacity-50" />
                                <div>Henüz atanmış sevkiyat yok</div>
                            </div>
                        ) : (
                            myShipments.map((shipment, index) => (
                                <div
                                    key={shipment.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(index)}
                                    className="bg-white border-2 border-slate-200 rounded-lg p-3 hover:border-blue-400 transition-all cursor-move shadow-sm hover:shadow-md"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                                            {shipment.order}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-800">{shipment.customer}</div>
                                            <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                                                <MapPin size={14} />
                                                <span>{shipment.notes || 'Adres bilgisi'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <Package size={12} />
                                                    {shipment.load} kg
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {shipment.deliveryTime}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {myShipments.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-slate-600">
                            💡 <strong>İpucu:</strong> Sevkiyatları sürükleyerek sıralamayı değiştirebilirsiniz
                        </div>
                    )}
                </div>

                {/* Right Panel - Map */}
                <div className="flex-1 relative">
                    <Map vehicles={[myVehicle]} />

                    {/* Start Route Button */}
                    {myShipments.length > 0 && (
                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[1000]">
                            <button className="bg-green-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-green-700 transition-all flex items-center gap-2 font-bold">
                                <Navigation size={20} />
                                Rotayı Başlat
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

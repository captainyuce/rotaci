'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { Truck, Package, CheckCircle, Zap, Clock, MapPin } from 'lucide-react'
import { formatDistance, formatDuration } from '@/lib/routeOptimizer'
import { useDashboard } from '@/contexts/DashboardContext'
import { logShipmentAction } from '@/lib/auditLog'

export default function AssignmentsPage() {
    const { hasPermission } = useAuth()
    const { optimizedRoutes, setOptimizedRoutes } = useDashboard()
    const [shipments, setShipments] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedShipments, setSelectedShipments] = useState([])
    const [optimizing, setOptimizing] = useState({})

    useEffect(() => {
        // Check permission
        if (!hasPermission(PERMISSIONS.ASSIGN_VEHICLES)) {
            return
        }
        fetchData()
    }, [hasPermission])

    const fetchData = async () => {
        setLoading(true)
        const [shipmentsRes, vehiclesRes] = await Promise.all([
            supabase
                .from('shipments')
                .select('*')
                .in('status', ['pending', 'assigned'])
                .order('created_at', { ascending: false }),
            supabase.from('vehicles').select('*').order('plate')
        ])

        if (shipmentsRes.data) setShipments(shipmentsRes.data)
        if (vehiclesRes.data) setVehicles(vehiclesRes.data)
        setLoading(false)
    }

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('assignments_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shipments'
            }, (payload) => {
                console.log('Real-time update:', payload)
                fetchData() // Refresh data on any shipment change
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'vehicles'
            }, () => {
                fetchData() // Refresh on vehicle changes
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const handleAssign = async (shipmentId, vehicleId) => {
        const status = vehicleId ? 'assigned' : 'pending'

        // Get shipment details for notification and logging
        const { data: shipment } = await supabase
            .from('shipments')
            .select('*')
            .eq('id', shipmentId)
            .single()

        await supabase
            .from('shipments')
            .update({ assigned_vehicle_id: vehicleId || null, status })
            .eq('id', shipmentId)

        // Log the assignment
        if (vehicleId && shipment) {
            console.log('Attempting to log assignment for shipment:', shipmentId)
            try {
                const { data: vehicle } = await supabase
                    .from('vehicles')
                    .select('plate, driver_name')
                    .eq('id', vehicleId)
                    .single()

                // Use user from AuthProvider instead of supabase.auth.getUser()
                // because we are using custom auth
                await logShipmentAction(
                    'assigned',
                    shipmentId,
                    { ...shipment, assigned_vehicle_id: vehicleId, status: 'assigned' },
                    user?.id,
                    user?.full_name || 'Yönetici'
                )
                console.log('Assignment logged successfully')
            } catch (err) {
                console.error('Error logging assignment:', err)
            }
        }

        // Send push notification if assigning to a vehicle
        if (vehicleId && shipment) {
            try {
                await fetch('/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicleId,
                        title: 'Yeni Sevkiyat Atandı',
                        body: `${shipment.customer_name} - ${shipment.delivery_address}`,
                        data: { shipmentId }
                    })
                })
            } catch (error) {
                console.error('Failed to send notification:', error)
            }
        }

        fetchData()
    }

    const handleBulkAssign = async (vehicleId) => {
        if (selectedShipments.length === 0) return

        // Get shipment details for notification
        const { data: shipments } = await supabase
            .from('shipments')
            .select('id, customer_name, delivery_address')
            .in('id', selectedShipments)

        await Promise.all(
            selectedShipments.map(shipmentId =>
                supabase
                    .from('shipments')
                    .update({ assigned_vehicle_id: vehicleId, status: 'assigned' })
                    .eq('id', shipmentId)
            )
        )

        // Send push notification for bulk assignment
        if (shipments && shipments.length > 0) {
            // Log bulk assignment
            try {
                const { data: vehicle } = await supabase
                    .from('vehicles')
                    .select('plate, driver_name')
                    .eq('id', vehicleId)
                    .single()

                // Log each assignment
                for (const shipment of shipments) {
                    console.log('Logging bulk assignment for shipment:', shipment.id)
                    await logShipmentAction(
                        'assigned',
                        shipment.id,
                        { ...shipment, assigned_vehicle_id: vehicleId, status: 'assigned' },
                        user?.id,
                        user?.full_name || 'Yönetici'
                    )
                }
            } catch (err) {
                console.error('Error logging bulk assignment:', err)
            }

            try {
                const shipmentList = shipments.map(s => s.customer_name).join(', ')
                await fetch('/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicleId,
                        title: `${shipments.length} Yeni Sevkiyat Atandı`,
                        body: shipmentList,
                        data: { shipmentIds: selectedShipments }
                    })
                })
            } catch (error) {
                console.error('Failed to send notification:', error)
            }
        }

        setSelectedShipments([])
        fetchData()
    }

    const toggleShipmentSelection = (shipmentId) => {
        setSelectedShipments(prev =>
            prev.includes(shipmentId)
                ? prev.filter(id => id !== shipmentId)
                : [...prev, shipmentId]
        )
    }

    // Automatic optimization when shipments change
    useEffect(() => {
        if (loading || vehicles.length === 0) return

        const timer = setTimeout(() => {
            vehicles.forEach(vehicle => {
                const vehicleShipments = shipments.filter(s => s.assigned_vehicle_id === vehicle.id)

                if (vehicleShipments.length > 0) {
                    // Only optimize if we have shipments
                    optimizeVehicleRoute(vehicle.id, vehicleShipments)
                } else {
                    // Clear optimization if no shipments
                    setOptimizedRoutes(prev => {
                        const newRoutes = { ...prev }
                        delete newRoutes[vehicle.id]
                        return newRoutes
                    })
                }
            })
        }, 1000) // 1 second debounce

        return () => clearTimeout(timer)
    }, [shipments, vehicles, loading])

    const optimizeVehicleRoute = async (vehicleId, currentShipments) => {
        // Don't optimize if already optimizing to prevent race conditions
        if (optimizing[vehicleId]) return

        setOptimizing(prev => ({ ...prev, [vehicleId]: true }))

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId,
                    shipmentIds: currentShipments.map(s => s.id),
                    departureTime: new Date().toISOString()
                })
            })

            const data = await response.json()

            if (response.ok) {
                setOptimizedRoutes(prev => ({ ...prev, [vehicleId]: data }))
            } else {
                console.error('Route optimization failed:', data.error)
            }
        } catch (error) {
            console.error('Optimization error:', error)
        } finally {
            setOptimizing(prev => ({ ...prev, [vehicleId]: false }))
        }
    }

    if (!hasPermission(PERMISSIONS.ASSIGN_VEHICLES)) {
        return (
            <div className="h-full flex flex-col bg-white">
                <div className="p-8 text-center">
                    <div className="text-red-600 text-6xl mb-4">🚫</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Yetkiniz Yok</h2>
                    <p className="text-slate-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
                </div>
            </div>
        )
    }

    const pendingShipments = shipments.filter(s => s.status === 'pending')
    const assignedShipments = shipments.filter(s => s.status === 'assigned')

    return (
        <div className="fixed left-4 right-4 md:left-20 md:right-auto top-20 md:top-4 bottom-20 md:bottom-4 md:w-[600px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto z-10">
            <div className="p-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Araç Atamaları</h2>
                <p className="text-xs text-slate-500">
                    {pendingShipments.length} bekleyen, {assignedShipments.length} atanmış sevkiyat
                </p>
            </div>

            {/* Bulk Assignment Bar */}
            {selectedShipments.length > 0 && (
                <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                        {selectedShipments.length} sevkiyat seçildi
                    </span>
                    <div className="flex gap-2">
                        {vehicles.map(vehicle => (
                            <button
                                key={vehicle.id}
                                onClick={() => handleBulkAssign(vehicle.id)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                                {vehicle.plate}'e Ata
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedShipments([])}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                        >
                            İptal
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
                {/* Pending Shipments */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <Package size={16} className="text-orange-600" />
                        Bekleyen Sevkiyatlar ({pendingShipments.length})
                    </h3>
                    <div className="space-y-2">
                        {pendingShipments.map(shipment => (
                            <div
                                key={shipment.id}
                                className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${selectedShipments.includes(shipment.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedShipments.includes(shipment.id)}
                                            onChange={() => toggleShipmentSelection(shipment.id)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-900">{shipment.customer_name}</h4>
                                            <p className="text-xs text-slate-600 mt-0.5">{shipment.delivery_address}</p>
                                            <div className="flex gap-3 mt-2 text-xs text-slate-500">
                                                <span>⚖️ {shipment.weight} kg</span>
                                                {shipment.delivery_time && <span>🕐 {shipment.delivery_time}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <select
                                        className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                        value={shipment.assigned_vehicle_id || ''}
                                        onChange={(e) => handleAssign(shipment.id, e.target.value)}
                                    >
                                        <option value="">-- Araç Seç --</option>
                                        {vehicles.map(v => (
                                            <option key={v.id} value={v.id}>{v.plate}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                        {pendingShipments.length === 0 && (
                            <p className="text-center text-slate-500 py-8">Bekleyen sevkiyat yok</p>
                        )}
                    </div>
                </div>

                {/* Assigned Shipments - Grouped by Vehicle */}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-600" />
                        Atanmış Sevkiyatlar ({assignedShipments.length})
                    </h3>

                    {vehicles.map(vehicle => {
                        const vehicleShipments = assignedShipments.filter(s => s.assigned_vehicle_id === vehicle.id)
                        if (vehicleShipments.length === 0) return null

                        const optimizedRoute = optimizedRoutes[vehicle.id]
                        const isOptimizing = optimizing[vehicle.id]

                        // Use optimized order if available, otherwise use original order
                        const displayShipments = optimizedRoute?.optimizedShipments || vehicleShipments

                        return (
                            <div key={vehicle.id} className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                                {/* Vehicle Header */}
                                <div className="bg-slate-100 p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Truck size={16} className="text-blue-600" />
                                        <span className="font-bold text-slate-900">{vehicle.plate}</span>
                                        <span className="text-xs text-slate-600">({vehicleShipments.length} sevkiyat)</span>
                                    </div>
                                    {isOptimizing && (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium">
                                            <Zap size={14} className="animate-pulse" />
                                            Rota Hesaplanıyor...
                                        </span>
                                    )}
                                </div>

                                {/* Optimization Summary */}
                                {optimizedRoute && (
                                    <div className="bg-blue-50 border-b border-blue-100 p-2 flex items-center gap-4 text-xs">
                                        <span className="flex items-center gap-1 text-blue-900">
                                            <MapPin size={12} />
                                            <strong>{formatDistance(optimizedRoute.totalDistance)}</strong>
                                        </span>
                                        <span className="flex items-center gap-1 text-blue-900">
                                            <Clock size={12} />
                                            <strong>{formatDuration(optimizedRoute.totalDuration)}</strong>
                                        </span>
                                        <span className="text-blue-700">✨ Optimize edilmiş rota</span>
                                    </div>
                                )}

                                {/* Shipments List */}
                                <div className="divide-y divide-slate-100">
                                    {displayShipments.map((shipment, index) => {
                                        const routeOrder = shipment.routeOrder || (index + 1)

                                        return (
                                            <div key={shipment.id} className="p-3 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-start gap-3">
                                                    {/* Route Order Badge */}
                                                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${optimizedRoute
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-300 text-slate-600'
                                                        }`}>
                                                        {routeOrder}
                                                    </div>

                                                    {/* Shipment Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 truncate">{shipment.customer_name}</h4>
                                                        <p className="text-xs text-slate-600 truncate mt-0.5">{shipment.delivery_address}</p>

                                                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                                            <span className="text-slate-600">⚖️ {shipment.weight} kg</span>
                                                            {shipment.delivery_time && (
                                                                <span className="text-slate-600">🕐 {shipment.delivery_time}</span>
                                                            )}
                                                            {shipment.eta && (
                                                                <span className="text-blue-700 font-medium">
                                                                    ETA: {new Date(shipment.eta).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Remove Assignment Button */}
                                                    <button
                                                        onClick={() => handleAssign(shipment.id, null)}
                                                        className="text-xs text-red-600 hover:text-red-700 font-medium flex-shrink-0"
                                                    >
                                                        Kaldır
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {assignedShipments.length === 0 && (
                        <p className="text-center text-slate-500 py-8">Atanmış sevkiyat yok</p>
                    )}
                </div>
            </div>
        </div>
    )
}

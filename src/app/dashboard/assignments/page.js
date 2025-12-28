'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { Truck, Package, CheckCircle, Zap, Clock, MapPin, GripVertical, XCircle } from 'lucide-react'
import { DragDropContext, Draggable } from 'react-beautiful-dnd'
import { StrictModeDroppable } from '@/components/StrictModeDroppable'
import { formatDistance, formatDuration } from '@/lib/routeOptimizer'
import { useDashboard } from '@/contexts/DashboardContext'
import { logShipmentAction } from '@/lib/auditLog'

export default function AssignmentsPage() {
    const { hasPermission, user } = useAuth()
    const { optimizedRoutes, setOptimizedRoutes } = useDashboard()
    const [shipments, setShipments] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [workers, setWorkers] = useState([]) // New state for workers
    const [loading, setLoading] = useState(true)
    const [selectedShipments, setSelectedShipments] = useState([])
    const [optimizing, setOptimizing] = useState({})
    const [editingVehicle, setEditingVehicle] = useState(null) // ID of vehicle being edited
    const [tempShipments, setTempShipments] = useState({}) // Temporary order during edit
    const [selectedTour, setSelectedTour] = useState({}) // Track selected tour for each vehicle (default: 1)
    const [selectedAssignTour, setSelectedAssignTour] = useState(1) // Tour number for new assignments
    const [shipmentTourSelection, setShipmentTourSelection] = useState({}) // Track tour selection for each pending shipment
    const prevVehicleShipments = useRef({})

    useEffect(() => {
        // Check permission
        if (!hasPermission(PERMISSIONS.ASSIGN_VEHICLES)) {
            return
        }
        fetchData()
    }, [hasPermission])

    const fetchData = async () => {
        setLoading(true)
        const [shipmentsRes, vehiclesRes, workersRes] = await Promise.all([
            supabase
                .from('shipments')
                .select('*')
                .in('status', ['pending', 'assigned'])
                .order('route_order', { ascending: true })
                .order('created_at', { ascending: false }),
            supabase.from('vehicles').select('*').order('plate'),
            supabase.from('users').select('*').eq('role', 'worker').order('full_name')
        ])

        if (shipmentsRes.data) setShipments(shipmentsRes.data)
        if (vehiclesRes.data) setVehicles(vehiclesRes.data)
        if (workersRes.data) setWorkers(workersRes.data)
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

    const handleAssign = async (shipmentId, targetId, targetType = 'vehicle', tourNumber = null) => {
        const status = targetId ? 'assigned' : 'pending'
        const tour = tourNumber || selectedAssignTour || 1

        const updates = {
            status,
            tour_number: targetId ? tour : 1
        }

        if (targetType === 'vehicle') {
            updates.assigned_vehicle_id = targetId || null
            updates.assigned_user_id = null // Clear user assignment if assigning to vehicle
        } else if (targetType === 'worker') {
            updates.assigned_user_id = targetId || null
            updates.assigned_vehicle_id = null // Clear vehicle assignment if assigning to user
        } else {
            // Unassigning
            updates.assigned_vehicle_id = null
            updates.assigned_user_id = null
        }

        // Get shipment details for notification and logging
        const { data: shipment } = await supabase
            .from('shipments')
            .select('*')
            .eq('id', shipmentId)
            .single()

        await supabase
            .from('shipments')
            .update(updates)
            .eq('id', shipmentId)

        // Log the assignment
        if (targetId && shipment) {
            try {
                let assigneeName = 'Bilinmiyor'
                if (targetType === 'vehicle') {
                    const { data: vehicle } = await supabase.from('vehicles').select('plate').eq('id', targetId).single()
                    assigneeName = vehicle?.plate
                } else {
                    const { data: worker } = await supabase.from('users').select('full_name').eq('id', targetId).single()
                    assigneeName = worker?.full_name
                }

                await logShipmentAction(
                    'assigned',
                    shipmentId,
                    { ...shipment, ...updates },
                    user?.id,
                    user?.full_name || 'Yönetici'
                )
            } catch (err) {
                console.error('Error logging assignment:', err)
            }
        }

        // Send push notification
        if (targetId && shipment) {
            try {
                await fetch('/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetId, // Can be vehicleId or userId
                        targetType, // 'vehicle' or 'worker'
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

        const tour = selectedAssignTour || 1

        // Get shipment details for notification
        const { data: shipments } = await supabase
            .from('shipments')
            .select('id, customer_name, delivery_address')
            .in('id', selectedShipments)

        await Promise.all(
            selectedShipments.map(shipmentId =>
                supabase
                    .from('shipments')
                    .update({
                        assigned_vehicle_id: vehicleId,
                        status: 'assigned',
                        tour_number: tour
                    })
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

    const handleStartEdit = (vehicleId, currentShipments) => {
        if (!currentShipments || !Array.isArray(currentShipments)) {
            console.error('Invalid shipments passed to handleStartEdit', currentShipments)
            return
        }
        setEditingVehicle(vehicleId)
        // Deep copy to ensure no reference issues
        setTempShipments(prev => ({
            ...prev,
            [vehicleId]: JSON.parse(JSON.stringify(currentShipments))
        }))
    }

    const handleCancelEdit = () => {
        setEditingVehicle(null)
        setTempShipments({})
    }

    const handleSaveOrder = async (vehicleId) => {
        const shipmentsToSave = tempShipments[vehicleId]
        if (!shipmentsToSave) return

        try {
            // 1. Update DB with new order
            await Promise.all(shipmentsToSave.map((s, index) =>
                supabase.from('shipments').update({ route_order: index + 1 }).eq('id', s.id)
            ))

            // 2. Update local shipments state to reflect saved order
            setShipments(prev => {
                const newMap = prev.map(s => {
                    const updated = shipmentsToSave.find(us => us.id === s.id)
                    return updated ? { ...s, route_order: shipmentsToSave.indexOf(updated) + 1 } : s
                })
                return newMap
            })

            // 3. Calculate route geometry for the new manual order (keepOrder: true)
            await optimizeVehicleRoute(vehicleId, shipmentsToSave, true)

            // 4. Exit edit mode
            handleCancelEdit()

        } catch (error) {
            console.error('Error saving route order:', error)
            alert('Sıralama kaydedilirken bir hata oluştu.')
        }
    }

    const handleAutoOptimize = async (vehicleId, currentShipments) => {
        if (confirm('Otomatik optimizasyon mevcut sıralamayı değiştirecektir. Emin misiniz?')) {
            try {
                // 1. Call optimization API (keepOrder: false)
                const result = await optimizeVehicleRoute(vehicleId, currentShipments, false)

                if (result && result.optimizedShipments) {
                    // 2. Update DB with optimized order
                    await Promise.all(result.optimizedShipments.map((s, index) =>
                        supabase.from('shipments').update({ route_order: index + 1 }).eq('id', s.id)
                    ))

                    // 3. Update local shipments state
                    setShipments(prev => {
                        const newMap = prev.map(s => {
                            const updated = result.optimizedShipments.find(us => us.id === s.id)
                            return updated ? { ...s, route_order: result.optimizedShipments.indexOf(updated) + 1 } : s
                        })
                        return newMap
                    })
                }
            } catch (error) {
                console.error('Auto optimization error:', error)
                alert('Optimizasyon sırasında bir hata oluştu.')
            }
        }
    }

    const onDragEnd = (result) => {
        const { destination, source } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        const vehicleId = source.droppableId

        // Only allow dragging if editing this vehicle
        if (editingVehicle !== vehicleId) return

        const currentList = tempShipments[vehicleId] || []
        const newShipments = Array.from(currentList)
        const [movedShipment] = newShipments.splice(source.index, 1)
        newShipments.splice(destination.index, 0, movedShipment)

        // Update temp state
        setTempShipments(prev => ({
            ...prev,
            [vehicleId]: newShipments
        }))
    }

    // Tour Management Functions
    const getVehicleTours = (vehicleId) => {
        const vehicleShipments = shipments.filter(s => s.assigned_vehicle_id === vehicleId)
        const tours = [...new Set(vehicleShipments.map(s => s.tour_number || 1))].sort((a, b) => a - b)
        return tours.length > 0 ? tours : [1]
    }

    const handleChangeTour = (vehicleId, tourNumber) => {
        setSelectedTour(prev => ({
            ...prev,
            [vehicleId]: tourNumber
        }))
    }

    const getMaxTourNumber = (vehicleId) => {
        const tours = getVehicleTours(vehicleId)
        return tours.length > 0 ? Math.max(...tours) : 0
    }

    // Automatic optimization disabled - now manual via button
    // useEffect(() => {
    //     if (loading || vehicles.length === 0) return

    //     const timer = setTimeout(() => {
    //         vehicles.forEach(vehicle => {
    //             const vehicleShipments = shipments.filter(s => s.assigned_vehicle_id === vehicle.id)

    //             // Create a signature based on sorted IDs to detect if composition changed
    //             const currentIds = vehicleShipments.map(s => s.id).sort().join(',')
    //             const prevIds = prevVehicleShipments.current[vehicle.id]

    //             // Only optimize if the set of shipments changed (added/removed)
    //             // This prevents re-optimization when user manually reorders (which changes shipments state but not IDs)
    //             if (currentIds !== prevIds) {
    //                 if (vehicleShipments.length > 0) {
    //                     optimizeVehicleRoute(vehicle.id, vehicleShipments)
    //                 } else {
    //                     // Clear optimization if no shipments
    //                     setOptimizedRoutes(prev => {
    //                         const newRoutes = { ...prev }
    //                         delete newRoutes[vehicle.id]
    //                         return newRoutes
    //                     })
    //                 }
    //                 // Update ref
    //                 prevVehicleShipments.current[vehicle.id] = currentIds
    //             }
    //         })
    //     }, 1000) // 1 second debounce

    //     return () => clearTimeout(timer)
    // }, [shipments, vehicles, loading])

    const optimizeVehicleRoute = async (vehicleId, currentShipments, keepOrder = false) => {
        // Don't optimize if already optimizing to prevent race conditions
        if (optimizing[vehicleId]) return null

        setOptimizing(prev => ({ ...prev, [vehicleId]: true }))

        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId,
                    shipmentIds: currentShipments.map(s => s.id),
                    departureTime: new Date().toISOString(),
                    keepOrder // Pass keepOrder flag
                })
            })

            const data = await response.json()

            if (response.ok) {
                setOptimizedRoutes(prev => ({ ...prev, [vehicleId]: data }))
                return data
            } else {
                console.error('Route optimization failed:', data.error)
                return null
            }
        } catch (error) {
            console.error('Optimization error:', error)
            return null
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
                <div className="p-3 bg-zinc-50 border-b border-zinc-200">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-zinc-900">
                            {selectedShipments.length} sevkiyat seçildi
                        </span>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-700">Tur:</label>
                            <select
                                value={selectedAssignTour}
                                onChange={(e) => setSelectedAssignTour(parseInt(e.target.value))}
                                className="text-xs border border-zinc-300 rounded px-2 py-1 bg-white"
                            >
                                <option value={1}>1. Tur</option>
                                <option value={2}>2. Tur</option>
                                <option value={3}>3. Tur</option>
                                <option value={4}>4. Tur</option>
                                <option value={5}>5. Tur</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {vehicles.map(vehicle => (
                            <button
                                key={vehicle.id}
                                onClick={() => handleBulkAssign(vehicle.id)}
                                className="px-3 py-1.5 bg-primary hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition-colors"
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
                                className={`bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${selectedShipments.includes(shipment.id) ? 'border-primary bg-zinc-50' : 'border-slate-200'
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
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-slate-900">{shipment.customer_name}</h4>
                                                {shipment.preparation_status === 'ready' && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 border border-green-200" title={`Hazırlayan: ${shipment.prepared_by_name || 'Bilinmiyor'}`}>
                                                        📦 Hazır
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5">{shipment.delivery_address}</p>
                                            <div className="flex gap-3 mt-2 text-xs text-slate-500">
                                                <span>📦 {shipment.weight} Palet</span>
                                                {shipment.delivery_time && <span>🕐 {shipment.delivery_time}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <select
                                            className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                            value={shipment.assigned_vehicle_id ? `vehicle:${shipment.assigned_vehicle_id}` : (shipment.assigned_user_id ? `worker:${shipment.assigned_user_id}` : '')}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                if (!value) return handleAssign(shipment.id, null)

                                                const [type, id] = value.split(':')
                                                const tourNum = shipmentTourSelection[shipment.id] || 1
                                                handleAssign(shipment.id, id, type, tourNum)
                                            }}
                                        >
                                            <option value="">-- Ata --</option>
                                            <optgroup label="Araçlar">
                                                {vehicles.map(v => (
                                                    <option key={v.id} value={`vehicle:${v.id}`}>{v.plate}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Çalışanlar (Ayaklı)">
                                                {workers.map(w => (
                                                    <option key={w.id} value={`worker:${w.id}`}>{w.full_name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <select
                                            className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                            value={shipmentTourSelection[shipment.id] || 1}
                                            onChange={(e) => setShipmentTourSelection(prev => ({
                                                ...prev,
                                                [shipment.id]: parseInt(e.target.value)
                                            }))}
                                        >
                                            <option value={1}>1. Tur</option>
                                            <option value={2}>2. Tur</option>
                                            <option value={3}>3. Tur</option>
                                            <option value={4}>4. Tur</option>
                                            <option value={5}>5. Tur</option>
                                        </select>
                                    </div>
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

                    <DragDropContext onDragEnd={onDragEnd}>
                        {vehicles.map(vehicle => {
                            const allVehicleShipments = assignedShipments
                                .filter(s => s.assigned_vehicle_id === vehicle.id)

                            if (allVehicleShipments.length === 0) return null

                            const tours = getVehicleTours(vehicle.id)
                            const currentTour = selectedTour[vehicle.id] || 1

                            const vehicleShipments = allVehicleShipments
                                .filter(s => (s.tour_number || 1) === currentTour)
                                .sort((a, b) => (a.route_order || 0) - (b.route_order || 0))

                            const optimizedRoute = optimizedRoutes[`${vehicle.id}-${currentTour}`] || optimizedRoutes[vehicle.id]
                            const isOptimizing = optimizing[vehicle.id]

                            // Use temp shipments if editing, otherwise optimized or default order
                            let displayShipments = []
                            if (editingVehicle === vehicle.id && tempShipments[vehicle.id]) {
                                displayShipments = tempShipments[vehicle.id]
                            } else {
                                displayShipments = optimizedRoute?.optimizedShipments || vehicleShipments
                            }

                            return (
                                <div key={vehicle.id} className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                                    {/* Vehicle Header */}
                                    <div className="bg-slate-100 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Truck size={16} className="text-primary" />
                                                <span className="font-bold text-slate-900">{vehicle.plate}</span>
                                                <span className="text-xs text-slate-600">({allVehicleShipments.length} toplam sevkiyat)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-slate-700">Tur:</label>
                                                <select
                                                    value={currentTour}
                                                    onChange={(e) => handleChangeTour(vehicle.id, parseInt(e.target.value))}
                                                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium"
                                                >
                                                    {tours.map(tour => (
                                                        <option key={tour} value={tour}>
                                                            {tour}. Tur ({allVehicleShipments.filter(s => (s.tour_number || 1) === tour).length})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-600">{currentTour}. Turda {vehicleShipments.length} sevkiyat</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {editingVehicle === vehicle.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSaveOrder(vehicle.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        <CheckCircle size={14} />
                                                        Kaydet
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        <XCircle size={14} />
                                                        İptal
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleStartEdit(vehicle.id, displayShipments)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        <GripVertical size={14} />
                                                        Sıralamayı Düzenle
                                                    </button>

                                                    {!isOptimizing ? (
                                                        <button
                                                            onClick={() => handleAutoOptimize(vehicle.id, vehicleShipments)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                                                        >
                                                            <Zap size={14} />
                                                            Otomatik Optimize Et
                                                        </button>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium">
                                                            <Zap size={14} className="animate-pulse" />
                                                            Hesaplanıyor...
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Optimization Summary */}
                                    {optimizedRoute && (
                                        <div className="bg-zinc-50 border-b border-blue-100 p-2 flex items-center gap-4 text-xs">
                                            <span className="flex items-center gap-1 text-zinc-900">
                                                <MapPin size={12} />
                                                <strong>{formatDistance(optimizedRoute.totalDistance)}</strong>
                                            </span>
                                            <span className="flex items-center gap-1 text-zinc-900">
                                                <Clock size={12} />
                                                <strong>{formatDuration(optimizedRoute.totalDuration)}</strong>
                                            </span>
                                            <span className="text-zinc-700">✨ Optimize edilmiş rota</span>
                                        </div>
                                    )}

                                    {/* Shipments List */}
                                    <StrictModeDroppable droppableId={vehicle.id}>
                                        {(provided) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className="divide-y divide-slate-100"
                                            >
                                                {displayShipments.map((shipment, index) => {
                                                    const routeOrder = index + 1

                                                    return (
                                                        <Draggable
                                                            key={shipment.id}
                                                            draggableId={String(shipment.id)}
                                                            index={index}
                                                            isDragDisabled={editingVehicle !== vehicle.id}
                                                        >
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    className={`p-3 transition-colors ${snapshot.isDragging ? 'bg-blue-50 shadow-lg' : 'hover:bg-slate-50'}`}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        {/* Drag Handle - Only show when editing */}
                                                                        {editingVehicle === vehicle.id && (
                                                                            <div
                                                                                {...provided.dragHandleProps}
                                                                                className="mt-1 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                                                                            >
                                                                                <GripVertical size={16} />
                                                                            </div>
                                                                        )}

                                                                        {/* Route Order Badge */}
                                                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${optimizedRoute
                                                                            ? 'bg-primary text-white'
                                                                            : 'bg-slate-300 text-slate-600'
                                                                            }`}>
                                                                            {routeOrder}
                                                                        </div>

                                                                        {/* Shipment Info */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className="font-bold text-slate-900 truncate">{shipment.customer_name}</h4>
                                                                            <p className="text-xs text-slate-600 truncate mt-0.5">{shipment.delivery_address}</p>

                                                                            <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                                                                <span className="text-slate-600">📦 {shipment.weight} Palet</span>
                                                                                {shipment.delivery_time && (
                                                                                    <span className="text-slate-600">🕐 {shipment.delivery_time}</span>
                                                                                )}
                                                                                {shipment.eta && (
                                                                                    <span className="text-zinc-700 font-medium">
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
                                                            )}
                                                        </Draggable>
                                                    )
                                                })}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </StrictModeDroppable>
                                </div>
                            )
                        })}
                    </DragDropContext>

                    {assignedShipments.length === 0 && (
                        <p className="text-center text-slate-500 py-8">Atanmış sevkiyat yok</p>
                    )}
                </div>
            </div>
        </div>
    )
}

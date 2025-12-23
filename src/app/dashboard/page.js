'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Truck, Package, Navigation, X } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'

export default function DashboardPage() {
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const { selectedVehicle, setSelectedVehicle, calculateVehicleRoute, calculatingVehicleId, optimizedRoutes, hideVehicleRoute, hiddenShipments = {}, toggleVisibility, activeRouteDate, setActiveRouteDate } = useDashboard()

    useEffect(() => {
        console.log('DashboardPage context check:', {
            hasToggle: !!toggleVisibility,
            toggleType: typeof toggleVisibility,
            hiddenShipmentsKeys: Object.keys(hiddenShipments),
            activeRouteDate
        })
    }, [toggleVisibility, hiddenShipments, activeRouteDate])

    // ... (rest of the file)


    const handleCalculateRoute = async (vehicle, dateType) => {
        // dateType: 'today' or 'tomorrow'
        const today = new Date()
        const targetDate = new Date(today)

        if (dateType === 'tomorrow') {
            targetDate.setDate(today.getDate() + 1)
        }

        const dateStr = targetDate.toLocaleDateString('en-CA') // YYYY-MM-DD
        console.log(`Calculating route for ${vehicle.plate} on ${dateStr} (${dateType})`)

        setActiveRouteDate(dateStr)

        // Fetch shipments for this vehicle first to get the latest IDs
        const { data: shipments } = await supabase
            .from('shipments')
            .select('id, delivery_date')
            .eq('assigned_vehicle_id', vehicle.id)
            .neq('status', 'delivered')
            .neq('status', 'unloaded')
            .eq('delivery_date', dateStr)

        if (shipments && shipments.length > 0) {
            await calculateVehicleRoute(vehicle.id, shipments.map(s => s.id))
        } else {
            alert(`${dateType === 'today' ? 'Bugün' : 'Yarın'} için hesaplanacak aktif sevkiyat bulunamadı.`)
        }
    }

    const selectedVehicleRef = useRef(selectedVehicle)

    useEffect(() => {
        selectedVehicleRef.current = selectedVehicle
    }, [selectedVehicle])

    useEffect(() => {
        fetchVehicles()

        const channel = supabase
            .channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => fetchVehicles())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
                fetchVehicles()
                // Refresh modal shipments if a vehicle is selected
                if (selectedVehicleRef.current) {
                    fetchVehicleShipments(selectedVehicleRef.current.id)
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchVehicles = async () => {
        setLoading(true)
        const { data: vehiclesData } = await supabase
            .from('vehicles')
            .select('*')
            .order('plate')

        if (vehiclesData) {
            const vehiclesWithStats = await Promise.all(vehiclesData.map(async (vehicle) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const todayStr = today.toLocaleDateString('en-CA')
                const tomorrow = new Date(today)
                tomorrow.setDate(tomorrow.getDate() + 1)
                const tomorrowStr = tomorrow.toLocaleDateString('en-CA')

                const { data: shipments } = await supabase
                    .from('shipments')
                    .select('*')
                    .eq('assigned_vehicle_id', vehicle.id)

                let total = 0
                let todayCount = 0
                let tomorrowCount = 0
                let delivered = 0
                let currentLoad = 0

                shipments?.forEach(s => {
                    // Determine effective date
                    let effectiveDate = s.delivery_date
                    if ((s.status === 'delivered' || s.status === 'unloaded') && s.delivered_at) {
                        // Convert UTC to local date
                        const deliveredDate = new Date(s.delivered_at)
                        effectiveDate = deliveredDate.toLocaleDateString('en-CA')
                    }

                    // Count by date
                    if (effectiveDate === todayStr) todayCount++
                    if (effectiveDate === tomorrowStr) tomorrowCount++

                    // Total: Only count today and tomorrow
                    if (effectiveDate === todayStr || effectiveDate === tomorrowStr) {
                        total++

                        // Delivered: Count if status is delivered or unloaded AND within today/tomorrow
                        if (s.status === 'delivered' || s.status === 'unloaded') {
                            delivered++
                        }
                    }

                    // Load Calculation (for all shipments, regardless of date)
                    const weight = Number(s.weight) || 0
                    if (s.type === 'pickup') {
                        // For pickups: Only count if status is 'delivered' (meaning picked up and on truck)
                        if (s.status === 'delivered') currentLoad += weight
                    } else {
                        // For deliveries: Count if assigned but not yet delivered/unloaded
                        if (s.status !== 'delivered' && s.status !== 'unloaded') currentLoad += weight
                    }
                })

                return {
                    ...vehicle,
                    current_load: currentLoad,
                    stats: { total, delivered, todayCount, tomorrowCount }
                }
            }))
            setVehicles(vehiclesWithStats)
        }
        setLoading(false)
    }

    const [vehicleShipments, setVehicleShipments] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('today') // 'today' or 'tomorrow'

    const handleVehicleClick = async (vehicle) => {
        if (selectedVehicle?.id === vehicle.id) {
            // If clicking the same vehicle, just toggle the modal if it's closed, or do nothing (or deselect)
            // But user wants to see shipments, so let's open modal
            setIsModalOpen(true)
            await fetchVehicleShipments(vehicle.id)
        } else {
            setSelectedVehicle(vehicle)
            setIsModalOpen(true)
            await fetchVehicleShipments(vehicle.id)
        }
    }

    const fetchVehicleShipments = async (vehicleId) => {
        console.log('Fetching shipments for vehicle:', vehicleId)
        const { data, error } = await supabase
            .from('shipments')
            .select('*')
            .eq('assigned_vehicle_id', vehicleId)
            .order('delivery_time', { ascending: true })

        if (error) {
            console.error('Error fetching vehicle shipments:', error)
            return
        }

        if (data) {
            // Show all assigned shipments regardless of date
            // But still sort by delivery time/date
            const sorted = data.sort((a, b) => {
                const dateA = new Date(a.delivery_date || a.created_at)
                const dateB = new Date(b.delivery_date || b.created_at)
                return dateA - dateB
            })
            setVehicleShipments(sorted)
        }
    }

    return (
        <>
            {/* Vehicle Status Cards - Fixed at Bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-white via-white to-transparent pb-safe pointer-events-none">
                <div className="px-2 md:px-4 py-3 md:py-4 overflow-x-auto pointer-events-auto">
                    <div className="flex gap-2 md:gap-3 min-w-max pb-2">
                        {vehicles.map((vehicle) => (
                            <div
                                key={vehicle.id}
                                onClick={() => handleVehicleClick(vehicle)}
                                className={`bg-white rounded-lg md:rounded-xl shadow-lg border p-3 md:p-4 min-w-[240px] md:min-w-[280px] hover:shadow-xl transition-all cursor-pointer ${selectedVehicle?.id === vehicle.id
                                    ? 'border-primary ring-2 ring-blue-200'
                                    : 'border-slate-200'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2 md:mb-3">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <div className="p-1.5 md:p-2 bg-zinc-50 rounded-lg">
                                            <Truck size={18} className="text-primary md:w-5 md:h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-sm md:text-base">{vehicle.plate}</h3>
                                            <p className="text-xs text-slate-500">{vehicle.driver_name}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 md:py-1 rounded-full text-xs font-medium ${vehicle.status === 'moving' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {vehicle.status === 'moving' ? 'Yolda' : 'Bekliyor'}
                                    </span>
                                </div>

                                <div className="space-y-1.5 md:space-y-2">
                                    <div className="flex justify-between text-xs md:text-sm">
                                        <span className="text-slate-600 flex items-center gap-1">
                                            <Package size={12} className="md:w-3.5 md:h-3.5" />
                                            Teslimat
                                        </span>
                                        <span className="font-bold text-primary">
                                            {vehicle.stats?.delivered}/{vehicle.stats?.total}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 md:h-2 overflow-hidden">
                                        <div
                                            className="bg-primary h-1.5 md:h-2 rounded-full transition-all duration-500"
                                            style={{ width: `${vehicle.stats?.total ? (vehicle.stats.delivered / vehicle.stats.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>

                                    <div className="flex justify-between text-xs md:text-sm pt-1.5 md:pt-2 border-t border-slate-100">
                                        <span className="text-slate-600">Yük</span>
                                        <span className="font-medium text-slate-900">{vehicle.current_load} Palet</span>
                                    </div>
                                </div>

                                {vehicle.stats?.total > 0 && (
                                    <div className="mt-2 md:mt-3 flex gap-2">
                                        {optimizedRoutes[vehicle.id] ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    hideVehicleRoute(vehicle.id)
                                                    setActiveRouteDate(null)
                                                }}
                                                className="w-full flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                            >
                                                <X size={12} className="md:w-3.5 md:h-3.5" />
                                                Rotayı Gizle
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCalculateRoute(vehicle, 'today')
                                                    }}
                                                    disabled={calculatingVehicleId === vehicle.id}
                                                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${calculatingVehicleId === vehicle.id
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                                        }`}
                                                >
                                                    {calculatingVehicleId === vehicle.id ? (
                                                        <span className="animate-spin">⌛</span>
                                                    ) : (
                                                        <Navigation size={12} />
                                                    )}
                                                    Bugün
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleCalculateRoute(vehicle, 'tomorrow')
                                                    }}
                                                    disabled={calculatingVehicleId === vehicle.id}
                                                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${calculatingVehicleId === vehicle.id
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                                        }`}
                                                >
                                                    {calculatingVehicleId === vehicle.id ? (
                                                        <span className="animate-spin">⌛</span>
                                                    ) : (
                                                        <Navigation size={12} />
                                                    )}
                                                    Yarın
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Vehicle Shipments Modal */}
            {isModalOpen && selectedVehicle && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 pointer-events-auto" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b pb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">{selectedVehicle.plate}</h3>
                                <p className="text-sm text-slate-500">{selectedVehicle.driver_name} - Yük: {selectedVehicle.current_load} Palet</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('today')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'today'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Bugün
                            </button>
                            <button
                                onClick={() => setActiveTab('tomorrow')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'tomorrow'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Yarın
                            </button>
                        </div>

                        <div className="space-y-3">
                            {(() => {
                                // Filter shipments based on active tab
                                const todayStr = new Date().toLocaleDateString('en-CA')
                                const tomorrow = new Date()
                                tomorrow.setDate(tomorrow.getDate() + 1)
                                const tomorrowStr = tomorrow.toLocaleDateString('en-CA')

                                const filteredShipments = vehicleShipments.filter(s => {
                                    // Helper to determine effective date
                                    let effectiveDate = s.delivery_date
                                    if ((s.status === 'delivered' || s.status === 'unloaded') && s.delivered_at) {
                                        // Convert UTC timestamp to local date string
                                        const deliveredDate = new Date(s.delivered_at)
                                        effectiveDate = deliveredDate.toLocaleDateString('en-CA')
                                    }

                                    if (activeTab === 'today') {
                                        return effectiveDate === todayStr
                                    } else {
                                        return effectiveDate === tomorrowStr
                                    }
                                })

                                if (filteredShipments.length === 0) {
                                    return (
                                        <p className="text-center text-slate-500 py-8">
                                            {activeTab === 'today' ? 'Bugün' : 'Yarın'} için sevkiyat bulunmuyor.
                                        </p>
                                    )
                                }

                                return filteredShipments.map((shipment, index) => (
                                    <div key={shipment.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{index + 1}</span>
                                                {shipment.customer_name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        if (typeof toggleVisibility === 'function') {
                                                            toggleVisibility(shipment.id)
                                                        } else {
                                                            console.error('toggleVisibility is not a function:', toggleVisibility)
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-500"
                                                    title={hiddenShipments[shipment.id] ? "Haritada Göster" : "Haritada Gizle"}
                                                >
                                                    {hiddenShipments[shipment.id] ? '👁️‍🗨️' : '👁️'}
                                                </button>
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                                                    {shipment.delivery_time}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">{shipment.delivery_address}</p>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500">{shipment.weight} Palet</span>
                                            <span className={`px-2 py-0.5 rounded-full font-medium ${shipment.status === 'delivered' || shipment.status === 'unloaded' ? 'bg-green-100 text-green-700' :
                                                shipment.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                {(shipment.status === 'delivered' || shipment.status === 'unloaded')
                                                    ? (shipment.type === 'pickup' ? 'Teslim Alındı' : 'Teslim Edildi')
                                                    : shipment.status === 'failed' ? 'Başarısız' : 'Teslimatta'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

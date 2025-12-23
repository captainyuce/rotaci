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
        // Open tour selection modal
        setPendingRouteCalc({ vehicle, dateType })
        setIsTourSelectOpen(true)
    }

    const executeRouteCalculation = async () => {
        if (!pendingRouteCalc) return

        const { vehicle, dateType } = pendingRouteCalc
        const today = new Date()
        const targetDate = new Date(today)

        if (dateType === 'tomorrow') {
            targetDate.setDate(today.getDate() + 1)
        }

        const dateStr = targetDate.toLocaleDateString('en-CA') // YYYY-MM-DD
        console.log(`Calculating route for ${vehicle.plate} on ${dateStr} (${dateType}) - Tour: ${modalSelectedTour}`)

        setActiveRouteDate(dateStr)
        setIsTourSelectOpen(false)

        // Fetch shipments for this vehicle AND selected tour
        const { data: shipments } = await supabase
            .from('shipments')
            .select('id, delivery_date, tour_number')
            .eq('assigned_vehicle_id', vehicle.id)
            .neq('status', 'delivered')
            .neq('status', 'unloaded')
            .eq('delivery_date', dateStr)
            .eq('tour_number', modalSelectedTour)

        if (shipments && shipments.length > 0) {
            await calculateVehicleRoute(vehicle.id, shipments.map(s => s.id))
        } else {
            alert(`${dateType === 'today' ? 'Bugün' : 'Yarın'} için ${modalSelectedTour}. turda hesaplanacak aktif sevkiyat bulunamadı.`)
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

                // Calculate tour count and details
                const tourNumbers = [...new Set(shipments?.map(s => s.tour_number || 1) || [])].sort((a, b) => a - b)
                const tourDetails = tourNumbers.map(tourNum => ({
                    tourNumber: tourNum,
                    count: shipments?.filter(s => (s.tour_number || 1) === tourNum).length || 0
                }))

                return {
                    ...vehicle,
                    current_load: currentLoad,
                    stats: {
                        total,
                        delivered,
                        todayCount,
                        tomorrowCount,
                        tourCount: tourNumbers.length,
                        tours: tourDetails
                    }
                }
            }))
            setVehicles(vehiclesWithStats)
        }
        setLoading(false)
    }

    const [vehicleShipments, setVehicleShipments] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('today') // 'today' or 'tomorrow'
    const [modalSelectedTour, setModalSelectedTour] = useState(1) // Selected tour in modal
    const [isTourSelectOpen, setIsTourSelectOpen] = useState(false) // Tour selection modal for route calc
    const [pendingRouteCalc, setPendingRouteCalc] = useState(null) // Store vehicle and dateType for route calc

    const handleVehicleClick = async (vehicle) => {
        if (selectedVehicle?.id === vehicle.id) {
            // If clicking the same vehicle, just toggle the modal if it's closed, or do nothing (or deselect)
            // But user wants to see shipments, so let's open modal
            setIsModalOpen(true)
            setModalSelectedTour(1)
            await fetchVehicleShipments(vehicle.id)
        } else {
            setSelectedVehicle(vehicle)
            setIsModalOpen(true)
            setModalSelectedTour(1)
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
            {/* Route Info Card - Top Center */}
            {selectedVehicle && optimizedRoutes[selectedVehicle.id] && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-30 pointer-events-auto">
                    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-4 py-3 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🚗</span>
                            <span className="font-bold text-slate-800">{selectedVehicle.plate}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-300"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-center">
                                <div className="text-xs text-slate-500">Mesafe</div>
                                <div className="font-bold text-blue-600">
                                    {((optimizedRoutes[selectedVehicle.id]?.totalDistance || 0) / 1000).toFixed(1)} km
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-slate-500">Süre</div>
                                <div className="font-bold text-green-600">
                                    {Math.round((optimizedRoutes[selectedVehicle.id]?.totalDuration || 0) / 60)} dk
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                hideVehicleRoute(selectedVehicle.id)
                                setActiveRouteDate(null)
                            }}
                            className="ml-2 p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <X size={16} className="text-slate-500" />
                        </button>
                    </div>
                </div>
            )}

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
                                    {vehicle.stats?.tours && vehicle.stats.tours.length > 0 && (
                                        <div className="pt-1.5 border-t border-slate-100 mt-1.5">
                                            <div className="flex flex-wrap gap-1.5">
                                                {vehicle.stats.tours.map(tour => (
                                                    <div
                                                        key={tour.tourNumber}
                                                        className="bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-xs"
                                                    >
                                                        <span className="font-bold text-blue-700">{tour.tourNumber}. Tur:</span>
                                                        <span className="text-blue-600 ml-1">{tour.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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

                        {/* Tour Selector */}
                        {(() => {
                            const tours = [...new Set(vehicleShipments.map(s => s.tour_number || 1))].sort((a, b) => a - b)
                            if (tours.length > 1) {
                                return (
                                    <div className="mb-4">
                                        <label className="text-xs text-slate-600 mb-1 block">Tur Seçin:</label>
                                        <select
                                            value={modalSelectedTour}
                                            onChange={(e) => setModalSelectedTour(parseInt(e.target.value))}
                                            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                                        >
                                            {tours.map(tour => (
                                                <option key={tour} value={tour}>
                                                    {tour}. Tur ({vehicleShipments.filter(s => (s.tour_number || 1) === tour).length} sevkiyat)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )
                            }
                            return null
                        })()}

                        <div className="space-y-3">
                            {(() => {
                                // Filter shipments based on active tab AND selected tour
                                const todayStr = new Date().toLocaleDateString('en-CA')
                                const tomorrow = new Date()
                                tomorrow.setDate(tomorrow.getDate() + 1)
                                const tomorrowStr = tomorrow.toLocaleDateString('en-CA')

                                const filteredShipments = vehicleShipments.filter(s => {
                                    // Filter by tour first
                                    if ((s.tour_number || 1) !== modalSelectedTour) return false

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

            {/* Tour Selection Modal for Route Calculation */}
            {isTourSelectOpen && pendingRouteCalc && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 pointer-events-auto">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="font-bold text-lg text-slate-900 mb-4">Tur Seçin</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            {pendingRouteCalc.vehicle.plate} için {pendingRouteCalc.dateType === 'today' ? 'bugünün' : 'yarının'} hangi turunu hesaplamak istiyorsunuz?
                        </p>

                        <div className="space-y-2 mb-6">
                            {[1, 2, 3, 4, 5].map(tourNum => (
                                <button
                                    key={tourNum}
                                    onClick={() => setModalSelectedTour(tourNum)}
                                    className={`w-full p-3 rounded-lg border-2 transition-all ${modalSelectedTour === tourNum
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                                        }`}
                                >
                                    <span className="font-bold">{tourNum}. Tur</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setIsTourSelectOpen(false)
                                    setPendingRouteCalc(null)
                                }}
                                className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={executeRouteCalculation}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Hesapla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

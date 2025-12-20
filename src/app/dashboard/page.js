'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Truck, Package, Navigation, X } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'

export default function DashboardPage() {
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const { selectedVehicle, setSelectedVehicle, calculateVehicleRoute, calculatingVehicleId, optimizedRoutes, hideVehicleRoute } = useDashboard()

    const handleCalculateRoute = async (vehicle) => {
        // Fetch shipments for this vehicle first to get the latest IDs
        const { data: shipments } = await supabase
            .from('shipments')
            .select('id')
            .eq('assigned_vehicle_id', vehicle.id)
            .neq('status', 'delivered')

        if (shipments && shipments.length > 0) {
            await calculateVehicleRoute(vehicle.id, shipments.map(s => s.id))
        } else {
            alert('Bu araç için hesaplanacak aktif sevkiyat bulunamadı.')
        }
    }

    useEffect(() => {
        fetchVehicles()

        const channel = supabase
            .channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => fetchVehicles())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => fetchVehicles())
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
                const { count: total } = await supabase
                    .from('shipments')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_vehicle_id', vehicle.id)

                const { count: delivered } = await supabase
                    .from('shipments')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_vehicle_id', vehicle.id)
                    .eq('status', 'delivered')

                return { ...vehicle, stats: { total: total || 0, delivered: delivered || 0 } }
            }))
            setVehicles(vehiclesWithStats)
        }
        setLoading(false)
    }

    const [vehicleShipments, setVehicleShipments] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)

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
            // .neq('status', 'delivered') // Show all shipments including delivered
            // .order('delivery_order', { ascending: true }) // Column doesn't exist yet
            .order('delivery_time', { ascending: true })

        if (error) {
            console.error('Error fetching vehicle shipments:', error)
            return
        }

        if (data) {
            console.log('Fetched shipments:', data)
            setVehicleShipments(data)
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
                                        <span className="font-medium text-slate-900">{vehicle.current_load} kg</span>
                                    </div>
                                </div>

                                {vehicle.stats?.total > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (optimizedRoutes[vehicle.id]) {
                                                hideVehicleRoute(vehicle.id)
                                            } else {
                                                handleCalculateRoute(vehicle)
                                            }
                                        }}
                                        disabled={calculatingVehicleId === vehicle.id}
                                        className={`mt-2 md:mt-3 w-full flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${calculatingVehicleId === vehicle.id
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : optimizedRoutes[vehicle.id]
                                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                            }`}
                                    >
                                        {calculatingVehicleId === vehicle.id ? (
                                            <>
                                                <span className="animate-spin">⌛</span>
                                                Hesaplanıyor...
                                            </>
                                        ) : optimizedRoutes[vehicle.id] ? (
                                            <>
                                                <X size={12} className="md:w-3.5 md:h-3.5" />
                                                Rotayı Gizle
                                            </>
                                        ) : (
                                            <>
                                                <Navigation size={12} className="md:w-3.5 md:h-3.5" />
                                                Rotayı Hesapla
                                            </>
                                        )}
                                    </button>
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
                                <p className="text-sm text-slate-500">{selectedVehicle.driver_name} - Yük: {selectedVehicle.current_load} kg</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {vehicleShipments.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">Bu araçta aktif sevkiyat bulunmuyor.</p>
                            ) : (
                                vehicleShipments.map((shipment, index) => (
                                    <div key={shipment.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{index + 1}</span>
                                                {shipment.customer_name}
                                            </span>
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                                                {shipment.delivery_time}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">{shipment.delivery_address}</p>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500">{shipment.weight} kg</span>
                                            <span className={`px-2 py-0.5 rounded-full font-medium ${shipment.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                                shipment.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                {shipment.status === 'delivered' ? 'Teslim Edildi' :
                                                    shipment.status === 'failed' ? 'Başarısız' : 'Teslimatta'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

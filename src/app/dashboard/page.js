'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Truck, Package, Navigation } from 'lucide-react'
import { useDashboard } from '@/contexts/DashboardContext'

export default function DashboardPage() {
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const { selectedVehicle, setSelectedVehicle } = useDashboard()

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

    const handleVehicleClick = (vehicle) => {
        if (selectedVehicle?.id === vehicle.id) {
            setSelectedVehicle(null) // Deselect if clicking the same vehicle
        } else {
            setSelectedVehicle(vehicle)
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

                                {vehicle.current_lat && vehicle.current_lng && (
                                    <button className="mt-2 md:mt-3 w-full flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs md:text-sm font-medium transition-colors">
                                        <Navigation size={12} className="md:w-3.5 md:h-3.5" />
                                        Konuma Git
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}

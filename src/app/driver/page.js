'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { MapPin, CheckCircle, XCircle, Navigation, Package, RefreshCw, Bell, Map, ArrowDownCircle, ArrowUpCircle, Truck } from 'lucide-react'
import dynamic from 'next/dynamic'
import ChatButton from '@/components/ChatButton'
import NotificationBell from '@/components/NotificationBell'
import { logShipmentAction } from '@/lib/auditLog'
import LocationTracker from '@/components/LocationTracker'

const NavigationMap = dynamic(() => import('@/components/NavigationMap'), { ssr: false })
const DriverRouteMap = dynamic(() => import('@/components/DriverRouteMap'), { ssr: false })

export default function DriverPage() {
    const { user } = useAuth()
    const [jobs, setJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedJob, setSelectedJob] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(new Date())
    const [activeTab, setActiveTab] = useState('new') // 'new', 'acknowledged', 'completed', 'map'

    useEffect(() => {
        if (user?.id) {
            fetchJobs()

            const channel = supabase
                .channel('driver_jobs')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'shipments',
                    filter: `assigned_vehicle_id=eq.${user.id}`
                }, (payload) => {
                    console.log('Real-time update received:', payload)
                    fetchJobs()
                    setLastUpdate(new Date())
                })
                .subscribe((status) => {
                    console.log('Subscription status:', status)
                })

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [user])

    const fetchJobs = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('shipments')
            .select('*')
            .eq('assigned_vehicle_id', user.id)
            .order('route_order', { ascending: true, nullsLast: true })
            .order('created_at', { ascending: false })

        // Client-side sort to ensure route_order is respected
        if (data) {
            const sorted = [...data].sort((a, b) => {
                // If both have route_order, sort by it
                if (a.route_order && b.route_order) {
                    return a.route_order - b.route_order
                }
                // If only a has route_order, it comes first
                if (a.route_order && !b.route_order) return -1
                // If only b has route_order, it comes first
                if (!a.route_order && b.route_order) return 1
                // If neither has route_order, sort by created_at (newest first)
                return new Date(b.created_at) - new Date(a.created_at)
            })
            setJobs(sorted)
        }
        setLoading(false)
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        await fetchJobs()
        setLastUpdate(new Date())
        setRefreshing(false)
    }

    const acknowledgeJob = async (id) => {
        console.log('Acknowledging job:', id)

        const { data, error } = await supabase
            .from('shipments')
            .update({ acknowledged_at: new Date().toISOString() })
            .eq('id', id)
            .select()

        if (error) {
            console.error('Error acknowledging job:', error)
            alert('Hata: ' + error.message)
            return
        }

        console.log('Job acknowledged successfully:', data)

        // Log the acknowledgment
        try {
            // Get driver name
            const { data: driverData } = await supabase
                .from('vehicles')
                .select('driver_name')
                .eq('id', user.id)
                .single()

            const driverName = driverData?.driver_name || 'Sürücü'

            // Fetch full shipment data
            const { data: fullShipment } = await supabase
                .from('shipments')
                .select('*')
                .eq('id', id)
                .single()

            await logShipmentAction(
                'acknowledged',
                id,
                fullShipment,
                user.id,
                driverName
            )
        } catch (err) {
            console.error('Error logging acknowledgment:', err)
        }

        fetchJobs()
    }

    const updateStatus = async (id, status) => {
        const { data, error } = await supabase
            .from('shipments')
            .update({
                status,
                delivered_at: status === 'delivered' ? new Date().toISOString() : null,
                // STRICT RULE: If delivered, update delivery_date to TODAY regardless of original schedule
                delivery_date: status === 'delivered' ? new Date().toLocaleDateString('en-CA') : undefined
            })
            .eq('id', id)
            .select()

        if (!error) {
            try {
                // Get driver name
                const { data: driverData } = await supabase
                    .from('vehicles')
                    .select('driver_name')
                    .eq('id', user.id)
                    .single()

                const driverName = driverData?.driver_name || 'Sürücü'

                // Fetch full shipment data
                const { data: fullShipment } = await supabase
                    .from('shipments')
                    .select('*')
                    .eq('id', id)
                    .single()

                await logShipmentAction(
                    status,
                    id,
                    fullShipment,
                    user.id,
                    driverName
                )
            } catch (err) {
                console.error('Error logging status change:', err)
            }
        }

        if (status === 'delivered') {
            // Logic to decrease load would go here
        }
    }

    const handleUnload = async () => {
        if (!confirm('Araçtaki toplanan yükleri boşaltmak istediğinize emin misiniz?')) return

        const loadedPickups = jobs.filter(j => j.type === 'pickup' && j.status === 'delivered')

        if (loadedPickups.length === 0) {
            alert('Boşaltılacak yük bulunamadı.')
            return
        }

        setLoading(true)
        try {
            // Update all loaded pickups to 'unloaded'
            const { error } = await supabase
                .from('shipments')
                .update({
                    status: 'unloaded',
                    delivered_at: new Date().toISOString(),
                    // STRICT RULE: If unloaded (completed), update delivery_date to TODAY
                    delivery_date: new Date().toLocaleDateString('en-CA')
                })
                .in('id', loadedPickups.map(j => j.id))

            if (error) throw error

            // Log the action for each shipment
            // Get driver name once
            const { data: driverData } = await supabase
                .from('vehicles')
                .select('driver_name')
                .eq('id', user.id)
                .single()
            const driverName = driverData?.driver_name || 'Sürücü'

            for (const job of loadedPickups) {
                await logShipmentAction(
                    'unloaded',
                    job.id,
                    { ...job, status: 'unloaded' },
                    user.id,
                    driverName
                )
            }

            alert('Yükler başarıyla boşaltıldı.')
            fetchJobs()
        } catch (err) {
            console.error('Error unloading:', err)
            alert('Hata: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const showNavigation = (job) => {
        setSelectedJob(job)
    }

    const newJobs = jobs.filter(j => !j.acknowledged_at && j.status !== 'delivered' && j.status !== 'unloaded')
    const acknowledgedJobs = jobs.filter(j => j.acknowledged_at && j.status !== 'delivered' && j.status !== 'unloaded')
    const completedJobs = jobs.filter(j => j.status === 'delivered' || j.status === 'unloaded')
    const hasLoadedPickups = jobs.some(j => j.type === 'pickup' && j.status === 'delivered')

    // Determine active tour: the lowest tour number that has incomplete shipments
    const getActiveTour = () => {
        const incompleteTours = [...new Set(
            [...newJobs, ...acknowledgedJobs].map(j => j.tour_number || 1)
        )].sort((a, b) => a - b)
        return incompleteTours.length > 0 ? incompleteTours[0] : 1
    }

    const activeTour = getActiveTour()

    // Filter jobs to show only active tour
    const activeNewJobs = newJobs.filter(j => (j.tour_number || 1) === activeTour)
    const activeAcknowledgedJobs = acknowledgedJobs.filter(j => (j.tour_number || 1) === activeTour)

    // Group jobs by tour (for display purposes)
    const groupByTour = (jobsList) => {
        const grouped = {}
        jobsList.forEach(job => {
            const tourNum = job.tour_number || 1
            if (!grouped[tourNum]) grouped[tourNum] = []
            grouped[tourNum].push(job)
        })
        return grouped
    }

    const newJobsByTour = groupByTour(activeNewJobs)
    const acknowledgedJobsByTour = groupByTour(activeAcknowledgedJobs)

    const renderJobCard = (job, showAcknowledgeButton = false, isCompleted = false) => (
        <div key={job.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 relative">
            {/* Order Badge */}
            {job.route_order && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl z-10">
                    Sıra: {job.route_order}
                </div>
            )}

            <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                <div className="pr-8"> {/* Padding for badge */}
                    <div className="flex items-center gap-2 mb-1">
                        {job.type === 'pickup' ? (
                            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <ArrowDownCircle size={12} />
                                Mal Al
                            </span>
                        ) : (
                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <ArrowUpCircle size={12} />
                                Mal Bırak
                            </span>
                        )}
                    </div>
                    <h3 className="font-bold text-lg text-slate-800">{job.customer_name}</h3>
                    <p className="text-sm text-slate-500">{job.delivery_time || 'Saat belirtilmedi'}</p>
                </div>
                <span className="bg-zinc-100 text-zinc-700 text-xs font-bold px-2 py-1 rounded-full mt-8">
                    {job.weight} Palet
                </span>

                {/* Preparation Status for Deliveries */}
                {job.type !== 'pickup' && job.status !== 'delivered' && job.status !== 'failed' && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full mt-8 ${job.preparation_status === 'ready'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        }`}>
                        {job.preparation_status === 'ready' ? 'Hazır' : 'Hazırlanıyor'}
                    </span>
                )}
            </div>

            {/* Working Hours Warning */}
            {job.closing_time && job.status !== 'delivered' && job.status !== 'failed' && (
                (() => {
                    const now = new Date()

                    // Parse times
                    const [closeHours, closeMinutes] = job.closing_time.split(':').map(Number)
                    const closingDate = new Date()
                    closingDate.setHours(closeHours, closeMinutes, 0)

                    let openingDate = null
                    if (job.opening_time) {
                        const [openHours, openMinutes] = job.opening_time.split(':').map(Number)
                        openingDate = new Date()
                        openingDate.setHours(openHours, openMinutes, 0)
                    }

                    // Check if closed (past closing time)
                    if (now > closingDate) {
                        return (
                            <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <h4 className="font-bold text-red-800 text-sm">İşyeri Kapanmış Olabilir!</h4>
                                    <p className="text-xs text-red-700 mt-1">
                                        Kapanış saati: {job.closing_time.slice(0, 5)}.
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    // Check if not yet open (before opening time)
                    if (openingDate && now < openingDate) {
                        return (
                            <div className="mx-4 mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3">
                                <span className="text-xl">🔒</span>
                                <div>
                                    <h4 className="font-bold text-orange-800 text-sm">İşyeri Henüz Açılmadı</h4>
                                    <p className="text-xs text-orange-700 mt-1">
                                        Açılış saati: {job.opening_time.slice(0, 5)}.
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    // Warning if less than 30 mins left to closing
                    const diffMinutes = (closingDate - now) / 1000 / 60
                    if (diffMinutes > 0 && diffMinutes < 60) {
                        return (
                            <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                                <span className="text-xl">⏳</span>
                                <div>
                                    <h4 className="font-bold text-amber-800 text-sm">Kapanışa Az Kaldı</h4>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Kapanış saati: {job.closing_time.slice(0, 5)}. {Math.floor(diffMinutes)} dakika kaldı.
                                    </p>
                                </div>
                            </div>
                        )
                    }
                    return null
                })()
            )}

            <div className="p-4 space-y-4">
                <div className="flex items-start gap-3 text-slate-600">
                    <MapPin className="shrink-0 mt-1 text-blue-500" size={20} />
                    <p className="text-sm">{job.delivery_address}</p>
                </div>

                {job.notes && (
                    <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 border border-yellow-100">
                        <span className="font-bold">Not:</span> {job.notes}
                    </div>
                )}

                {showAcknowledgeButton ? (
                    <button
                        onClick={() => acknowledgeJob(job.id)}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition-colors"
                    >
                        <CheckCircle size={20} />
                        Kabul Ettim
                    </button>
                ) : isCompleted ? (
                    <div className="w-full flex items-center justify-center gap-2 bg-green-100 text-green-700 py-3 rounded-lg font-bold border-2 border-green-300">
                        <CheckCircle size={20} />
                        Teslim Edildi
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 gap-2 pt-2">
                            <ChatButton
                                shipmentId={job.id}
                                shipmentName={job.customer_name}
                            />
                            <button
                                onClick={() => showNavigation(job)}
                                className="flex items-center justify-center gap-2 bg-primary hover:bg-zinc-700 text-white py-3 rounded-lg font-medium transition-colors text-sm"
                            >
                                <Navigation size={16} />
                                Yol Tarifi
                            </button>

                            {job.status === 'assigned' ? (
                                <button
                                    onClick={() => updateStatus(job.id, 'delivered')}
                                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors text-sm"
                                >
                                    <CheckCircle size={16} />
                                    {job.type === 'pickup' ? 'Teslim Aldım' : 'Teslim Ettim'}
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="flex items-center justify-center gap-2 bg-gray-100 text-gray-400 py-3 rounded-lg font-medium text-sm"
                                >
                                    {job.status === 'delivered' ? 'Tamamlandı' : 'İşlemde'}
                                </button>
                            )}
                        </div>

                        {job.status === 'assigned' && (
                            <button
                                onClick={() => updateStatus(job.id, 'failed')}
                                className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-2 rounded-lg text-sm transition-colors"
                            >
                                <XCircle size={16} />
                                {job.type === 'pickup' ? 'Teslim Alınamadı' : 'Teslim Edilemedi'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )

    return (
        <>
            {user?.id && <LocationTracker vehicleId={user.id} />}

            {/* Refresh Button */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-bold text-slate-700">İşlerim</h2>
                    {(activeNewJobs.length > 0 || activeAcknowledgedJobs.length > 0) && (
                        <p className="text-xs text-blue-600 font-medium mt-0.5">
                            Aktif: {activeTour}. Tur
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        Son: {lastUpdate.toLocaleTimeString('tr-TR')}
                    </span>
                    <NotificationBell />
                    {hasLoadedPickups && (
                        <button
                            onClick={handleUnload}
                            className="p-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                            title="Yükü Boşalt"
                        >
                            <Truck size={16} />
                            <span className="hidden md:inline">Yükü Boşalt</span>
                        </button>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 bg-primary hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 min-w-[80px] py-3 px-2 rounded-lg font-medium transition-colors relative text-sm ${activeTab === 'new'
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <div className="flex items-center justify-center gap-1">
                        <Bell size={16} />
                        Yeni
                        {newJobs.length > 0 && (
                            <span className="bg-white text-orange-600 text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">
                                {newJobs.length}
                            </span>
                        )}
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('acknowledged')}
                    className={`flex-1 min-w-[80px] py-3 px-2 rounded-lg font-medium transition-colors text-sm ${activeTab === 'acknowledged'
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    Aktif ({acknowledgedJobs.length})
                </button>
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 min-w-[80px] py-3 px-2 rounded-lg font-medium transition-colors text-sm ${activeTab === 'map'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <div className="flex items-center justify-center gap-1">
                        <Map size={16} />
                        Harita
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`flex-1 min-w-[80px] py-3 px-2 rounded-lg font-medium transition-colors text-sm ${activeTab === 'completed'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    Biten ({completedJobs.length})
                </button>
            </div>

            <div className="space-y-4 h-[calc(100vh-220px)] overflow-y-auto pb-20">
                {activeTab === 'new' && (
                    <>
                        {newJobs.length === 0 && !loading && (
                            <div className="bg-white p-8 rounded-xl text-center text-slate-400 shadow-sm">
                                <Bell size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Yeni atanan iş bulunmuyor.</p>
                            </div>
                        )}
                        {Object.keys(newJobsByTour).sort((a, b) => a - b).map(tourNum => (
                            <div key={`new-tour-${tourNum}`}>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                                    <h3 className="font-bold text-blue-800 text-sm">{tourNum}. Tur ({newJobsByTour[tourNum].length} sevkiyat)</h3>
                                </div>
                                <div className="space-y-4">
                                    {newJobsByTour[tourNum].map((job) => renderJobCard(job, true, false))}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'acknowledged' && (
                    <>
                        {acknowledgedJobs.length === 0 && !loading && (
                            <div className="bg-white p-8 rounded-xl text-center text-slate-400 shadow-sm">
                                <Package size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Aktif iş bulunmuyor.</p>
                            </div>
                        )}
                        {Object.keys(acknowledgedJobsByTour).sort((a, b) => a - b).map(tourNum => (
                            <div key={`ack-tour-${tourNum}`}>
                                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
                                    <h3 className="font-bold text-green-800 text-sm">{tourNum}. Tur ({acknowledgedJobsByTour[tourNum].length} sevkiyat)</h3>
                                </div>
                                <div className="space-y-4">
                                    {acknowledgedJobsByTour[tourNum].map((job) => renderJobCard(job, false, false))}
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {activeTab === 'map' && (
                    <div className="h-full bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                        <DriverRouteMap shipments={activeAcknowledgedJobs} />
                    </div>
                )}

                {activeTab === 'completed' && (
                    <>
                        {completedJobs.length === 0 && !loading && (
                            <div className="bg-white p-8 rounded-xl text-center text-slate-400 shadow-sm">
                                <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Tamamlanmış iş bulunmuyor.</p>
                            </div>
                        )}
                        {completedJobs.map((job) => renderJobCard(job, false, true))}
                    </>
                )}
            </div>

            {/* Navigation Modal */}
            {selectedJob && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">{selectedJob.customer_name}</h3>
                                <p className="text-sm text-slate-600">{selectedJob.delivery_address}</p>
                            </div>
                            <button
                                onClick={() => setSelectedJob(null)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <XCircle size={24} className="text-slate-600" />
                            </button>
                        </div>

                        {/* Map */}
                        <div className="flex-1 relative">
                            <NavigationMap destination={selectedJob} />
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.delivery_lat},${selectedJob.delivery_lng}`, '_blank')}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg font-medium transition-colors"
                            >
                                Google Maps'te Aç
                            </button>
                            <button
                                onClick={() => setSelectedJob(null)}
                                className="flex-1 bg-primary hover:bg-zinc-700 text-white py-3 rounded-lg font-medium transition-colors"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

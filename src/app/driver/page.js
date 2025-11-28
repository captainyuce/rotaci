'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { MapPin, CheckCircle, XCircle, Navigation, Package, RefreshCw, Bell } from 'lucide-react'
import dynamic from 'next/dynamic'
import ChatButton from '@/components/ChatButton'
import { logShipmentAction } from '@/lib/auditLog'

const NavigationMap = dynamic(() => import('@/components/NavigationMap'), { ssr: false })

export default function DriverPage() {
    const { user } = useAuth()
    const [jobs, setJobs] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedJob, setSelectedJob] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(new Date())
    const [activeTab, setActiveTab] = useState('new') // 'new' or 'acknowledged'

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
            .order('created_at', { ascending: false })

        if (data) setJobs(data)
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
            alert('Hata: ' + error.message + '\n\nLütfen Supabase SQL Editor\'de şu komutu çalıştırın:\nALTER TABLE shipments ADD COLUMN acknowledged_at TIMESTAMPTZ;')
            return
        }

        console.log('Job acknowledged successfully:', data)

        // Log the acknowledgment
        try {
            console.log('Attempting to log acknowledgment...')

            // Get driver name
            const { data: driverData } = await supabase
                .from('vehicles')
                .select('driver_name')
                .eq('id', user.id)
                .single()

            const driverName = driverData?.driver_name || 'Sürücü'
            console.log('Driver name:', driverName, 'Shipment ID:', id)

            // Fetch full shipment data
            const { data: fullShipment } = await supabase
                .from('shipments')
                .select('*')
                .eq('id', id)
                .single()

            console.log('Full shipment data:', fullShipment)

            console.log('Calling logShipmentAction with params:', {
                action: 'acknowledged',
                shipmentId: id,
                shipmentData: fullShipment,
                userId: user.id,
                userName: driverName
            })

            await logShipmentAction(
                'acknowledged',
                id,
                fullShipment,
                user.id,
                driverName
            )
            console.log('Log created successfully')
        } catch (err) {
            console.error('Error logging acknowledgment:', err)
        }

        fetchJobs()
    }

    const updateStatus = async (id, status) => {
        const { data, error } = await supabase
            .from('shipments')
            .update({ status })
            .eq('id', id)
            .select()

        if (!error) {
            try {
                console.log('Attempting to log status change:', status)

                // Get driver name
                const { data: driverData } = await supabase
                    .from('vehicles')
                    .select('driver_name')
                    .eq('id', user.id)
                    .single()

                const driverName = driverData?.driver_name || 'Sürücü'
                console.log('Driver name:', driverName, 'Action:', status, 'Shipment ID:', id)

                // Fetch full shipment data
                const { data: fullShipment } = await supabase
                    .from('shipments')
                    .select('*')
                    .eq('id', id)
                    .single()

                console.log('Full shipment data:', fullShipment)

                await logShipmentAction(
                    status,
                    id,
                    fullShipment,
                    user.id,
                    driverName
                )
                console.log('Status log created successfully')
            } catch (err) {
                console.error('Error logging status change:', err)
            }
        }

        if (status === 'delivered') {
            // Logic to decrease load would go here
        }
    }

    const showNavigation = (job) => {
        setSelectedJob(job)
    }

    const newJobs = jobs.filter(j => !j.acknowledged_at && j.status !== 'delivered')
    const acknowledgedJobs = jobs.filter(j => j.acknowledged_at && j.status !== 'delivered')
    const completedJobs = jobs.filter(j => j.status === 'delivered')

    const renderJobCard = (job, showAcknowledgeButton = false, isCompleted = false) => (
        <div key={job.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-slate-800">{job.customer_name}</h3>
                    <p className="text-sm text-slate-500">{job.delivery_time || 'Saat belirtilmedi'}</p>
                </div>
                <span className="bg-zinc-100 text-zinc-700 text-xs font-bold px-2 py-1 rounded-full">
                    {job.weight} kg
                </span>
            </div>

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
                                    Teslim Et
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
                                Teslim Edilemedi
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )

    return (
        <>
            {/* Refresh Button */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-700">İşlerim</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        Son: {lastUpdate.toLocaleTimeString('tr-TR')}
                    </span>
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
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors relative ${activeTab === 'new'
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Bell size={18} />
                        Yeni
                        {newJobs.length > 0 && (
                            <span className="bg-white text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                {newJobs.length}
                            </span>
                        )}
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('acknowledged')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${activeTab === 'acknowledged'
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    Aktif ({acknowledgedJobs.length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${activeTab === 'completed'
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    Tamamlanan ({completedJobs.length})
                </button>
            </div>

            <div className="space-y-4">
                {activeTab === 'new' && (
                    <>
                        {newJobs.length === 0 && !loading && (
                            <div className="bg-white p-8 rounded-xl text-center text-slate-400 shadow-sm">
                                <Bell size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Yeni atanan iş bulunmuyor.</p>
                            </div>
                        )}
                        {newJobs.map((job) => renderJobCard(job, true, false))}
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
                        {acknowledgedJobs.map((job) => renderJobCard(job, false, false))}
                    </>
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

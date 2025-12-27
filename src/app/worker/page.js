'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'
import { Package, CheckCircle, Clock, Search, RefreshCw, LogOut } from 'lucide-react'
import { getTurkeyDateString, getTurkeyTomorrowDateString, toTurkeyDateString } from '@/lib/dateHelpers'
import { shouldHideCompletedShipment } from '@/lib/shipmentHelpers'
import Toast from '@/components/Toast'

export default function WorkerPanel() {
    const { user, hasPermission, signOut } = useAuth()
    const [activeTab, setActiveTab] = useState('pending') // 'pending' or 'ready'
    const [shipments, setShipments] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [processingId, setProcessingId] = useState(null)
    const [toast, setToast] = useState(null)

    const playNotificationSound = () => {
        try {
            // Simple notification beep
            const audio = new Audio('https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3')
            audio.volume = 0.5
            audio.play().catch(e => console.log('Audio play failed', e))
        } catch (e) {
            console.error('Audio error', e)
        }
    }

    useEffect(() => {
        if (hasPermission(PERMISSIONS.PREPARE_SHIPMENTS)) {
            fetchShipments()

            const channel = supabase
                .channel('worker_shipments')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'shipments'
                }, (payload) => {
                    // Handle notifications for new shipments
                    if (payload.eventType === 'INSERT') {
                        const newShipment = payload.new
                        const today = getTurkeyDateString()
                        const tomorrow = getTurkeyTomorrowDateString()

                        // Only notify if it's for today or tomorrow
                        if (newShipment.delivery_date === today || newShipment.delivery_date === tomorrow) {
                            setToast({
                                message: `Yeni Sevkiyat: ${newShipment.customer_name}`,
                                type: 'info'
                            })
                            playNotificationSound()
                        }
                    }
                    fetchShipments()
                })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [hasPermission])

    // Permission check - Render logic moved here, after hooks
    if (!hasPermission(PERMISSIONS.PREPARE_SHIPMENTS)) {
        // Only log once or handle side effect in useEffect if needed, but for render blocking this is fine
        // provided hooks above are always called.
        // However, logSecurityEvent is a side effect. It's better to do it in a useEffect or just render.
        // For now, keeping it simple but safe for hooks.

        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LogOut className="text-red-600" size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Erişim Reddedildi</h1>
                    <p className="text-slate-600 mb-6">Bu sayfayı görüntüleme yetkiniz yok.</p>
                    <button
                        onClick={() => signOut()}
                        className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                    >
                        Çıkış Yap
                    </button>
                </div>
            </div>
        )
    }

    const fetchShipments = async () => {
        setLoading(true)
        const today = getTurkeyDateString()
        const tomorrow = getTurkeyTomorrowDateString()

        // Fetch shipments for today and tomorrow
        const { data, error } = await supabase
            .from('shipments')
            .select('*')
            .or(`delivery_date.eq.${today},delivery_date.eq.${tomorrow}`)
            .neq('status', 'delivered')
            .neq('status', 'unloaded')
            .order('delivery_date', { ascending: true })

        if (data) {
            setShipments(data)
        }
        setLoading(false)
    }

    const handleMarkAsReady = async (id) => {
        setProcessingId(id)
        try {
            const { error } = await supabase
                .from('shipments')
                .update({
                    preparation_status: 'ready',
                    prepared_at: new Date().toISOString()
                })
                .eq('id', id)

            if (error) throw error

            logShipmentAction(
                'mark_ready',
                id,
                { status: 'ready' },
                user?.id,
                user?.full_name || 'Worker'
            )
        } catch (error) {
            console.error('Error marking as ready:', error)
            alert('İşlem sırasında bir hata oluştu.')
        } finally {
            setProcessingId(null)
        }
    }

    const handleMarkAsPending = async (id) => {
        if (!confirm('Bu sevkiyatı tekrar "Hazırlanacak" durumuna almak istiyor musunuz?')) return

        setProcessingId(id)
        try {
            const { error } = await supabase
                .from('shipments')
                .update({
                    preparation_status: 'pending',
                    prepared_at: null
                })
                .eq('id', id)

            if (error) throw error

            logShipmentAction(
                'mark_pending',
                id,
                { status: 'pending' },
                user?.id,
                user?.full_name || 'Worker'
            )
        } catch (error) {
            console.error('Error marking as pending:', error)
            alert('İşlem sırasında bir hata oluştu.')
        } finally {
            setProcessingId(null)
        }
    }

    // Filter shipments based on tab and search
    const filteredShipments = shipments.filter(s => {
        // Tab filter
        const isReady = s.preparation_status === 'ready'
        if (activeTab === 'pending' && isReady) return false
        if (activeTab === 'ready' && !isReady) return false

        // Search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase()
            return (
                s.customer_name?.toLowerCase().includes(searchLower) ||
                s.address?.toLowerCase().includes(searchLower) ||
                s.notes?.toLowerCase().includes(searchLower)
            )
        }

        return true
    })

    const pendingCount = shipments.filter(s => s.preparation_status !== 'ready').length
    const readyCount = shipments.filter(s => s.preparation_status === 'ready').length

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-top">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Package className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900">Depo Paneli</h1>
                            <p className="text-xs text-slate-500">{user?.full_name || user?.username}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                    >
                        <LogOut size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-4 border-t border-slate-100">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'pending'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Clock size={16} />
                        Hazırlanacak
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                            {pendingCount}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('ready')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'ready'
                            ? 'border-green-600 text-green-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <CheckCircle size={16} />
                        Hazır
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                            {readyCount}
                        </span>
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-white border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Müşteri veya adres ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : filteredShipments.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Package size={48} className="mx-auto mb-3 opacity-20" />
                        <p>Bu listede sevkiyat bulunamadı.</p>
                    </div>
                ) : (
                    filteredShipments.map(shipment => (
                        <div key={shipment.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-slate-900">{shipment.customer_name}</h3>
                                    <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                                        {shipment.weight} kg
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{shipment.address}</p>

                                {shipment.notes && (
                                    <div className="bg-yellow-50 border border-yellow-100 p-2 rounded-lg mb-3 text-xs text-yellow-800">
                                        <span className="font-bold">Not:</span> {shipment.notes}
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100">
                                    <div className="text-xs text-slate-500">
                                        {shipment.delivery_date === getTurkeyDateString() ? 'Bugün' : 'Yarın'}
                                    </div>

                                    {activeTab === 'pending' ? (
                                        <button
                                            onClick={() => handleMarkAsReady(shipment.id)}
                                            disabled={processingId === shipment.id}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50"
                                        >
                                            {processingId === shipment.id ? (
                                                <RefreshCw size={16} className="animate-spin" />
                                            ) : (
                                                <CheckCircle size={16} />
                                            )}
                                            Hazır Olarak İşaretle
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleMarkAsPending(shipment.id)}
                                            disabled={processingId === shipment.id}
                                            className="text-slate-400 hover:text-slate-600 text-sm font-medium px-2 py-1"
                                        >
                                            Geri Al
                                        </button>
                                    )}
                                </div>
                            </div>
                            {activeTab === 'ready' && (
                                <div className="bg-green-50 px-4 py-2 border-t border-green-100 flex items-center gap-2 text-xs text-green-700">
                                    <CheckCircle size={14} />
                                    <span>Hazırlandı: {shipment.prepared_at ? new Date(shipment.prepared_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

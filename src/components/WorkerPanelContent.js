'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { PERMISSIONS } from '@/lib/permissions'
import { Package, Clock, CheckCircle, Search, LogOut, RefreshCw } from 'lucide-react'
import { getTurkeyDateString, getTurkeyTomorrowDateString } from '@/lib/dateHelpers'
import { logShipmentAction } from '@/lib/auditLog'
import ToastNotification from '@/components/ToastNotification'

// Sound for notifications
const playNotificationSound = () => {
    try {
        const audio = new Audio('/notification.mp3')
        audio.play().catch(e => console.log('Audio play failed:', e))
    } catch (e) {
        console.error('Audio error:', e)
    }
}

export default function WorkerPanelContent({ isDashboard = false }) {
    const { hasPermission, user, signOut } = useAuth()
    console.log('WorkerPanelContent user:', user)
    const [activeTab, setActiveTab] = useState('pending') // 'pending' or 'ready'
    const [shipments, setShipments] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [processingId, setProcessingId] = useState(null)
    const [notification, setNotification] = useState(null)

    useEffect(() => {
        fetchShipments()

        // Real-time subscription for new shipments
        const channel = supabase
            .channel('worker_shipments')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'shipments'
            }, (payload) => {
                const newShipment = payload.new
                const today = getTurkeyDateString()
                const tomorrow = getTurkeyTomorrowDateString()

                // If shipment is for today or tomorrow
                if (newShipment.delivery_date === today || newShipment.delivery_date === tomorrow) {
                    fetchShipments()
                    playNotificationSound()
                    setNotification({
                        message: `Yeni Sevkiyat: ${newShipment.customer_name}`,
                        type: 'info'
                    })
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'shipments'
            }, () => {
                fetchShipments()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Permission check is handled by parent or layout in dashboard, 
    // but we keep it here for standalone worker page safety
    if (!hasPermission(PERMISSIONS.PREPARE_SHIPMENTS) && !hasPermission(PERMISSIONS.VIEW)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LogOut className="text-red-600" size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Erişim Reddedildi</h1>
                    <p className="text-slate-600 mb-6">Bu sayfayı görüntüleme yetkiniz yok.</p>
                    {!isDashboard && (
                        <button
                            onClick={() => signOut()}
                            className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                        >
                            Çıkış Yap
                        </button>
                    )}
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
                    prepared_at: new Date().toISOString(),
                    prepared_by_name: user?.full_name || user?.username || 'Çalışan',
                    prepared_by_user_id: user?.id
                })
                .eq('id', id)

            if (error) throw error

            const shipment = shipments.find(s => s.id === id)
            logShipmentAction(
                'mark_ready',
                id,
                { ...shipment, status: 'ready' },
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
        const shipment = shipments.find(s => s.id === id)

        // Check if user is allowed to undo
        const isPreparer = shipment.prepared_by_user_id === user?.id
        const canOverride = hasPermission(PERMISSIONS.OVERRIDE_PREPARATION)

        if (!isPreparer && !canOverride) {
            alert('Bu işlemi sadece sevkiyatı hazırlayan kişi veya yetkili yönetici geri alabilir.')
            return
        }

        setProcessingId(id)
        try {
            const { error } = await supabase
                .from('shipments')
                .update({
                    preparation_status: 'pending',
                    prepared_at: null,
                    prepared_by_name: null,
                    prepared_by_user_id: null
                })
                .eq('id', id)

            if (error) throw error

            logShipmentAction(
                'mark_pending',
                id,
                { ...shipment, status: 'pending' },
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
                s.delivery_address?.toLowerCase().includes(searchLower) ||
                s.notes?.toLowerCase().includes(searchLower)
            )
        }

        return true
    })

    const pendingCount = shipments.filter(s => s.preparation_status !== 'ready').length
    const readyCount = shipments.filter(s => s.preparation_status === 'ready').length

    return (
        <div className={`bg-slate-50 h-full overflow-y-auto ${isDashboard ? '' : 'min-h-screen pb-20'}`}>
            {notification && (
                <ToastNotification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}

            {/* Header - Only show if NOT in dashboard (dashboard has its own header) */}
            {!isDashboard && (
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10 safe-top">
                    <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1">
                                <img src="/akalbatu-logo-new.png" alt="Akalbatu" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h1 className="font-bold text-slate-900 text-lg">Depo Paneli</h1>
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
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                                {readyCount}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* Dashboard specific tabs */}
            {isDashboard && (
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                    <div className="flex px-4">
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
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">
                                {readyCount}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className={`p-4 sticky z-10 bg-slate-50/95 backdrop-blur-sm ${isDashboard ? 'top-[57px]' : 'top-[113px]'}`}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Müşteri veya adres ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="px-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <RefreshCw className="animate-spin text-slate-400" size={32} />
                    </div>
                ) : filteredShipments.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="mx-auto text-slate-300 mb-3" size={48} />
                        <p className="text-slate-500">
                            {searchTerm ? 'Sonuç bulunamadı.' : 'Gösterilecek sevkiyat yok.'}
                        </p>
                    </div>
                ) : (
                    filteredShipments.map(shipment => (
                        <div key={shipment.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg">{shipment.customer_name}</h3>
                                    <p className="text-slate-500 text-sm mt-1">{shipment.delivery_address}</p>
                                </div>
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                    {shipment.weight} Palet
                                </span>
                            </div>

                            {shipment.notes && (
                                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-4 border border-yellow-100">
                                    <span className="font-bold">Not:</span> {shipment.notes}
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                                <div className="text-xs text-slate-400">
                                    {new Date(shipment.delivery_date).toLocaleDateString('tr-TR')}
                                </div>

                                {activeTab === 'pending' ? (
                                    <button
                                        onClick={() => handleMarkAsReady(shipment.id)}
                                        disabled={processingId === shipment.id}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {processingId === shipment.id ? (
                                            <RefreshCw className="animate-spin" size={16} />
                                        ) : (
                                            <CheckCircle size={16} />
                                        )}
                                        Hazır Olarak İşaretle
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleMarkAsPending(shipment.id)}
                                        disabled={processingId === shipment.id}
                                        className="bg-slate-100 text-slate-600 px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
                                    >
                                        Geri Al
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

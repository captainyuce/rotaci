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
    const { hasPermission, user, signOut, loading: authLoading } = useAuth()
    console.log('WorkerPanelContent user:', user)
    const [activeTab, setActiveTab] = useState('my_jobs') // 'my_jobs', 'pending', 'ready'
    const [shipments, setShipments] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [processingId, setProcessingId] = useState(null)
    const [notification, setNotification] = useState(null)

    useEffect(() => {
        if (authLoading) return
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
    }, [authLoading])

    // Permission check is handled by parent or layout in dashboard, 
    // but we keep it here for standalone worker page safety
    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
    }

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

        // Fetch shipments for today/tomorrow OR assigned to me
        const { data, error } = await supabase
            .from('shipments')
            .select('*')
            .or(`delivery_date.eq.${today},delivery_date.eq.${tomorrow},assigned_user_id.eq.${user?.id}`)
            .neq('status', 'delivered') // We might want to see delivered ones in history, but for now hide
            .neq('status', 'unloaded')
            .order('delivery_date', { ascending: true })

        if (data) {
            setShipments(data)
        }
        setLoading(false)
    }

    const handleUpdateStatus = async (id, status) => {
        setProcessingId(id)
        try {
            const { error } = await supabase
                .from('shipments')
                .update({
                    status: status,
                    delivered_at: status === 'delivered' ? new Date().toISOString() : null
                })
                .eq('id', id)

            if (error) throw error

            const shipment = shipments.find(s => s.id === id)
            logShipmentAction(
                status,
                id,
                { ...shipment, status },
                user?.id,
                user?.full_name || 'Worker'
            )

            fetchShipments()
        } catch (error) {
            console.error('Error updating status:', error)
            alert('İşlem sırasında bir hata oluştu.')
        } finally {
            setProcessingId(null)
        }
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

            // Send notification to Managers and Driver
            try {
                await fetch('/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicleId: shipment.assigned_vehicle_id, // Notify driver if assigned
                        targetRoles: ['manager', 'dispatcher'], // Notify managers
                        title: 'Sevkiyat Hazırlandı! ✅',
                        body: `${shipment.customer_name} sevkiyatı ${user?.full_name || 'Çalışan'} tarafından hazırlandı.`,
                        data: {
                            shipmentId: id,
                            action: 'shipment_ready'
                        }
                    })
                })
            } catch (notifError) {
                console.error('Notification failed:', notifError)
            }
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
        if (activeTab === 'my_jobs') {
            return s.assigned_user_id === user?.id
        }

        // For other tabs, exclude my assigned jobs to keep "Warehouse" work separate
        if (s.assigned_user_id === user?.id) return false

        const isReady = s.preparation_status === 'ready'

        // Fix 1: Pickups should NOT appear in "Pending" (Hazırlanacak) tab
        // because they don't need warehouse preparation.
        if (activeTab === 'pending') {
            if (isReady) return false
            if (s.type === 'pickup') return false // Exclude pickups from pending
        }

        if (activeTab === 'ready') {
            if (!isReady) {
                // Pickups are implicitly "ready" for assignment/action, but maybe they should appear in Ready?
                // User said "mal alınacaksa zaten hazırdır".
                // If we want them to appear in "Ready" tab, we allow them here.
                // But usually "Ready" tab is for "Prepared Shipments" waiting for driver.
                // Let's include them in Ready if they are NOT assigned yet?
                // Or just hide them from "Pending".
                // Let's just hide them from Pending as requested.
                // If they are type 'pickup', they are effectively "ready" but maybe not marked as such in DB.
                // Let's show them in Ready tab if type is pickup?
                if (s.type === 'pickup') return true
                return false
            }
        }

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

    const myJobsCount = shipments.filter(s => s.assigned_user_id === user?.id).length
    // Update counts to reflect filter logic
    const pendingCount = shipments.filter(s =>
        s.preparation_status !== 'ready' &&
        s.assigned_user_id !== user?.id &&
        s.type !== 'pickup' // Exclude pickups
    ).length

    const readyCount = shipments.filter(s =>
        (s.preparation_status === 'ready' || s.type === 'pickup') && // Include pickups
        s.assigned_user_id !== user?.id
    ).length

    const renderTabs = () => (
        <div className="flex px-4 overflow-x-auto">
            <button
                onClick={() => setActiveTab('my_jobs')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'my_jobs'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
            >
                <span className="text-lg">🏃</span>
                İşlerim
                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs">
                    {myJobsCount}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'pending'
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
                className={`flex-1 min-w-[100px] py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'ready'
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
    )

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
                    <div className="border-t border-slate-100">
                        {renderTabs()}
                    </div>
                </div>
            )}

            {/* Dashboard specific tabs */}
            {isDashboard && (
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                    {renderTabs()}
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
                                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                        {shipment.customer_name}
                                        {shipment.type === 'pickup' && (
                                            <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-bold border border-orange-200">
                                                ALIM
                                            </span>
                                        )}
                                    </h3>
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

                                {activeTab === 'my_jobs' ? (
                                    <div className="flex gap-2 w-full">
                                        <button
                                            onClick={() => handleUpdateStatus(shipment.id, 'delivered')}
                                            disabled={processingId === shipment.id}
                                            className={`flex-1 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${shipment.type === 'pickup'
                                                    ? 'bg-orange-600 hover:bg-orange-700'
                                                    : 'bg-green-600 hover:bg-green-700'
                                                }`}
                                        >
                                            <CheckCircle size={16} />
                                            {shipment.type === 'pickup' ? 'Teslim Aldım' : 'Teslim Et'}
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(shipment.id, 'failed')}
                                            disabled={processingId === shipment.id}
                                            className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-bold text-sm hover:bg-red-200 transition-colors disabled:opacity-50"
                                        >
                                            Edilemedi
                                        </button>
                                    </div>
                                ) : activeTab === 'pending' ? (
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

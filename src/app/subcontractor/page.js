'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'
import { CheckCircle, Package, Clock, RefreshCw } from 'lucide-react'

export default function SubcontractorPage() {
    const { user, hasPermission, signOut } = useAuth()
    const [shipments, setShipments] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user) {
            fetchShipments()
        }
    }, [user])

    // Permission check
    if (!hasPermission(PERMISSIONS.VIEW_SUBCONTRACTOR_PANEL)) {
        logSecurityEvent(user?.id, user?.full_name || user?.username, '/subcontractor', 'Page Access Denied')
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center p-8 bg-white rounded-xl shadow-lg">
                    <h1 className="text-xl font-bold text-red-600 mb-2">Erişim Reddedildi</h1>
                    <p className="text-slate-600 mb-4">Bu sayfayı görüntüleme yetkiniz yok.</p>
                    <button
                        onClick={() => signOut()}
                        className="text-blue-600 hover:underline"
                    >
                        Çıkış Yap
                    </button>
                </div>
            </div>
        )
    }

    const fetchShipments = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('shipments')
            .select('*')
            .eq('status', 'production')
            .eq('assigned_user_id', user.id)
            .order('created_at', { ascending: false })

        if (data) setShipments(data)
        setLoading(false)
    }

    const handleMarkAsReady = async (shipment) => {
        if (!confirm('Bu siparişi "Hazır" olarak işaretlemek istediğinize emin misiniz? Sistemde otomatik olarak alım talebi oluşturulacaktır.')) return

        try {
            // Update shipment to be pending approval
            const updates = {
                status: 'pending_approval',
                type: 'pickup',
                preparation_status: 'ready',
                prepared_by_user_id: user.id,
                prepared_by_name: user.full_name,
                notes: shipment.notes ? `${shipment.notes}\n[Fason] Üretim tamamlandı, onay bekleniyor.` : '[Fason] Üretim tamamlandı, onay bekleniyor.'
            }

            const { error } = await supabase
                .from('shipments')
                .update(updates)
                .eq('id', shipment.id)

            if (error) throw error

            // Log action
            await logShipmentAction(
                'production_completed',
                shipment.id,
                { ...shipment, ...updates },
                user.id,
                user.full_name,
                { before: { status: 'production' }, after: updates }
            )

            // Notify managers
            // (Optional: Add notification logic here if needed)

            alert('Sipariş başarıyla hazırlandı ve alım listesine eklendi.')
            fetchShipments()

        } catch (err) {
            console.error('Error updating shipment:', err)
            alert('Bir hata oluştu: ' + err.message)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Package className="text-primary" />
                            Fason Üretim Paneli
                        </h1>
                        <p className="text-slate-500 mt-1">Hoşgeldiniz, {user?.full_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchShipments}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Yenile"
                        >
                            <RefreshCw size={20} />
                        </button>
                        <button
                            onClick={() => signOut()}
                            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors"
                        >
                            Çıkış Yap
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <Clock size={18} className="text-amber-600" />
                            Bekleyen Üretimler ({shipments.length})
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
                    ) : shipments.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">Harika!</h3>
                            <p className="text-slate-500">Bekleyen üretim siparişiniz bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {shipments.map(shipment => (
                                <div key={shipment.id} className="p-4 md:p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded">ÜRETİMDE</span>
                                            <span className="text-xs text-slate-400">#{shipment.id.slice(0, 8)}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 mb-1">{shipment.customer_name}</h3>
                                        {shipment.product_info && (
                                            <p className="text-sm font-medium text-blue-700 mb-1">📦 {shipment.product_info}</p>
                                        )}
                                        <p className="text-slate-600 text-sm mb-2">{shipment.delivery_address}</p>
                                        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                                            <span className="bg-slate-100 px-2 py-1 rounded">📦 {shipment.weight} Palet</span>
                                            {shipment.delivery_date && (
                                                <span className="bg-slate-100 px-2 py-1 rounded">📅 Teslim: {shipment.delivery_date}</span>
                                            )}
                                        </div>

                                        {/* Estimated Date Input */}
                                        <div className="mt-3 flex items-center gap-2">
                                            <label className="text-xs font-medium text-slate-600">Tahmini Bitiş:</label>
                                            <input
                                                type="date"
                                                className="text-sm border rounded px-2 py-1"
                                                defaultValue={shipment.estimated_completion_date || ''}
                                                onChange={async (e) => {
                                                    const date = e.target.value
                                                    if (!date) return

                                                    try {
                                                        const { error } = await supabase
                                                            .from('shipments')
                                                            .update({ estimated_completion_date: date })
                                                            .eq('id', shipment.id)

                                                        if (error) throw error
                                                        // Optionally, update the local state to reflect the change immediately
                                                        setShipments(prevShipments =>
                                                            prevShipments.map(s =>
                                                                s.id === shipment.id ? { ...s, estimated_completion_date: date } : s
                                                            )
                                                        );
                                                    } catch (err) {
                                                        console.error('Error updating date:', err)
                                                        alert('Tarih güncellenemedi')
                                                    }
                                                }}
                                            />
                                        </div>

                                        {shipment.notes && (
                                            <div className="mt-3 text-sm bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-100">
                                                <strong>Not:</strong> {shipment.notes}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleMarkAsReady(shipment)}
                                        className="w-full md:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-sm shadow-green-200 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={20} />
                                        Hazır (Onaya Gönder)
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

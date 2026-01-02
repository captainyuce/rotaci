'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'
import { Plus, X, User, Calendar } from 'lucide-react'

export default function SubcontractorsPage() {
    const { user, hasPermission } = useAuth()
    const [pendingApprovals, setPendingApprovals] = useState([])
    const [orders, setOrders] = useState([])
    const [subcontractors, setSubcontractors] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        customer_name: '',
        delivery_address: '',
        weight: '',
        delivery_date: '',
        assigned_user_id: '',
        notes: ''
    })

    useEffect(() => {
        // Set default date on client side to avoid hydration mismatch
        setFormData(prev => ({ ...prev, delivery_date: new Date().toLocaleDateString('en-CA') }))
        fetchData()
    }, [])

    // Permission check effect
    useEffect(() => {
        if (!loading && user && !hasPermission(PERMISSIONS.MANAGE_SUBCONTRACTORS)) {
            logSecurityEvent(user.id, user.full_name || user.username, '/dashboard/subcontractors', 'Page Access Denied')
        }
    }, [loading, user, hasPermission])

    const fetchData = async () => {
        try {
            // Fetch production orders
            const { data: ordersData } = await supabase
                .from('shipments')
                .select('*')
                .eq('status', 'production')
                .order('created_at', { ascending: false })

            // Fetch pending approvals
            const { data: approvalsData } = await supabase
                .from('shipments')
                .select('*')
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false })

            // Fetch subcontractors
            const { data: usersData } = await supabase
                .from('users')
                .select('id, full_name')
                .eq('role', 'subcontractor')

            if (ordersData) setOrders(ordersData)
            if (approvalsData) setPendingApprovals(approvalsData)
            if (usersData) setSubcontractors(usersData)
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.assigned_user_id) {
            alert('Lütfen bir fasoncu seçin.')
            return
        }

        try {
            const newOrder = {
                ...formData,
                type: 'pickup', // Will be pickup eventually
                status: 'production', // Special status for subcontractor
                created_by: user.id
            }

            const { data, error } = await supabase
                .from('shipments')
                .insert([newOrder])
                .select()

            if (error) throw error

            // Log action
            if (data && data[0]) {
                await logShipmentAction(
                    'created_subcontractor_order',
                    data[0].id,
                    data[0],
                    user.id,
                    user.full_name
                )
            }

            setIsModalOpen(false)
            setFormData({
                customer_name: '',
                delivery_address: '',
                weight: '',
                delivery_date: new Date().toLocaleDateString('en-CA'),
                assigned_user_id: '',
                notes: ''
            })
            fetchData()
            alert('Fason üretim emri oluşturuldu.')

        } catch (err) {
            console.error('Error creating order:', err)
            alert('Hata: ' + err.message)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Bu üretim emrini silmek istediğinize emin misiniz?')) return

        try {
            const { error } = await supabase
                .from('shipments')
                .delete()
                .eq('id', id)

            if (error) throw error

            await logShipmentAction(
                'deleted_subcontractor_order',
                id,
                {},
                user.id,
                user.full_name
            )

            fetchData()
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    const handleApprove = async (id) => {
        if (!confirm('Bu üretimi onaylamak ve alım listesine eklemek istediğinize emin misiniz?')) return

        try {
            const { error } = await supabase
                .from('shipments')
                .update({
                    status: 'pending', // Make it visible in main list
                    preparation_status: 'ready',
                    prepared_by: user.id,
                    prepared_by_name: user.full_name
                })
                .eq('id', id)

            if (error) throw error

            await logShipmentAction(
                'approved_subcontractor_order',
                id,
                {},
                user.id,
                user.full_name
            )

            fetchData()
            alert('Üretim onaylandı ve sevkiyat listesine eklendi.')
        } catch (err) {
            alert('Hata: ' + err.message)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
    }

    if (!hasPermission(PERMISSIONS.MANAGE_SUBCONTRACTORS)) {
        return <div className="p-8 text-center text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</div>
    }

    const allOrders = [...pendingApprovals, ...orders]

    return (
        <>
            {/* Main Content Container - Mimicking ShipmentsPage layout */}
            <div className="fixed left-4 right-4 md:left-20 md:right-auto top-20 md:top-4 bottom-20 md:bottom-4 md:w-[750px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto z-10">

                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Fason Takibi</h2>
                        <p className="text-xs text-slate-500">
                            {pendingApprovals.length} onay bekleyen, {orders.length} üretimde
                        </p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Plus size={16} />
                        Yeni Emir
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto">

                    {/* Stats Summary (Optional, kept compact) */}
                    <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50/50 border-b border-slate-100">
                        <div className="bg-white p-2 rounded border border-slate-200 text-center">
                            <div className="text-xs text-slate-500">Bekleyen</div>
                            <div className="font-bold text-orange-600">{pendingApprovals.length}</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200 text-center">
                            <div className="text-xs text-slate-500">Üretimde</div>
                            <div className="font-bold text-blue-600">{orders.length}</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200 text-center">
                            <div className="text-xs text-slate-500">Toplam Palet</div>
                            <div className="font-bold text-slate-700">
                                {(orders?.reduce((acc, curr) => acc + (parseInt(curr.weight) || 0), 0) || 0) +
                                    (pendingApprovals?.reduce((acc, curr) => acc + (parseInt(curr.weight) || 0), 0) || 0)}
                            </div>
                        </div>
                    </div>

                    {/* Unified List */}
                    <table className="w-full">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-left text-xs text-slate-600">
                                <th className="p-3 font-medium">Müşteri / Ürün</th>
                                <th className="p-3 font-medium">Fasoncu</th>
                                <th className="p-3 font-medium">Tarih</th>
                                <th className="p-3 font-medium">Miktar</th>
                                <th className="p-3 font-medium">Durum</th>
                                <th className="p-3 font-medium text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {allOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500 text-sm">
                                        Henüz kayıtlı bir işlem bulunmuyor.
                                    </td>
                                </tr>
                            ) : (
                                allOrders.map(order => {
                                    const isPending = order.status === 'pending_approval';
                                    return (
                                        <tr key={order.id} className={`transition-colors text-sm group ${isPending ? 'bg-orange-50/40 hover:bg-orange-50' : 'hover:bg-slate-50'}`}>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-900">{order.customer_name}</div>
                                                {order.product_info && (
                                                    <div className="text-xs text-blue-600 font-medium">{order.product_info}</div>
                                                )}
                                                <div className="text-xs text-slate-500 truncate max-w-[150px]">{order.delivery_address}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5">
                                                    <User size={14} className="text-slate-400" />
                                                    <span className="text-slate-700 text-xs">
                                                        {subcontractors.find(s => s.id === order.assigned_user_id)?.full_name || 'Bilinmiyor'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                                    <Calendar size={14} />
                                                    {order.estimated_completion_date ? (
                                                        <span className={isPending ? "text-orange-700 font-medium" : "text-blue-600 font-medium"}>
                                                            {order.estimated_completion_date}
                                                        </span>
                                                    ) : (
                                                        <span>{order.delivery_date}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium text-xs border border-slate-200">
                                                    {order.weight} P.
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                {isPending ? (
                                                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-orange-200 animate-pulse inline-flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-orange-600"></span>
                                                        ONAY BEK.
                                                    </span>
                                                ) : (
                                                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200 inline-flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-amber-600 animate-pulse"></span>
                                                        ÜRETİMDE
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {isPending && (
                                                        <button
                                                            onClick={() => handleApprove(order.id)}
                                                            className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors text-xs font-bold shadow-sm"
                                                            title="Onayla"
                                                        >
                                                            Onayla
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(order.id)}
                                                        className={`${isPending ? 'text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'} px-2 py-1 rounded transition-colors text-xs font-medium`}
                                                        title="Sil / İptal Et"
                                                    >
                                                        {isPending ? 'Red' : 'İptal'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto">
                    <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Yeni Fason Emri</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri / Firma Adı</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded-lg"
                                    value={formData.customer_name}
                                    onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                                    placeholder="Örn: ABC Tekstil"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Fasoncu Seçin</label>
                                <select
                                    required
                                    className="w-full p-2 border rounded-lg bg-white"
                                    value={formData.assigned_user_id}
                                    onChange={e => setFormData({ ...formData, assigned_user_id: e.target.value })}
                                >
                                    <option value="">-- Seçiniz --</option>
                                    {subcontractors.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                                {subcontractors.length === 0 && (
                                    <p className="text-xs text-red-500 mt-1">Sistemde kayıtlı fasoncu bulunamadı.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Miktar (Palet)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full p-2 border rounded-lg"
                                        value={formData.weight}
                                        onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teslim Tarihi</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2 border rounded-lg"
                                        value={formData.delivery_date}
                                        onChange={e => setFormData({ ...formData, delivery_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Adres / Lokasyon</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg"
                                    rows="2"
                                    value={formData.delivery_address}
                                    onChange={e => setFormData({ ...formData, delivery_address: e.target.value })}
                                    placeholder="Fasoncunun adresi veya teslimat noktası..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                                <textarea
                                    className="w-full p-2 border rounded-lg"
                                    rows="2"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Özel talimatlar..."
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-zinc-700"
                                >
                                    Oluştur
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}

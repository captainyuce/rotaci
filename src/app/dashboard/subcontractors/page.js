'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'
import { Plus, X, Package, User, Calendar, Truck } from 'lucide-react'

export default function SubcontractorsPage() {
    const { user, hasPermission } = useAuth()
    const [pendingApprovals, setPendingApprovals] = useState([])
    const [activeTab, setActiveTab] = useState('production') // 'production' | 'approvals'

    // ... (existing useEffect and permission check)

    const fetchData = async () => {
        setLoading(true)

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
        setLoading(false)
    }

    const handleApprove = async (id) => {
        if (!confirm('Bu üretimi onaylamak ve alım listesine eklemek istediğinize emin misiniz?')) return

        try {
            const { error } = await supabase
                .from('shipments')
                .update({
                    status: 'pending', // Make it visible in main list
                    preparation_status: 'ready'
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

    // ... (existing handleSubmit and handleDelete)

    return (
        <div className="p-4 md:p-8 pb-24 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Fason Takibi</h1>
                    <p className="text-slate-500">Fason üretim emirlerini yönetin ve takip edin.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                >
                    <Plus size={20} />
                    Yeni Emir
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium mb-1">Üretimdeki Emirler</div>
                    <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium mb-1">Onay Bekleyenler</div>
                    <div className="text-2xl font-bold text-orange-600">{pendingApprovals.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium mb-1">Aktif Fasoncular</div>
                    <div className="text-2xl font-bold text-blue-600">{subcontractors.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium mb-1">Toplam Palet</div>
                    <div className="text-2xl font-bold text-amber-600">
                        {orders.reduce((acc, curr) => acc + (parseInt(curr.weight) || 0), 0) +
                            pendingApprovals.reduce((acc, curr) => acc + (parseInt(curr.weight) || 0), 0)}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-4 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('production')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'production'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Üretimdekiler ({orders.length})
                </button>
                <button
                    onClick={() => setActiveTab('approvals')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'approvals'
                        ? 'text-orange-600 border-b-2 border-orange-600'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Onay Bekleyenler ({pendingApprovals.length})
                </button>
            </div>

            {/* Orders List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="p-4">Müşteri / Ürün</th>
                                <th className="p-4">Fasoncu</th>
                                <th className="p-4">Teslim Tarihi</th>
                                <th className="p-4">Miktar</th>
                                <th className="p-4">Durum</th>
                                <th className="p-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeTab === 'production' ? (
                                orders.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-500">
                                            Henüz aktif üretim emri bulunmuyor.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map(order => (
                                        <tr key={order.id} className="hover:bg-slate-50">
                                            <td className="p-4">
                                                <div className="font-medium text-slate-900">{order.customer_name}</div>
                                                {order.product_info && (
                                                    <div className="text-xs text-blue-600 font-medium">{order.product_info}</div>
                                                )}
                                                <div className="text-xs text-slate-500">{order.delivery_address}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-slate-400" />
                                                    <span className="text-slate-700">
                                                        {subcontractors.find(s => s.id === order.assigned_user_id)?.full_name || 'Bilinmiyor'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Calendar size={16} />
                                                    {order.estimated_completion_date ? (
                                                        <span className="text-blue-600 font-medium">{order.estimated_completion_date} (Tahmini)</span>
                                                    ) : (
                                                        <span>{order.delivery_date}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                                                    {order.weight} Palet
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-bold border border-amber-200">
                                                    ÜRETİMDE
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(order.id)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors text-xs font-medium"
                                                >
                                                    İptal Et
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                pendingApprovals.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-500">
                                            Onay bekleyen iş bulunmuyor.
                                        </td>
                                    </tr>
                                ) : (
                                    pendingApprovals.map(order => (
                                        <tr key={order.id} className="hover:bg-orange-50/50">
                                            <td className="p-4">
                                                <div className="font-medium text-slate-900">{order.customer_name}</div>
                                                {order.product_info && (
                                                    <div className="text-xs text-blue-600 font-medium">{order.product_info}</div>
                                                )}
                                                <div className="text-xs text-slate-500">{order.delivery_address}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-slate-400" />
                                                    <span className="text-slate-700">
                                                        {subcontractors.find(s => s.id === order.assigned_user_id)?.full_name || 'Bilinmiyor'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Calendar size={16} />
                                                    {order.estimated_completion_date || order.delivery_date}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                                                    {order.weight} Palet
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold border border-orange-200 animate-pulse">
                                                    ONAY BEKLİYOR
                                                </span>
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleApprove(order.id)}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors text-xs font-bold shadow-sm"
                                                >
                                                    Onayla
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(order.id)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors text-xs font-medium"
                                                >
                                                    Reddet
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
        </div>
    )
}

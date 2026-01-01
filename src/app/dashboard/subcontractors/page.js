'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'
import { Plus, X, Package, User, Calendar, Truck } from 'lucide-react'

export default function SubcontractorsPage() {
    const { user, hasPermission } = useAuth()
    const [orders, setOrders] = useState([])
    const [subcontractors, setSubcontractors] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        customer_name: '',
        delivery_address: '',
        weight: '',
        delivery_date: new Date().toLocaleDateString('en-CA'),
        assigned_user_id: '',
        notes: ''
    })

    // Permission check
    if (!hasPermission(PERMISSIONS.MANAGE_SUBCONTRACTORS)) {
        logSecurityEvent(user?.id, user?.full_name || user?.username, '/dashboard/subcontractors', 'Page Access Denied')
        return <div className="p-8 text-center text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</div>
    }

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)

        // Fetch production orders
        const { data: ordersData } = await supabase
            .from('shipments')
            .select('*')
            .eq('status', 'production')
            .order('created_at', { ascending: false })

        // Fetch subcontractors
        // Note: We need to filter users by role 'subcontractor'
        // Since role is in the users table, we can just select * where role = 'subcontractor'
        const { data: usersData } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('role', 'subcontractor')

        if (ordersData) setOrders(ordersData)
        if (usersData) setSubcontractors(usersData)
        setLoading(false)
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium mb-1">Toplam Emir</div>
                    <div className="text-2xl font-bold text-slate-900">{orders.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium mb-1">Aktif Fasoncular</div>
                    <div className="text-2xl font-bold text-blue-600">{subcontractors.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-sm font-medium mb-1">Toplam Palet</div>
                    <div className="text-2xl font-bold text-amber-600">
                        {orders.reduce((acc, curr) => acc + (parseInt(curr.weight) || 0), 0)}
                    </div>
                </div>
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
                            {orders.length === 0 ? (
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
                                                {order.delivery_date}
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

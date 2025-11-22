'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Plus, Search, MapPin, Edit, Trash2, Check, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

export default function ShipmentsPage() {
    const [shipments, setShipments] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        customer: '',
        load: '',
        delivery_time: '',
        notes: '',
        location_lat: 41.0082,
        location_lng: 28.9784
    })
    const [editId, setEditId] = useState(null)

    const fetchData = async () => {
        try {
            const [sRes, vRes] = await Promise.all([
                fetch('/api/shipments'),
                fetch('/api/vehicles')
            ])
            if (sRes.ok) setShipments(await sRes.json())
            if (vRes.ok) setVehicles(await vRes.json())
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        const url = '/api/shipments'
        const method = editId ? 'PUT' : 'POST'
        const body = editId ? { ...formData, id: editId } : formData

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setShowModal(false)
                setEditId(null)
                setFormData({
                    customer: '',
                    load: '',
                    delivery_time: '',
                    notes: '',
                    location_lat: 41.0082,
                    location_lng: 28.9784
                })
                fetchData()
            } else {
                alert('İşlem başarısız oldu.')
            }
        } catch (error) {
            console.error(error)
            alert('Bir hata oluştu.')
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Bu sevkiyatı silmek istediğinize emin misiniz?')) return

        try {
            const res = await fetch(`/api/shipments?id=${id}`, { method: 'DELETE' })
            if (res.ok) fetchData()
        } catch (error) {
            console.error(error)
        }
    }

    const handleEdit = (shipment) => {
        setFormData({
            customer: shipment.customer,
            load: shipment.load,
            delivery_time: shipment.delivery_time,
            notes: shipment.notes,
            location_lat: shipment.location_lat,
            location_lng: shipment.location_lng
        })
        setEditId(shipment.id)
        setShowModal(true)
    }

    const handleAssign = async (shipmentId, vehicleId) => {
        if (!vehicleId) return
        try {
            const res = await fetch('/api/shipments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: shipmentId, assigned_driver: vehicleId, status: 'assigned' })
            })
            if (res.ok) fetchData()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Sevkiyat Yönetimi</h1>
                <button
                    onClick={() => {
                        setEditId(null)
                        setFormData({
                            customer: '',
                            load: '',
                            delivery_time: '',
                            notes: '',
                            location_lat: 41.0082,
                            location_lng: 28.9784
                        })
                        setShowModal(true)
                    }}
                    className="btn btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} /> Yeni Sevkiyat
                </button>
            </div>

            {/* Shipments Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600">Müşteri</th>
                            <th className="p-4 font-semibold text-slate-600">Yük (kg)</th>
                            <th className="p-4 font-semibold text-slate-600">Teslimat Saati</th>
                            <th className="p-4 font-semibold text-slate-600">Durum</th>
                            <th className="p-4 font-semibold text-slate-600">Atanan Araç</th>
                            <th className="p-4 font-semibold text-slate-600 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {shipments.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-900">{s.customer}</td>
                                <td className="p-4 text-slate-600">{s.load}</td>
                                <td className="p-4 text-slate-600">{s.delivery_time}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold
                                        ${s.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                            s.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                                                s.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                                    `}>
                                        {s.status === 'pending' ? 'Bekliyor' :
                                            s.status === 'assigned' ? 'Atandı' :
                                                s.status === 'delivered' ? 'Teslim Edildi' : 'İptal'}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <select
                                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                                        value={s.assigned_driver || ''}
                                        onChange={(e) => handleAssign(s.id, e.target.value)}
                                    >
                                        <option value="">Atama Yapılmadı</option>
                                        {vehicles.map(v => (
                                            <option key={v.id} value={v.id}>{v.plate} ({v.current_load}/{v.capacity})</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 p-1">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 p-1">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {shipments.length === 0 && (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-slate-500">Henüz sevkiyat bulunmuyor.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row">
                        {/* Form Side */}
                        <div className="p-6 flex-1 space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {editId ? 'Sevkiyatı Düzenle' : 'Yeni Sevkiyat Ekle'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı</label>
                                    <input
                                        type="text" required className="w-full p-2 border rounded-lg"
                                        value={formData.customer}
                                        onChange={e => setFormData({ ...formData, customer: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Yük (kg)</label>
                                        <input
                                            type="number" required className="w-full p-2 border rounded-lg"
                                            value={formData.load}
                                            onChange={e => setFormData({ ...formData, load: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Teslimat Saati</label>
                                        <input
                                            type="time" className="w-full p-2 border rounded-lg"
                                            value={formData.delivery_time}
                                            onChange={e => setFormData({ ...formData, delivery_time: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg h-24"
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>

                                <div className="pt-4">
                                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                                        {editId ? 'Güncelle' : 'Kaydet'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Map Side */}
                        <div className="flex-1 bg-slate-100 p-4 min-h-[400px] relative">
                            <div className="absolute top-6 left-6 z-10 bg-white/90 p-2 rounded shadow text-xs font-bold text-slate-700">
                                <MapPin size={16} className="inline mr-1" />
                                Konum Seçmek İçin Haritaya Tıklayın
                            </div>
                            <div className="h-full rounded-xl overflow-hidden border border-slate-200">
                                <Map
                                    center={[formData.location_lat, formData.location_lng]}
                                    zoom={12}
                                    markers={[{ lat: formData.location_lat, lng: formData.location_lng }]}
                                    onMapClick={(latlng) => setFormData({
                                        ...formData,
                                        location_lat: latlng.lat,
                                        location_lng: latlng.lng
                                    })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

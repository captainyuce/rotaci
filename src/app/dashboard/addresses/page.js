'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, X, MapPin, Phone, Edit, Trash2 } from 'lucide-react'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

const CATEGORIES = [
    { id: 'customer', label: 'Müşteriler', color: 'blue' },
    { id: 'supplier', label: 'Tedarikçiler', color: 'green' },
    { id: 'subcontractor', label: 'Fasoncular', color: 'purple' }
]

export default function AddressesPage() {
    const [addresses, setAddresses] = useState([])
    const [activeCategory, setActiveCategory] = useState('customer')
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAddress, setEditingAddress] = useState(null)
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        notes: '',
        lat: 41.0082,
        lng: 28.9784,
        category: 'customer'
    })

    useEffect(() => {
        fetchAddresses()
    }, [])

    const fetchAddresses = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching addresses:', error)
        } else if (data) {
            setAddresses(data)
        }
        setLoading(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            const dataToSave = {
                name: formData.name,
                address: formData.address,
                phone: formData.phone,
                notes: formData.notes,
                lat: formData.lat,
                lng: formData.lng,
                category: formData.category
            }

            let error;

            if (editingAddress) {
                const { error: updateError } = await supabase
                    .from('addresses')
                    .update(dataToSave)
                    .eq('id', editingAddress.id)
                error = updateError
            } else {
                const { error: insertError } = await supabase
                    .from('addresses')
                    .insert([dataToSave])
                error = insertError
            }

            if (error) throw error

            setIsModalOpen(false)
            setEditingAddress(null)
            setFormData({
                name: '',
                address: '',
                phone: '',
                notes: '',
                lat: 41.0082,
                lng: 28.9784,
                category: activeCategory
            })
            fetchAddresses()
            alert('Adres başarıyla kaydedildi!')
        } catch (error) {
            console.error('Error saving address:', error)
            alert('Adres kaydedilirken bir hata oluştu: ' + error.message)
        }
    }

    const handleDelete = async (id) => {
        if (confirm('Bu adresi silmek istediğinize emin misiniz?')) {
            const { error } = await supabase.from('addresses').delete().eq('id', id)
            if (error) {
                console.error('Error deleting address:', error)
                alert('Silme işlemi başarısız oldu.')
            } else {
                fetchAddresses()
            }
        }
    }

    const handleOpenModal = (address = null) => {
        if (address) {
            setEditingAddress(address)
            setFormData({
                name: address.name,
                address: address.address,
                phone: address.phone || '',
                notes: address.notes || '',
                lat: address.lat || 41.0082,
                lng: address.lng || 28.9784,
                category: address.category || activeCategory
            })
        } else {
            setFormData({
                name: '',
                address: '',
                phone: '',
                notes: '',
                lat: 41.0082,
                lng: 28.9784,
                category: activeCategory
            })
        }
        setIsModalOpen(true)
    }

    const handleLocationSelect = (lat, lng) => {
        setFormData({
            ...formData,
            lat: lat,
            lng: lng
        })
    }

    const filteredAddresses = addresses.filter(addr => addr.category === activeCategory)

    return (
        <>
            <div className="fixed left-4 right-4 md:left-20 md:right-auto top-20 md:top-4 bottom-20 md:bottom-4 md:w-[600px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto z-10">
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Adres Defteri</h2>
                            <p className="text-xs text-slate-500">{addresses.length} kayıtlı adres</p>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
                        >
                            <Plus size={16} />
                            Yeni Adres
                        </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex gap-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeCategory === cat.id
                                    ? `bg-${cat.color}-600 text-white shadow-md`
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredAddresses.map((addr) => (
                        <div
                            key={addr.id}
                            className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-900">{addr.name}</h3>
                                    <div className="flex items-start gap-2 text-sm text-slate-600 mt-1">
                                        <MapPin size={14} className="mt-0.5 shrink-0" />
                                        <span>{addr.address}</span>
                                    </div>
                                    {addr.phone && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                                            <Phone size={14} />
                                            <span>{addr.phone}</span>
                                        </div>
                                    )}
                                    {addr.notes && (
                                        <p className="text-xs text-slate-500 mt-2 italic">{addr.notes}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-2">
                                        📍 {addr.lat?.toFixed(4)}, {addr.lng?.toFixed(4)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenModal(addr)}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(addr.id)}
                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredAddresses.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <MapPin size={48} className="mx-auto mb-3 opacity-50" />
                            <p>Bu kategoride henüz adres yok</p>
                            <button
                                onClick={() => handleOpenModal()}
                                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                                İlk adresi ekle
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto">
                    <div className="bg-white rounded-xl w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">
                                {editingAddress ? 'Adresi Düzenle' : 'Yeni Adres Ekle'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm bg-white"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">İsim / Firma Adı</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Haritadan Konum Seç (Haritaya tıklayın)
                                    </label>
                                    <div className="h-64 rounded-lg overflow-hidden border border-slate-200">
                                        <MapPicker
                                            center={[formData.lat, formData.lng]}
                                            onLocationSelect={handleLocationSelect}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Seçili Konum: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Açık Adres</label>
                                    <textarea
                                        required
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        rows="2"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Örn: Kadıköy Merkez, İstanbul"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                                    <input
                                        type="tel"
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+90 5XX XXX XX XX"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Ek bilgiler..."
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}

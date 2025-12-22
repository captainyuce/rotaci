'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, X, Trash2, Edit } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'

export default function VehiclesPage() {
    const { user, hasPermission } = useAuth()

    // Permission check
    if (!hasPermission(PERMISSIONS.MANAGE_VEHICLES)) {
        logSecurityEvent(user?.id, user?.full_name || user?.username, '/dashboard/vehicles', 'Page Access Denied')
        return <div className="p-8 text-center text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</div>
    }
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingVehicle, setEditingVehicle] = useState(null)
    const [formData, setFormData] = useState({
        plate: '',
        driver_name: '',
        capacity: '',
        driver_password: '',
        vehicle_type: 'van',
        bridge_preference: 'any'
    })

    useEffect(() => {
        fetchVehicles()
    }, [])

    const fetchVehicles = async () => {
        setLoading(true)
        const { data } = await supabase.from('vehicles').select('*').order('plate')
        if (data) setVehicles(data)
        setLoading(false)
    }

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('vehicles_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'vehicles'
            }, () => {
                fetchVehicles()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const handleOpenModal = (vehicle = null) => {
        if (vehicle) {
            setEditingVehicle(vehicle)
            setFormData({
                plate: vehicle.plate,
                driver_name: vehicle.driver_name || '',
                capacity: vehicle.capacity || '',
                driver_password: vehicle.driver_password || '',
                vehicle_type: vehicle.vehicle_type || 'van',
                bridge_preference: vehicle.bridge_preference || 'any'
            })
        } else {
            setEditingVehicle(null)
            setFormData({
                plate: '',
                driver_name: '',
                capacity: '',
                driver_password: '',
                vehicle_type: 'van',
                bridge_preference: 'any'
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (editingVehicle) {
            // Update existing vehicle
            const { error } = await supabase
                .from('vehicles')
                .update(formData)
                .eq('id', editingVehicle.id)

            if (error) {
                alert('Hata: ' + error.message)
                return
            }
        } else {
            // Create new vehicle
            const { error } = await supabase
                .from('vehicles')
                .insert([formData])

            if (error) {
                alert('Hata: ' + error.message)
                return
            }
        }

        if (editingVehicle) {
            await logShipmentAction(
                'updated',
                null,
                { type: 'vehicle', ...formData },
                user.id,
                user.full_name || user.username,
                { before: editingVehicle, after: formData }
            )
        } else {
            await logShipmentAction(
                'created',
                null,
                { type: 'vehicle', ...formData },
                user.id,
                user.full_name || user.username
            )
        }

        setIsModalOpen(false)
        setEditingVehicle(null)
        setFormData({ plate: '', driver_name: '', capacity: '', driver_password: '' })
        fetchVehicles()
    }

    const handleDelete = async (id) => {
        if (!hasPermission(PERMISSIONS.MANAGE_VEHICLES)) {
            logSecurityEvent(user?.id, user?.full_name || user?.username, 'delete_vehicle', `Attempted to delete vehicle ${id}`)
            alert('Bu işlem için yetkiniz yok')
            return
        }
        if (confirm('Bu aracı silmek istediğinize emin misiniz?')) {
            await supabase.from('vehicles').delete().eq('id', id)
            fetchVehicles()

            // Log deletion
            const deletedVehicle = vehicles.find(v => v.id === id)
            if (deletedVehicle) {
                await logShipmentAction(
                    'deleted',
                    null,
                    { type: 'vehicle', ...deletedVehicle },
                    user.id,
                    user.full_name || user.username
                )
            }
        }
    }

    return (
        <div className="fixed left-4 right-4 md:left-20 md:right-auto top-20 md:top-4 bottom-20 md:bottom-4 md:w-[600px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto z-10">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Araçlar</h2>
                    <p className="text-xs text-slate-500">{vehicles.length} araç</p>
                </div>
                {hasPermission(PERMISSIONS.MANAGE_VEHICLES) && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-primary hover:bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
                    >
                        <Plus size={16} />
                        Yeni
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100">
                        <div>
                            <h3 className="font-bold text-slate-800">{vehicle.plate}</h3>
                            <p className="text-sm text-slate-600">{vehicle.driver_name || 'Sürücü atanmamış'}</p>
                            {vehicle.capacity && (
                                <p className="text-xs text-slate-500">Kapasite: {vehicle.capacity} Palet</p>
                            )}
                        </div>
                        {hasPermission(PERMISSIONS.MANAGE_VEHICLES) && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOpenModal(vehicle)}
                                    className="p-1.5 text-slate-500 hover:text-primary hover:bg-zinc-50 rounded-lg transition-colors"
                                    title="Düzenle"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(vehicle.id)}
                                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Sil"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">{editingVehicle ? 'Aracı Düzenle' : 'Yeni Araç'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Araç Tipi</label>
                                <select
                                    className="w-full p-2 border rounded-lg text-slate-900 bg-white text-sm"
                                    value={formData.vehicle_type}
                                    onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                                >
                                    <option value="van">Panelvan (Örn: Ducato)</option>
                                    <option value="minivan">Minivan (Örn: Kangoo)</option>
                                    <option value="truck">Kamyon</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kapasite (Palet)</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full p-2 border rounded-lg text-slate-900 placeholder:text-slate-400 text-sm"
                                    value={formData.capacity}
                                    onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                                    placeholder="20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Plaka</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded-lg text-sm"
                                    value={formData.plate}
                                    onChange={e => setFormData({ ...formData, plate: e.target.value })}
                                    placeholder="34 ABC 123"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Sürücü Adı</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded-lg text-sm"
                                    value={formData.driver_name}
                                    onChange={e => setFormData({ ...formData, driver_name: e.target.value })}
                                    placeholder="Ahmet Yılmaz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kapasite (Palet)</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg text-sm"
                                    value={formData.capacity}
                                    onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                                    placeholder="20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Sürücü Şifresi</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border rounded-lg text-sm"
                                    value={formData.driver_password}
                                    onChange={e => setFormData({ ...formData, driver_password: e.target.value })}
                                    placeholder="Şifre (opsiyonel)"
                                />
                                <p className="text-xs text-slate-500 mt-1">Sürücü uygulamasına giriş için kullanılır</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Köprü Tercihi
                                    <span className="text-xs text-slate-500 ml-2">(Avrupa-Asya geçişi)</span>
                                </label>
                                <select
                                    className="w-full p-2 border rounded-lg text-slate-900 bg-white text-sm"
                                    value={formData.bridge_preference}
                                    onChange={e => setFormData({ ...formData, bridge_preference: e.target.value })}
                                >
                                    <option value="any">Tüm Köprüler</option>
                                    <option value="fsm_only">Sadece 3. Köprü (Yavuz Sultan Selim)</option>
                                    <option value="bosphorus_only">Sadece Boğaziçi Köprüsü (15 Temmuz)</option>
                                    <option value="fatih_only">Sadece Fatih Sultan Mehmet Köprüsü</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    💡 Kamyonlar için genellikle "Sadece 3. Köprü" seçilmelidir
                                </p>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary hover:bg-zinc-700 text-white py-2 rounded-lg font-medium transition-colors"
                            >
                                {editingVehicle ? 'Güncelle' : 'Ekle'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

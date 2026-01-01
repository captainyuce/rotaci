'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, X, Truck, Edit, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logShipmentAction, logSecurityEvent } from '@/lib/auditLog'
import ChatButton from '@/components/ChatButton'
import { shouldHideCompletedShipment } from '@/lib/shipmentHelpers'
import { getTurkeyDateString, getTurkeyTomorrowDateString, toTurkeyDateString } from '@/lib/dateHelpers'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

export default function ShipmentsPage() {
    const { user, hasPermission } = useAuth()

    // Permission check - MUST be after all hooks
    if (!hasPermission(PERMISSIONS.VIEW)) {
        logSecurityEvent(user?.id, user?.full_name || user?.username, '/dashboard/shipments', 'Page Access Denied')
        return <div className="p-8 text-center text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</div>
    }
    const [shipments, setShipments] = useState([])
    const [vehicles, setVehicles] = useState([])
    const [addresses, setAddresses] = useState([])
    const [users, setUsers] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('')
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingShipment, setEditingShipment] = useState(null)
    const [formData, setFormData] = useState({
        customer_name: '',
        delivery_address: '',
        weight: '',
        delivery_time: '',
        delivery_date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in local time
        notes: '',
        delivery_lat: 41.0082,
        delivery_lng: 28.9784,
        delivery_lat: 41.0082,
        delivery_lng: 28.9784,
        type: 'delivery',
        opening_time: '',
        closing_time: ''
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const [shipmentsRes, vehiclesRes, addressesRes, usersRes] = await Promise.all([
            supabase
                .from('shipments')
                .select('*')
                .neq('status', 'production')
                .order('created_at', { ascending: false }),
            supabase.from('vehicles').select('*').order('plate'),
            supabase.from('addresses').select('*').order('name'),
            supabase.from('users').select('id, full_name').order('full_name')
        ])

        if (shipmentsRes.data) setShipments(shipmentsRes.data)
        if (vehiclesRes.data) setVehicles(vehiclesRes.data)
        if (addressesRes.data) setAddresses(addressesRes.data)
        if (usersRes.data) setUsers(usersRes.data)
        setLoading(false)
    }

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('shipments_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shipments'
            }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (editingShipment && !hasPermission(PERMISSIONS.EDIT_SHIPMENTS)) {
            logSecurityEvent(user?.id, user?.full_name || user?.username, 'edit_shipment', `Attempted to edit shipment ${editingShipment.id}`)
            alert('Düzenleme yetkiniz yok.')
            return
        }
        if (!editingShipment && !hasPermission(PERMISSIONS.CREATE_SHIPMENTS)) {
            logSecurityEvent(user?.id, user?.full_name || user?.username, 'create_shipment', 'Attempted to create shipment')
            alert('Yeni sevkiyat ekleme yetkiniz yok.')
            return
        }

        if (editingShipment) {
            // Update shipment
            console.log('Updating shipment:', editingShipment.id)

            // Sanitize formData to exclude joined fields like 'creator'
            const shipmentData = {
                customer_name: formData.customer_name,
                delivery_address: formData.delivery_address,
                delivery_lat: parseFloat(formData.delivery_lat),
                delivery_lng: parseFloat(formData.delivery_lng),
                weight: parseInt(formData.weight),
                delivery_date: formData.delivery_date,
                delivery_time: formData.delivery_time,
                opening_time: formData.opening_time,
                closing_time: formData.closing_time,
                notes: formData.notes,
                type: formData.type || 'delivery',
                status: editingShipment ? editingShipment.status : 'pending',
                target_subcontractor_id: formData.is_subcontractor ? formData.target_subcontractor_id : null,
                product_info: formData.is_subcontractor ? formData.product_info : null
            }

            const { error } = await supabase
                .from('shipments')
                .update(shipmentData)
                .eq('id', editingShipment.id)

            if (error) {
                alert('Hata: ' + error.message)
                return
            }

            // Notify Driver if assigned
            if (formData.assigned_vehicle_id && formData.assigned_vehicle_id !== editingShipment.assigned_vehicle_id) {
                try {
                    await supabase.from('notifications').insert({
                        user_id: formData.assigned_vehicle_id, // Vehicle ID acts as User ID for drivers
                        title: 'Yeni İş Atandı',
                        message: `${formData.customer_name} adresine yeni bir sevkiyat atandı.`,
                        type: 'success',
                        link: '/driver'
                    })
                } catch (err) {
                    console.error('Error notifying driver:', err)
                }
            }

            // Log the update
            console.log('Logging update for:', editingShipment.id, user)
            await logShipmentAction(
                'updated',
                editingShipment.id,
                formData,
                user?.id,
                user?.full_name || 'Bilinmeyen Kullanıcı',
                { before: editingShipment, after: formData }
            )
            console.log('Update logged successfully')
        } else {
            // Create new shipment
            const { data, error } = await supabase
                .from('shipments')
                .insert([{ ...formData, created_by: user?.id }])
                .select()

            if (error) {
                alert('Hata: ' + error.message)
                return
            }

            // Log the creation
            if (data && data[0]) {
                console.log('Logging creation for:', data[0].id)
                await logShipmentAction(
                    'created',
                    data[0].id,
                    data[0],
                    user?.id,
                    user?.full_name || 'Bilinmeyen Kullanıcı'
                )

                // Notify Managers
                try {
                    // 1. Get all managers and admins
                    const { data: managers } = await supabase
                        .from('users')
                        .select('id')
                        .in('role', ['manager', 'admin'])

                    if (managers && managers.length > 0) {
                        const notifications = managers.map(manager => ({
                            user_id: manager.id,
                            title: 'Yeni Sevkiyat',
                            message: `${formData.customer_name} için yeni bir sevkiyat oluşturuldu. Oluşturan: ${user?.full_name || 'Bilinmeyen Kullanıcı'}`,
                            type: 'info',
                            link: '/dashboard/shipments'
                        }))

                        await supabase.from('notifications').insert(notifications)
                    }
                } catch (err) {
                    console.error('Error sending notifications:', err)
                }
            }
        }

        setIsModalOpen(false)
        setEditingShipment(null)
        setFormData({
            customer_name: '',
            delivery_address: '',
            weight: '',
            delivery_time: '',
            delivery_date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in local time
            notes: '',
            delivery_lat: 41.0082,
            delivery_lng: 28.9784,
            type: 'delivery'
        })
        fetchData()
    }

    const handleDelete = async (id) => {
        if (!hasPermission(PERMISSIONS.DELETE_SHIPMENTS)) {
            logSecurityEvent(user?.id, user?.full_name || user?.username, 'delete_shipment', `Attempted to delete shipment ${id}`)
            alert('Silme yetkiniz yok.')
            return
        }
        const shipmentToDelete = shipments.find(s => s.id === id)

        // Log the deletion BEFORE deleting (to avoid foreign key violation)
        if (shipmentToDelete) {
            console.log('Logging deletion for:', id)
            await logShipmentAction(
                'deleted',
                id,
                shipmentToDelete,
                user?.id,
                user?.full_name || 'Bilinmeyen Kullanıcı'
            )
            console.log('Deletion logged successfully')
        }

        // Now delete the shipment
        console.log('Deleting shipment:', id)
        await supabase.from('shipments').delete().eq('id', id)

        fetchData()
    }

    const handleOpenModal = (shipment = null) => {
        if (shipment) {
            setEditingShipment(shipment)
            setFormData(shipment)
        } else {
            setFormData({
                customer_name: '',
                delivery_address: '',
                weight: '',
                delivery_time: '',
                delivery_date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in local time
                notes: '',
                delivery_lat: 41.0082,
                delivery_lng: 28.9784,
                type: 'delivery',
                opening_time: '',
                closing_time: ''
            })
        }
        setSelectedCategory('')
        setIsModalOpen(true)
    }

    const handleReassign = async (id) => {
        if (!confirm('Bu sevkiyatı tekrar atamaya göndermek istediğinize emin misiniz?')) return

        const shipmentToUpdate = shipments.find(s => s.id === id)

        const { error } = await supabase
            .from('shipments')
            .update({ status: 'pending', assigned_vehicle_id: null })
            .eq('id', id)

        if (error) {
            alert('Hata: ' + error.message)
            return
        }

        // Log the action
        if (shipmentToUpdate) {
            await logShipmentAction(
                'updated',
                id,
                { ...shipmentToUpdate, status: 'pending', assigned_vehicle_id: null },
                user?.id,
                user?.full_name || 'Bilinmeyen Kullanıcı',
                { before: { status: 'failed' }, after: { status: 'pending' } }
            )
        }

        fetchData()
    }

    // Group shipments by date
    const groupShipmentsByDate = () => {
        const today = getTurkeyDateString()
        const tomorrow = getTurkeyTomorrowDateString()

        // Filter out shipments completed after 7 PM
        const visibleShipments = shipments.filter(s => !shouldHideCompletedShipment(s))

        const failedShipments = visibleShipments.filter(s => s.status === 'failed')
        // Exclude failed shipments from other lists to avoid duplication
        const activeShipments = visibleShipments.filter(s => s.status !== 'failed')

        // Helper function to get effective date
        const getEffectiveDate = (shipment) => {
            if ((shipment.status === 'delivered' || shipment.status === 'unloaded') && shipment.delivered_at) {
                // Convert UTC timestamp to Turkey date string
                return toTurkeyDateString(shipment.delivered_at)
            }
            return shipment.delivery_date
        }

        const todayShipments = activeShipments.filter(s => getEffectiveDate(s) === today)
        const tomorrowShipments = activeShipments.filter(s => getEffectiveDate(s) === tomorrow)
        const futureShipments = activeShipments.filter(s => getEffectiveDate(s) > tomorrow)
        const pastShipments = activeShipments.filter(s => getEffectiveDate(s) < today)

        return { failedShipments, todayShipments, tomorrowShipments, futureShipments, pastShipments }
    }

    const { failedShipments, todayShipments, tomorrowShipments, futureShipments, pastShipments } = groupShipmentsByDate()

    const renderShipmentRow = (shipment) => {
        const assignedVehicle = vehicles.find(v => v.id === shipment.assigned_vehicle_id)
        const assignedWorker = users.find(u => u.id === shipment.assigned_user_id)

        return (
            <tr key={shipment.id} className="hover:bg-slate-50 transition-colors group text-sm">
                <td className="p-3">
                    <div className="flex items-center gap-2">
                        {shipment.type === 'pickup' ? (
                            <ArrowDownCircle size={16} className="text-orange-600" title="Mal Al" />
                        ) : (
                            <ArrowUpCircle size={16} className="text-blue-600" title="Mal Bırak" />
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="font-medium text-slate-900">{shipment.customer_name}</div>
                                {shipment.preparation_status === 'ready' && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 border border-green-200" title={`Hazırlayan: ${shipment.prepared_by_name || 'Bilinmiyor'}`}>
                                        📦 Hazır
                                        {shipment.prepared_by_name && (
                                            <span className="text-green-600 opacity-75 border-l border-green-300 pl-1 ml-0.5">
                                                {shipment.prepared_by_name.split(' ')[0]}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-500">{shipment.delivery_time}</div>
                        </div>
                    </div>
                </td>
                <td className="p-3 max-w-xs truncate text-slate-600">{shipment.delivery_address}</td>
                <td className="p-3 text-slate-700">{shipment.weight} Palet</td>
                <td className="p-3">
                    {assignedVehicle ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                            <Truck size={14} className="text-primary" />
                            <span className="font-medium text-xs">{assignedVehicle.plate}</span>
                        </div>
                    ) : assignedWorker ? (
                        <div className="flex items-center gap-1.5 text-orange-700">
                            <span className="text-base">🏃</span>
                            <span className="font-medium text-xs">{assignedWorker.full_name}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400 text-xs">-</span>
                    )}
                </td>
                <td className="p-3 text-slate-600 text-xs">
                    {users.find(u => u.id === shipment.created_by)?.full_name || '-'}
                </td>
                <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${shipment.status === 'delivered' || shipment.status === 'unloaded' ? 'bg-green-100 text-green-700' :
                        shipment.status === 'assigned' ? 'bg-zinc-100 text-zinc-700' :
                            shipment.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                        }`}>
                        {(shipment.status === 'delivered' || shipment.status === 'unloaded')
                            ? (shipment.type === 'pickup' ? 'Teslim Alındı' : 'Teslim Edildi')
                            : shipment.status === 'assigned' ? 'Yolda'
                                : shipment.status === 'failed' ? 'Teslim Edilemedi'
                                    : 'Bekliyor'}
                    </span>
                </td>
                <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                        {shipment.status === 'failed' && (
                            <button
                                onClick={() => handleReassign(shipment.id)}
                                className="px-2 py-1 bg-primary text-white text-xs rounded hover:bg-zinc-700 transition-colors mr-2"
                                title="Tekrar Atamaya Gönder"
                            >
                                Tekrar Ata
                            </button>
                        )}
                        <ChatButton
                            shipmentId={shipment.id}
                            shipmentName={shipment.customer_name}
                        />
                        {hasPermission(PERMISSIONS.EDIT_SHIPMENTS) && (
                            <button
                                onClick={() => handleOpenModal(shipment)}
                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-zinc-50 rounded-lg transition-colors"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                        {hasPermission(PERMISSIONS.DELETE_SHIPMENTS) && (
                            <button
                                onClick={() => handleDelete(shipment.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </td>
            </tr>
        )
    }


    return (
        <>
            {/* Content Panel */}
            <div className="fixed left-4 right-4 md:left-20 md:right-auto top-20 md:top-4 bottom-20 md:bottom-4 md:w-[750px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto z-10">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Sevkiyatlar (Güncel)</h2>
                        <p className="text-xs text-slate-500">
                            {failedShipments.length + todayShipments.length + tomorrowShipments.length + futureShipments.length} sevkiyat
                        </p>
                    </div>
                    {hasPermission(PERMISSIONS.CREATE_SHIPMENTS) && (
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
                    {/* Failed Shipments - High Priority */}
                    {failedShipments.length > 0 && (
                        <div className="mb-4">
                            <div className="sticky top-0 bg-red-100 px-4 py-2 border-b border-red-200 z-10">
                                <h3 className="font-bold text-red-900 text-sm flex items-center gap-2">
                                    ⚠️ Teslim Edilemeyenler ({failedShipments.length})
                                </h3>
                            </div>
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-xs text-slate-600">
                                        <th className="p-3 font-medium">Müşteri</th>
                                        <th className="p-3 font-medium">Adres</th>
                                        <th className="p-3 font-medium">Palet</th>
                                        <th className="p-3 font-medium">Araç</th>
                                        <th className="p-3 font-medium">Oluşturan</th>
                                        <th className="p-3 font-medium">Durum</th>
                                        <th className="p-3 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {failedShipments.map(renderShipmentRow)}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {/* Today's Shipments */}
                    {todayShipments.length > 0 && (
                        <div className="mb-4">
                            <div className="sticky top-0 bg-zinc-50 px-4 py-2 border-b border-blue-100 z-10">
                                <h3 className="font-bold text-zinc-900 text-sm">Bugün ({todayShipments.length})</h3>
                            </div>
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-xs text-slate-600">
                                        <th className="p-3 font-medium">Müşteri</th>
                                        <th className="p-3 font-medium">Adres</th>
                                        <th className="p-3 font-medium">Palet</th>
                                        <th className="p-3 font-medium">Araç</th>
                                        <th className="p-3 font-medium">Oluşturan</th>
                                        <th className="p-3 font-medium">Durum</th>
                                        <th className="p-3 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {todayShipments.map(renderShipmentRow)}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Tomorrow's Shipments */}
                    {tomorrowShipments.length > 0 && (
                        <div className="mb-4">
                            <div className="sticky top-0 bg-amber-50 px-4 py-2 border-b border-amber-100 z-10">
                                <h3 className="font-bold text-amber-900 text-sm">Yarın ({tomorrowShipments.length})</h3>
                            </div>
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-xs text-slate-600">
                                        <th className="p-3 font-medium">Müşteri</th>
                                        <th className="p-3 font-medium">Adres</th>
                                        <th className="p-3 font-medium">Palet</th>
                                        <th className="p-3 font-medium">Araç</th>
                                        <th className="p-3 font-medium">Oluşturan</th>
                                        <th className="p-3 font-medium">Durum</th>
                                        <th className="p-3 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {tomorrowShipments.map(renderShipmentRow)}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Future Shipments */}
                    {futureShipments.length > 0 && (
                        <div className="mb-4">
                            <div className="sticky top-0 bg-slate-50 px-4 py-2 border-b border-slate-200 z-10">
                                <h3 className="font-bold text-slate-900 text-sm">İleri Tarihler ({futureShipments.length})</h3>
                            </div>
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr className="text-left text-xs text-slate-600">
                                        <th className="p-3 font-medium">Müşteri</th>
                                        <th className="p-3 font-medium">Adres</th>
                                        <th className="p-3 font-medium">Palet</th>
                                        <th className="p-3 font-medium">Araç</th>
                                        <th className="p-3 font-medium">Oluşturan</th>
                                        <th className="p-3 font-medium">Durum</th>
                                        <th className="p-3 font-medium"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {futureShipments.map(renderShipmentRow)}
                                </tbody>
                            </table>
                        </div>
                    )}


                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto">
                    <div className="bg-white rounded-xl w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">{editingShipment ? 'Sevkiyatı Düzenle' : 'Yeni Sevkiyat'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Address Selector */}
                            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                                <p className="text-xs font-medium text-zinc-900 mb-2">📍 Kayıtlı Adres Seç (Opsiyonel)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 mb-1">1. Kategori</label>
                                        <select
                                            className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white text-slate-900"
                                            value={selectedCategory}
                                            onChange={(e) => setSelectedCategory(e.target.value)}
                                        >
                                            <option value="">-- Seçiniz --</option>
                                            <option value="customer">Müşteri</option>
                                            <option value="supplier">Tedarikçi</option>
                                            <option value="subcontractor">Fasoncu</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 mb-1">2. Adres</label>
                                        <select
                                            className="w-full p-2 border border-zinc-200 rounded-lg text-sm bg-white text-slate-900"
                                            disabled={!selectedCategory}
                                            onChange={(e) => {
                                                const selectedAddress = addresses.find(a => a.id === e.target.value)
                                                console.log('Selected Address:', selectedAddress)
                                                if (selectedAddress) {
                                                    console.log('Setting coordinates:', selectedAddress.lat, selectedAddress.lng)
                                                    setFormData({
                                                        ...formData,
                                                        customer_name: selectedAddress.name,
                                                        delivery_address: selectedAddress.address,
                                                        delivery_lat: selectedAddress.lat || 41.0082,
                                                        delivery_lng: selectedAddress.lng || 28.9784,
                                                        opening_time: selectedAddress.opening_time || '',
                                                        closing_time: selectedAddress.closing_time || ''
                                                    })
                                                }
                                            }}
                                        >
                                            <option value="">-- Adres Seçin --</option>
                                            {addresses
                                                .filter(addr => addr.category === selectedCategory)
                                                .map(addr => (
                                                    <option key={addr.id} value={addr.id}>
                                                        {addr.name}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Map Picker */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Haritadan Konum Seç (Haritaya tıklayın)
                                    </label>
                                    <div className="h-64 rounded-lg overflow-hidden border border-slate-200">
                                        <MapPicker
                                            center={[formData.delivery_lat, formData.delivery_lng]}
                                            onLocationSelect={(lat, lng) => setFormData({ ...formData, delivery_lat: lat, delivery_lng: lng })}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Seçili Konum: {formData.delivery_lat.toFixed(6)}, {formData.delivery_lng.toFixed(6)}
                                    </p>
                                </div>

                                {/* Shipment Type */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">İşlem Türü</label>
                                    <div className="flex gap-4 mb-4">
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.type === 'delivery'
                                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="type"
                                                value="delivery"
                                                checked={formData.type === 'delivery' || !formData.type}
                                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                className="hidden"
                                            />
                                            <ArrowUpCircle size={20} />
                                            <span className="font-medium">Mal Bırak (Teslimat)</span>
                                        </label>
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${formData.type === 'pickup'
                                            ? 'bg-orange-50 border-orange-500 text-orange-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="type"
                                                value="pickup"
                                                checked={formData.type === 'pickup'}
                                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                className="hidden"
                                            />
                                            <ArrowDownCircle size={20} />
                                            <span className="font-medium">Mal Al (Toplama)</span>
                                        </label>
                                    </div>

                                    {/* Subcontractor Toggle */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            id="isSubcontractor"
                                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                            checked={formData.is_subcontractor || false}
                                            onChange={e => setFormData({ ...formData, is_subcontractor: e.target.checked })}
                                        />
                                        <label htmlFor="isSubcontractor" className="text-sm font-medium text-slate-700">
                                            Fasona Sevk (Üretim İçin Gönderim)
                                        </label>
                                    </div>

                                    {formData.is_subcontractor && (
                                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-amber-800 mb-1">Fasoncu Seçin</label>
                                                <select
                                                    className="w-full p-2 border border-amber-300 rounded-lg bg-white"
                                                    value={formData.target_subcontractor_id || ''}
                                                    onChange={e => setFormData({ ...formData, target_subcontractor_id: e.target.value })}
                                                    required={formData.is_subcontractor}
                                                >
                                                    <option value="">-- Seçiniz --</option>
                                                    {users
                                                        .filter(u => u.role === 'subcontractor')
                                                        .map(u => (
                                                            <option key={u.id} value={u.id}>{u.full_name}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-amber-800 mb-1">Ürün Bilgisi</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border border-amber-300 rounded-lg"
                                                    value={formData.product_info || ''}
                                                    onChange={e => setFormData({ ...formData, product_info: e.target.value })}
                                                    placeholder="Örn: X Kumaş, Y İplik..."
                                                    required={formData.is_subcontractor}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Customer Name */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri / Firma Adı</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.customer_name}
                                        onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                                        placeholder="Örn: ABC Market"
                                    />
                                </div>

                                {/* Delivery Address */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teslimat Adresi</label>
                                    <textarea
                                        required
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        rows="2"
                                        value={formData.delivery_address}
                                        onChange={e => setFormData({ ...formData, delivery_address: e.target.value })}
                                        placeholder="Örn: Kadıköy Merkez, İstanbul"
                                    />
                                </div>

                                {/* Weight */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Palet Sayısı</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.weight}
                                        onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>

                                {/* Delivery Time */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teslimat Saati</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.delivery_time}
                                        onChange={e => setFormData({ ...formData, delivery_time: e.target.value })}
                                        placeholder="Örn: 14:00"
                                    />
                                </div>

                                {/* Working Hours */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Açılış Saati</label>
                                    <input
                                        type="time"
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.opening_time || ''}
                                        onChange={e => setFormData({ ...formData, opening_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Kapanış Saati</label>
                                    <input
                                        type="time"
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.closing_time || ''}
                                        onChange={e => setFormData({ ...formData, closing_time: e.target.value })}
                                    />
                                </div>

                                {/* Delivery Date */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Teslimat Tarihi</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        value={formData.delivery_date}
                                        onChange={e => setFormData({ ...formData, delivery_date: e.target.value })}
                                    />
                                </div>

                                {/* Notes */}
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg text-sm text-slate-900"
                                        rows="2"
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
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-zinc-700 text-sm font-medium"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )
            }
        </>
    )
}

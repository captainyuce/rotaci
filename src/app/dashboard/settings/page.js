'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Save, MapPin, Building2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

export default function SettingsPage() {
    const { user, hasPermission } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [baseAddress, setBaseAddress] = useState({
        address: '',
        lat: '',
        lng: '',
        returnToDepot: true // Default to true
    })

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('key', 'base_address')
            .single()

        if (data && data.value) {
            try {
                const parsed = JSON.parse(data.value)
                // Merge with default to ensure returnToDepot exists if not in DB
                setBaseAddress({ returnToDepot: true, ...parsed })
            } catch (e) {
                console.error('Error parsing settings:', e)
            }
        }
        setLoading(false)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)

        const value = JSON.stringify(baseAddress)

        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'base_address', value })

        if (error) {
            alert('Hata: ' + error.message)
        } else {
            alert('Ayarlar kaydedildi!')
            await logShipmentAction(
                'updated',
                null,
                { type: 'settings', key: 'base_address', value: baseAddress },
                user.id,
                user.full_name || user.username
            )
        }
        setSaving(false)
    }

    if (!hasPermission(PERMISSIONS.MANAGE_SETTINGS)) {
        return (
            <div className="h-full flex flex-col bg-white">
                <div className="p-8 text-center">
                    <div className="text-red-600 text-6xl mb-4">🚫</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Yetkiniz Yok</h2>
                    <p className="text-slate-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed left-4 right-4 md:left-20 md:right-auto top-20 md:top-4 bottom-20 md:bottom-4 md:w-[600px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto z-10">
            <div className="p-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Ayarlar</h2>
                <p className="text-xs text-slate-500">Sistem genel ayarlarını yapılandırın</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Building2 size={20} className="text-primary" />
                            Merkez Depo Adresi
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Adres Başlığı / Açık Adres
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={baseAddress.address}
                                    onChange={e => setBaseAddress({ ...baseAddress, address: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                    placeholder="Örn: Merkez Depo, İkitelli OSB..."
                                />
                            </div>

                            {/* Map Picker */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Konum Seç (Haritaya tıklayın)
                                </label>
                                <div className="h-64 rounded-lg overflow-hidden border border-slate-200 mb-2">
                                    {baseAddress.lat && baseAddress.lng ? (
                                        <MapPicker
                                            center={[baseAddress.lat, baseAddress.lng]}
                                            onLocationSelect={(lat, lng) => setBaseAddress({ ...baseAddress, lat, lng })}
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center bg-slate-100 text-slate-500">
                                            Harita yükleniyor...
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Enlem (Latitude)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={baseAddress.lat}
                                        onChange={e => setBaseAddress({ ...baseAddress, lat: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                        placeholder="41.0082"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Boylam (Longitude)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={baseAddress.lng}
                                        onChange={e => setBaseAddress({ ...baseAddress, lng: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                        placeholder="28.9784"
                                    />
                                </div>
                            </div>

                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin size={12} />
                                Bu koordinatlar rota optimizasyonu için başlangıç noktası olarak kullanılacaktır.
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={baseAddress.returnToDepot}
                                            onChange={e => setBaseAddress({ ...baseAddress, returnToDepot: e.target.checked })}
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-primary checked:bg-primary hover:border-primary"
                                        />
                                        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Rotayı Depoda Bitir</span>
                                        <span className="text-xs text-slate-500">Araç tüm teslimatları tamamladıktan sonra depoya dönüş rotası oluşturulur.</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-primary hover:bg-zinc-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Kaydediliyor...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Kaydet
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

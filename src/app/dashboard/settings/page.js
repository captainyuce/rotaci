'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Save, MapPin, Building2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'

export default function SettingsPage() {
    const { hasPermission } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [baseAddress, setBaseAddress] = useState({
        address: '',
        lat: '',
        lng: ''
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
                setBaseAddress(parsed)
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
        }
        setSaving(false)
    }

    if (!hasPermission(PERMISSIONS.MANAGE_ADDRESSES)) { // Using MANAGE_ADDRESSES as a proxy for settings access
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

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Save, MapPin, Building2, Moon, Sun, Shield, Key, Layout, Settings as SettingsIcon } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logShipmentAction } from '@/lib/auditLog'
import { useTheme } from '@/components/ThemeProvider'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false })

export default function SettingsPage() {
    const { user, hasPermission } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const [activeTab, setActiveTab] = useState('general')

    // Warehouse Settings State
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [baseAddress, setBaseAddress] = useState({
        address: '',
        lat: '',
        lng: '',
        returnToDepot: true
    })

    // Password Change State
    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    })
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [passwordLoading, setPasswordLoading] = useState(false)

    useEffect(() => {
        if (hasPermission(PERMISSIONS.MANAGE_SETTINGS)) {
            fetchSettings()
        } else {
            setLoading(false)
        }
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('settings')
            .select('*')
            .eq('key', 'base_address')
            .single()

        if (data && data.value) {
            try {
                const parsed = JSON.parse(data.value)
                setBaseAddress({ returnToDepot: true, ...parsed })
            } catch (e) {
                console.error('Error parsing settings:', e)
            }
        }
        setLoading(false)
    }

    const handleSaveWarehouse = async (e) => {
        e.preventDefault()
        setSaving(true)

        const value = JSON.stringify(baseAddress)

        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'base_address', value })

        if (error) {
            alert('Hata: ' + error.message)
        } else {
            alert('Depo ayarları kaydedildi!')
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

    const handlePasswordChange = async (e) => {
        e.preventDefault()
        setPasswordError('')
        setPasswordSuccess('')

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('Şifreler eşleşmiyor.')
            return
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordError('Şifre en az 6 karakter olmalıdır.')
            return
        }

        setPasswordLoading(true)

        const { error } = await supabase.auth.updateUser({
            password: passwordData.newPassword
        })

        if (error) {
            setPasswordError('Hata: ' + error.message)
        } else {
            setPasswordSuccess('Şifreniz başarıyla güncellendi.')
            setPasswordData({ newPassword: '', confirmPassword: '' })
        }
        setPasswordLoading(false)
    }

    const tabs = [
        { id: 'general', label: 'Genel', icon: Layout },
        { id: 'system', label: 'Sistem', icon: SettingsIcon, permission: PERMISSIONS.MANAGE_SETTINGS },
        { id: 'security', label: 'Güvenlik', icon: Shield },
    ]

    return (
        <div className="fixed inset-4 md:inset-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row overflow-hidden pointer-events-auto z-10 transition-colors duration-300">
            {/* Sidebar / Tabs */}
            <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2">
                <div className="mb-6 px-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ayarlar</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sistem yapılandırması</p>
                </div>

                {tabs.map(tab => {
                    if (tab.permission && !hasPermission(tab.permission)) return null
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                                }`}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-white dark:bg-slate-900">

                {/* General Tab */}
                {activeTab === 'general' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Görünüm</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Uygulama temasını tercihlerinize göre özelleştirin.</p>

                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-500'}`}>
                                        {theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">
                                            {theme === 'dark' ? 'Karanlık Mod' : 'Aydınlık Mod'}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {theme === 'dark' ? 'Göz yormayan karanlık tema aktif.' : 'Varsayılan aydınlık tema aktif.'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleTheme}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                                >
                                    Değiştir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* System Tab */}
                {activeTab === 'system' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <form onSubmit={handleSaveWarehouse}>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Depo Yapılandırması</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Merkez depo konumu ve rota başlangıç ayarları.</p>

                            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Adres Başlığı / Açık Adres
                                    </label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={baseAddress.address}
                                            onChange={e => setBaseAddress({ ...baseAddress, address: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
                                            placeholder="Örn: Merkez Depo, İkitelli OSB..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Konum Seçimi
                                    </label>
                                    <div className="h-64 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-2">
                                        {baseAddress.lat && baseAddress.lng ? (
                                            <MapPicker
                                                center={[baseAddress.lat, baseAddress.lng]}
                                                onLocationSelect={(lat, lng) => setBaseAddress({ ...baseAddress, lat, lng })}
                                            />
                                        ) : (
                                            <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500">
                                                Harita yükleniyor...
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={baseAddress.lat}
                                            onChange={e => setBaseAddress({ ...baseAddress, lat: parseFloat(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                                            placeholder="Enlem"
                                        />
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            value={baseAddress.lng}
                                            onChange={e => setBaseAddress({ ...baseAddress, lng: parseFloat(e.target.value) })}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                                            placeholder="Boylam"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={baseAddress.returnToDepot}
                                                onChange={e => setBaseAddress({ ...baseAddress, returnToDepot: e.target.checked })}
                                                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 dark:border-slate-600 transition-all checked:border-primary checked:bg-primary hover:border-primary"
                                            />
                                            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Rotayı Depoda Bitir</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-500">Araç tüm teslimatları tamamladıktan sonra depoya dönüş rotası oluşturulur.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end mt-6">
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
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <form onSubmit={handlePasswordChange}>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Güvenlik Ayarları</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Hesap şifrenizi ve güvenlik tercihlerinizi yönetin.</p>

                            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">

                                {passwordError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                                        {passwordError}
                                    </div>
                                )}

                                {passwordSuccess && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg border border-green-200 dark:border-green-800">
                                        {passwordSuccess}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Yeni Şifre
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Yeni Şifre (Tekrar)
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={passwordData.confirmPassword}
                                            onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-6">
                                <button
                                    type="submit"
                                    disabled={passwordLoading}
                                    className="bg-primary hover:bg-zinc-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {passwordLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Güncelleniyor...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            Şifreyi Güncelle
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import LocationTracker from '@/components/LocationTracker'
import { useRouter } from 'next/navigation'
import { LogOut, Truck, Bell, BellOff } from 'lucide-react'
import { subscribeToPushNotifications, isPushNotificationSupported } from '@/lib/pushNotifications'
import { supabase } from '@/lib/supabaseClient'

export default function DriverLayout({ children }) {
    const { user, role, loading, signOut } = useAuth()
    const router = useRouter()
    const [notificationsEnabled, setNotificationsEnabled] = useState(false)
    const [showNotificationPrompt, setShowNotificationPrompt] = useState(false)

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login')
            } else if (role !== 'driver') {
                router.push('/dashboard')
            } else {
                // Check if notifications are already enabled
                checkNotificationStatus()
            }
        }
    }, [user, role, loading, router])

    const checkNotificationStatus = async () => {
        console.log('=== NOTIFICATION DEBUG ===')
        console.log('serviceWorker supported:', 'serviceWorker' in navigator)
        console.log('PushManager supported:', 'PushManager' in window)
        console.log('Notification supported:', 'Notification' in window)
        console.log('Current permission:', Notification?.permission)
        console.log('User Agent:', navigator.userAgent)

        // Force show prompt if Notification API exists (even without PushManager)
        if (!('Notification' in window)) {
            console.error('Notification API not supported')
            return
        }

        const permission = Notification.permission
        console.log('Permission status:', permission)

        if (permission === 'granted') {
            setNotificationsEnabled(true)
        } else if (permission === 'default') {
            // Show prompt after a short delay
            console.log('Showing notification prompt in 2 seconds...')
            setTimeout(() => {
                console.log('Displaying notification prompt now')
                setShowNotificationPrompt(true)
            }, 2000)
        } else {
            console.log('Permission denied')
        }
    }

    const enableNotifications = async () => {
        try {
            const subscription = await subscribeToPushNotifications(user.id)

            // Save subscription to database
            await supabase
                .from('vehicles')
                .update({
                    push_subscription: subscription.toJSON()
                })
                .eq('id', user.id)

            setNotificationsEnabled(true)
            setShowNotificationPrompt(false)

            console.log('Push notifications enabled')
        } catch (error) {
            console.error('Failed to enable notifications:', error)
            alert('Bildirimler etkinleştirilemedi. Lütfen tarayıcı ayarlarınızı kontrol edin.')
        }
    }

    if (loading || !user || role !== 'driver') {
        return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
    }

    // Debug info for display
    const debugInfo = {
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: 'PushManager' in window,
        notification: 'Notification' in window,
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'N/A',
        isChrome: navigator.userAgent.includes('Chrome'),
        isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
            {/* Mobile Header */}
            <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-40 rounded-xl mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Truck size={24} />
                        <h1 className="font-bold text-lg">Sürücü Paneli</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/90 rounded px-2 py-1">
                            <img src="/logo.png" alt="Logo" className="h-6 w-auto" />
                        </div>
                        <button onClick={signOut} className="text-blue-100 hover:text-white">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Notification Permission Prompt */}
            {showNotificationPrompt && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md shadow-2xl">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bell size={32} className="text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Bildirimleri Etkinleştir</h3>
                            <p className="text-slate-600 text-sm">
                                Yeni sevkiyatlar atandığında anında bildirim almak ister misiniz?
                                Ekranınız kapalıyken bile bildirim alabilirsiniz.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowNotificationPrompt(false)}
                                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                            >
                                Şimdi Değil
                            </button>
                            <button
                                onClick={enableNotifications}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Etkinleştir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="max-w-2xl mx-auto">
                {children}
            </main>

            {/* Status Indicators Stack */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
                {/* Notification Indicator */}
                {isPushNotificationSupported() && (
                    <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors ${notificationsEnabled ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}
                        title={notificationsEnabled ? 'Bildirimler Aktif' : 'Bildirimler Kapalı'}
                    >
                        {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
                    </div>
                )}

                {/* GPS Tracker */}
                <LocationTracker />
            </div>
        </div>
    )
}

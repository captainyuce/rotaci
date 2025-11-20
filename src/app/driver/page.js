'use client'

import { useState, useEffect } from 'react'
import Map from '@/components/Map/MapComponent'
import { initialVehicles } from '@/lib/data'
import { useRouter } from 'next/navigation'

export default function DriverPage() {
    const router = useRouter()
    // Simulating Driver 1
    const [myVehicle, setMyVehicle] = useState(initialVehicles[0])
    const [notifications, setNotifications] = useState([])

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user) {
            router.push('/login');
        }
    }, []);

    // Simulate receiving a notification
    useEffect(() => {
        const timer = setTimeout(() => {
            setNotifications(prev => [...prev, { id: 1, message: 'Rota Güncellendi: Yeni durak eklendi!', time: 'Şimdi' }])
        }, 5000)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <header style={{ padding: '1rem', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img src="/akalbatu-logo.png" alt="Akalbatu" style={{ height: '24px', filter: 'brightness(0) invert(1)' }} />
                    <div>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Sürücü Paneli</h1>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{myVehicle.name}</div>
                    </div>
                </div>
                <Link href="/" style={{ color: 'white', textDecoration: 'none', fontSize: '0.875rem' }}>Çıkış</Link>
            </header>

            <div style={{ flex: 1, position: 'relative' }}>
                <Map vehicles={[myVehicle]} />

                {/* Notification Overlay */}
                {notifications.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '1rem',
                        right: '1rem',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        {notifications.map(notif => (
                            <div key={notif.id} className="card" style={{ borderLeft: '4px solid var(--primary)', animation: 'slideIn 0.3s ease-out' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Bildirim</div>
                                <div>{notif.message}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>{notif.time}</div>
                                <button
                                    onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                                    style={{
                                        marginTop: '0.5rem',
                                        width: '100%',
                                        padding: '0.5rem',
                                        background: '#eff6ff',
                                        border: 'none',
                                        color: 'var(--primary)',
                                        fontWeight: '600',
                                        borderRadius: '0.25rem'
                                    }}
                                >
                                    Tamam, Anlaşıldı
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: '1rem', background: 'white', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginBottom: '0.5rem' }}>Sonraki Hedef</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{myVehicle.nextStop}</div>
                <button className="btn btn-primary" style={{ width: '100%' }}>Navigasyonu Başlat</button>
            </div>
        </div>
    )
}

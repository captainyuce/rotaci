'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'
import { login } from '@/lib/api'
import { ROLES } from '@/lib/data'

export default function LoginPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const [loginMode, setLoginMode] = useState('user') // 'user' or 'vehicle'
    const [vehicles, setVehicles] = useState([])

    useEffect(() => {
        // Load vehicles for dropdown
        async function loadVehicles() {
            try {
                const res = await fetch('/api/vehicles')
                if (res.ok) {
                    setVehicles(await res.json())
                }
            } catch (e) { console.error(e) }
        }
        loadVehicles()
    }, [])

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            if (loginMode === 'vehicle') {
                // Vehicle Login Logic
                const vehicleId = e.target.vehicleId.value
                const vehicle = vehicles.find(v => v.id === vehicleId)

                if (vehicle) {
                    // Create a session for the vehicle
                    const vehicleUser = {
                        id: vehicle.id,
                        username: vehicle.plate,
                        name: vehicle.name,
                        role: ROLES.DRIVER,
                        vehicleId: vehicle.id // Important for driver page
                    }

                    localStorage.setItem('currentUser', JSON.stringify(vehicleUser))
                    router.push('/driver')
                } else {
                    setError('Araç bulunamadı!')
                }
            } else {
                // Standard User Login
                const result = await login(username, password)
                if (result.success) {
                    localStorage.setItem('currentUser', JSON.stringify(result.user))

                    if (result.user.role === ROLES.DRIVER) {
                        router.push('/driver')
                    } else {
                        router.push('/dashboard')
                    }
                } else {
                    setError('Kullanıcı adı veya şifre hatalı!')
                }
            }
        } catch (err) {
            setError('Giriş yapılırken bir hata oluştu!')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="card w-full max-w-md p-8 shadow-xl bg-white">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">Akalbatu Lojistik</h1>
                    <p className="text-slate-500">Rota Optimizasyon Sistemi</p>
                </div>

                {/* Login Mode Toggle */}
                <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
                    <button
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMode === 'user' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setLoginMode('user')}
                    >
                        Yönetici Girişi
                    </button>
                    <button
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMode === 'vehicle' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setLoginMode('vehicle')}
                    >
                        Araç Girişi
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    {loginMode === 'user' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="input w-full"
                                    placeholder="Kullanıcı adınızı giriniz"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input w-full"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Araç Seçiniz</label>
                            <select name="vehicleId" className="input w-full" required>
                                <option value="">Plaka Seçiniz...</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.plate} - {v.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full py-3 font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Giriş Yapılıyor...
                            </span>
                        ) : (
                            'Giriş Yap'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}

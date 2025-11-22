'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, User, Lock, LogIn } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [loginMode, setLoginMode] = useState('user') // 'user' or 'vehicle'
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [vehicles, setVehicles] = useState([])
    const [selectedVehicle, setSelectedVehicle] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        // Load vehicles for dropdown
        async function loadVehicles() {
            try {
                const res = await fetch('/api/vehicles')
                if (res.ok) {
                    const data = await res.json()
                    setVehicles(data)
                }
            } catch (e) {
                console.error('Failed to load vehicles', e)
            }
        }
        loadVehicles()
    }, [])

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            let body = {}

            if (loginMode === 'vehicle') {
                if (!selectedVehicle) {
                    setError('Lütfen bir araç seçiniz')
                    setLoading(false)
                    return
                }
                // For vehicle login, we send the plate as username (which is handled by API)
                const vehicle = vehicles.find(v => v.id === parseInt(selectedVehicle))
                if (!vehicle) {
                    setError('Araç bulunamadı')
                    setLoading(false)
                    return
                }
                body = { username: vehicle.plate, password: '' } // Password ignored for vehicle
            } else {
                body = { username, password }
            }

            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const data = await res.json()

            if (data.success) {
                // Save session
                localStorage.setItem('currentUser', JSON.stringify(data.user))

                // Redirect based on role
                if (data.user.role === 'driver') {
                    router.push('/driver')
                } else {
                    router.push('/dashboard')
                }
            } else {
                setError(data.error || 'Giriş başarısız')
            }
        } catch (err) {
            setError('Bir hata oluştu. Lütfen tekrar deneyin.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-blue-600 p-8 text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Akalbatu Lojistik</h1>
                    <p className="text-blue-100">Rota Optimizasyon Sistemi</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${loginMode === 'user'
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setLoginMode('user')}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <User size={18} /> Yönetici Girişi
                        </div>
                    </button>
                    <button
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${loginMode === 'vehicle'
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setLoginMode('vehicle')}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Truck size={18} /> Araç Girişi
                        </div>
                    </button>
                </div>

                {/* Form */}
                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">

                        {loginMode === 'user' ? (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User size={18} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            placeholder="Kullanıcı adınız"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock size={18} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Araç Seçiniz</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Truck size={18} className="text-gray-400" />
                                    </div>
                                    <select
                                        value={selectedVehicle}
                                        onChange={(e) => setSelectedVehicle(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none bg-white"
                                        required
                                    >
                                        <option value="">Plaka Seçiniz...</option>
                                        {vehicles.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.plate} - {v.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Giriş Yapılıyor...
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} /> Giriş Yap
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

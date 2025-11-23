'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
    const router = useRouter()
    const [loginMode, setLoginMode] = useState('manager') // 'manager' | 'driver'
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (loginMode === 'manager') {
            // Manager login
            const { data: users } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .eq('role', 'manager')

            if (users && users.length > 0) {
                // Store user data in localStorage
                localStorage.setItem('user', JSON.stringify(users[0]))
                localStorage.setItem('role', 'manager')
                localStorage.setItem('permissions', JSON.stringify(users[0].permissions || []))
                window.location.href = '/dashboard'
            } else {
                setError('Kullanıcı adı veya şifre hatalı')
            }
        } else {
            // Driver login - check vehicle password
            const { data: vehicles } = await supabase
                .from('vehicles')
                .select('*')
                .eq('plate', username)

            if (vehicles && vehicles.length > 0) {
                const vehicle = vehicles[0]

                // Check if password matches
                if (vehicle.driver_password && vehicle.driver_password === password) {
                    // Store driver data in localStorage
                    localStorage.setItem('user', JSON.stringify({
                        id: vehicle.id,
                        username: vehicle.plate,
                        full_name: vehicle.driver_name || vehicle.plate,
                        vehicle_id: vehicle.id
                    }))
                    localStorage.setItem('role', 'driver')
                    window.location.href = '/driver'
                } else if (!vehicle.driver_password) {
                    // No password set, allow login (backward compatibility)
                    localStorage.setItem('user', JSON.stringify({
                        id: vehicle.id,
                        username: vehicle.plate,
                        full_name: vehicle.driver_name || vehicle.plate,
                        vehicle_id: vehicle.id
                    }))
                    localStorage.setItem('role', 'driver')
                    window.location.href = '/driver'
                } else {
                    setError('Şifre hatalı')
                }
            } else {
                setError('Plaka bulunamadı')
            }
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Akalbatu Lojistik</h1>
                    <p className="text-slate-600">Rota Optimizasyon Sistemi</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
                        <button
                            onClick={() => setLoginMode('manager')}
                            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${loginMode === 'manager'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-700 hover:text-slate-900'
                                }`}
                        >
                            Yönetici
                        </button>
                        <button
                            onClick={() => setLoginMode('driver')}
                            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${loginMode === 'driver'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-700 hover:text-slate-900'
                                }`}
                        >
                            Sürücü
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                {loginMode === 'manager' ? 'Kullanıcı Adı' : 'Plaka'}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                placeholder={loginMode === 'manager' ? 'admin' : '34 ABC 123'}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Şifre
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                placeholder="••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl"
                        >
                            Giriş Yap
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-slate-500 mt-6">
                    © 2024 Akalbatu Lojistik
                </p>
            </div>
        </div>
    )
}

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

        if (loginMode === 'manager' || loginMode === 'worker') {
            // Manager/Worker login
            const cleanUsername = username.trim()
            const cleanPassword = password.trim()

            console.log('Attempting login with:', cleanUsername)

            // Use the secure RPC function to verify login
            const { data: result, error: rpcError } = await supabase
                .rpc('verify_login', {
                    username_input: cleanUsername,
                    password_input: cleanPassword
                })

            console.log('RPC Response:', { result, rpcError })

            if (rpcError) {
                console.error('Login RPC Error:', rpcError)
                setError('Giriş işlemi sırasında bir hata oluştu: ' + rpcError.message)
                return
            }

            if (result && result.success) {
                const user = result.user

                // Role validation
                if (loginMode === 'manager' && user.role === 'worker') {
                    setError('Çalışan girişi için lütfen "Çalışan" sekmesini kullanın.')
                    return
                }
                if (loginMode === 'worker' && user.role !== 'worker') {
                    setError('Yönetici girişi için lütfen "Yönetici" sekmesini kullanın.')
                    return
                }

                console.log('Login Success:', { username: user.username, role: user.role })

                // Determine permissions
                let permissions = user.permissions || []
                if (permissions.length === 0 && user.role === 'worker') {
                    // Default permissions for worker if not in DB
                    permissions = ['view', 'prepare_shipments']
                }

                // Store user data in localStorage
                localStorage.setItem('user', JSON.stringify(user))
                localStorage.setItem('role', user.role || 'manager')
                localStorage.setItem('permissions', JSON.stringify(permissions))

                // Redirect based on role
                if (user.role === 'worker') {
                    window.location.href = '/worker'
                } else {
                    window.location.href = '/dashboard'
                }
            } else {
                setError(result?.message || 'Kullanıcı adı veya şifre hatalı')
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-slate-100 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8 flex flex-col items-center">
                    <div className="w-64 h-auto mb-4">
                        <img src="/akalbatu-logo-new.png" alt="Akalbatu Logo" className="w-full h-auto object-contain" />
                    </div>
                    <p className="text-slate-600">Rota Optimizasyon Sistemi</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
                        <button
                            onClick={() => setLoginMode('manager')}
                            className={`flex-1 py-2 px-2 rounded-md font-medium transition-all text-sm ${loginMode === 'manager'
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Yönetici
                        </button>
                        <button
                            onClick={() => setLoginMode('worker')}
                            className={`flex-1 py-2 px-2 rounded-md font-medium transition-all text-sm ${loginMode === 'worker'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Çalışan
                        </button>
                        <button
                            onClick={() => setLoginMode('driver')}
                            className={`flex-1 py-2 px-2 rounded-md font-medium transition-all text-sm ${loginMode === 'driver'
                                ? 'bg-white text-green-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
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
                                {(loginMode === 'manager' || loginMode === 'worker') ? 'E-posta veya Kullanıcı Adı' : 'Plaka'}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder={(loginMode === 'manager' || loginMode === 'worker') ? 'admin@rotaci.app' : '34 ABC 123'}
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
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder="••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-primary hover:bg-zinc-700 text-white font-medium py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl"
                        >
                            Giriş Yap
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-slate-500 mt-6">
                    Created by Yuce
                </p>
            </div>
        </div>
    )
}

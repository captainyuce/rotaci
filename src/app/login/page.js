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
            // Manager/Worker login with Email/Password
            // Assuming username input is now Email
            const email = username.includes('@') ? username : `${username}@rotaci.app` // Fallback for username-like inputs

            console.log('Attempting login with:', email)

            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })

            if (authError) {
                console.error('Auth Error:', authError)
                setError('Giriş başarısız: ' + authError.message)
                return
            }

            console.log('Auth Success:', data)

            // Redirect is handled by AuthContext or we can force it here
            // But we need to wait for AuthContext to update state
            // Let's just redirect based on profile role which we can fetch here too for speed

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single()

            if (profileError) {
                console.error('Profile Fetch Error:', profileError)
            }

            const role = profile?.role || 'worker'
            console.log('User Role:', role)

            if (role === 'worker') {
                router.push('/worker')
            } else {
                router.push('/dashboard')
            }

        } else {
            // Driver login - Map Plate to Email
            // Plate: 34 KL 1234 -> 34KL1234@rotaci.app
            const cleanPlate = username.replace(/\s/g, '').toUpperCase()
            const email = `${cleanPlate}@rotaci.app`

            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })

            if (authError) {
                // Fallback to old custom auth for drivers if migration isn't complete?
                // No, we want to enforce security.
                // But maybe we should allow a transition period?
                // Let's try to login with Supabase Auth first.
                setError('Giriş başarısız. Lütfen yöneticinizle iletişime geçin.')
                console.error('Driver login error:', authError)
            } else {
                router.push('/driver')
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
                                {loginMode === 'driver' ? 'Plaka' : 'E-posta veya Kullanıcı Adı'}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900 placeholder:text-slate-400"
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

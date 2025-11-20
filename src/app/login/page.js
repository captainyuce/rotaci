'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { initialUsers } from '@/lib/data'
import { Truck } from 'lucide-react'

export default function LoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const router = useRouter()

    const handleLogin = (e) => {
        e.preventDefault()

        // Load users from localStorage
        const savedUsers = localStorage.getItem('appUsers');
        const allUsers = savedUsers ? JSON.parse(savedUsers) : initialUsers;

        // Simple mock auth
        const user = allUsers.find(u => u.username === username && u.password === password)

        if (user) {
            // Store user in localStorage for simple persistence
            localStorage.setItem('currentUser', JSON.stringify(user))
            router.push('/dashboard')
        } else {
            setError('Kullanıcı adı veya şifre hatalı!')
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <img src="/akalbatu-logo.png" alt="Akalbatu Logo" className="h-16" />
                </div>

                <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Akalbatu</h1>
                <p className="text-center text-slate-500 mb-8">Rota Optimizasyon Sistemi</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kullanıcı Adı</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Kullanıcı adınızı girin"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors font-medium"
                    >
                        Giriş Yap
                    </button>
                </form>
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Truck, Package, Users, LogOut, Menu, X } from 'lucide-react'

export default function DashboardLayout({ children }) {
    const router = useRouter()
    const pathname = usePathname()
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [user, setUser] = useState(null)

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser')
        if (!storedUser) {
            router.push('/login')
        } else {
            setUser(JSON.parse(storedUser))
        }
    }, [router])

    const handleLogout = () => {
        localStorage.removeItem('currentUser')
        router.push('/login')
    }

    const navItems = [
        { name: 'Genel Bakış', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Sevkiyatlar', href: '/dashboard/shipments', icon: Package },
        { name: 'Araçlar', href: '/dashboard/vehicles', icon: Truck },
        { name: 'Kullanıcılar', href: '/dashboard/users', icon: Users },
    ]

    if (!user) return null

    return (
        <div className="flex h-screen bg-slate-100">
            {/* Sidebar */}
            <aside
                className={`bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col
                    ${sidebarOpen ? 'w-64' : 'w-20'}
                `}
            >
                <div className="p-4 flex items-center justify-between border-b border-slate-800">
                    {sidebarOpen && <span className="font-bold text-xl truncate">Akalbatu</span>}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg">
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors
                                    ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                                `}
                            >
                                <item.icon size={20} />
                                {sidebarOpen && <span>{item.name}</span>}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 p-3 w-full rounded-lg text-red-400 hover:bg-red-900/20 transition-colors"
                    >
                        <LogOut size={20} />
                        {sidebarOpen && <span>Çıkış Yap</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col">
                <header className="bg-white shadow-sm p-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800">
                        {navItems.find(i => i.href === pathname)?.name || 'Dashboard'}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-bold text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500 capitalize">{user.role}</div>
                        </div>
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {user.name.charAt(0)}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-6">
                    {children}
                </div>
            </main>
        </div>
    )
}

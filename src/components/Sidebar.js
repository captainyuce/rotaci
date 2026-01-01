'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Truck, Users, LogOut, Settings, Calendar, Factory } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'

const menuItems = [
    { icon: LayoutDashboard, label: 'Genel', href: '/dashboard' },
    { icon: Package, label: 'Sevkiyat', href: '/dashboard/shipments' },
    { icon: Calendar, label: 'Takvim', href: '/dashboard/calendar' },
    { icon: Factory, label: 'Fason Takibi', href: '/dashboard/subcontractors', permission: PERMISSIONS.MANAGE_SUBCONTRACTORS },
    { icon: Truck, label: 'Araçlar', href: '/dashboard/vehicles' },
    { icon: Users, label: 'Kullanıcılar', href: '/dashboard/users' },
]

export default function Sidebar() {
    const pathname = usePathname()
    const { signOut, hasPermission } = useAuth()

    return (
        <div className="w-20 bg-slate-900 text-white flex flex-col items-center py-6 gap-6 z-20 shadow-xl">
            {/* Logo / Brand */}
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-900/20">
                A
            </div>

            {/* Nav Items */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-3">
                {menuItems.map((item) => {
                    // Check permission if item has one
                    if (item.permission && !hasPermission(item.permission)) {
                        return null
                    }

                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group relative flex items-center justify-center w-full aspect-square rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />

                            {/* Tooltip */}
                            <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                {item.label}
                            </div>
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-4 w-full px-3">
                <button
                    onClick={signOut}
                    className="flex items-center justify-center w-full aspect-square rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </div>
    )
}

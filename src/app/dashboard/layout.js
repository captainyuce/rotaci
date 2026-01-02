'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import MapComponent from '@/components/Map'
import { Menu, X, Package, Truck, Users, LogOut, LayoutDashboard, MapPin, ClipboardList, FileText, Calendar, Settings, Factory, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PERMISSIONS, hasAnyPermission } from '@/lib/permissions'
import { DashboardProvider } from '@/contexts/DashboardContext'
import NotificationBell from '@/components/NotificationBell'
import ChatBox from '@/components/ChatBox'

import { TutorialProvider, useTutorial } from '@/components/TutorialProvider'

function DashboardContent({ children }) {
    const { user, role, permissions, hasPermission, loading, signOut } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)
    const { startTutorial } = useTutorial()

    useEffect(() => {
        if (!loading) {
            const currentRole = role?.toLowerCase()
            if (!user) {
                router.push('/login')
            } else if (currentRole !== 'manager' && currentRole !== 'admin' && currentRole !== 'dispatcher') {
                router.push('/driver')
            }
        }
    }, [user, role, loading, router])

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Yükleniyor...</div>

    const currentRole = role?.toLowerCase()
    if (!user || (currentRole !== 'manager' && currentRole !== 'admin' && currentRole !== 'dispatcher')) return null

    const allMenuItems = [
        { icon: LayoutDashboard, label: 'Genel Bakış', href: '/dashboard', permission: PERMISSIONS.VIEW, id: 'sidebar-dashboard' },
        {
            icon: Package,
            label: 'Sevkiyatlar',
            href: '/dashboard/shipments',
            permissions: [PERMISSIONS.CREATE_SHIPMENTS, PERMISSIONS.EDIT_SHIPMENTS, PERMISSIONS.DELETE_SHIPMENTS],
            checkAny: true,
            id: 'sidebar-shipments'
        },
        { icon: Package, label: 'Depo / Hazırlık', href: '/dashboard/prepare', permission: PERMISSIONS.PREPARE_SHIPMENTS },
        { icon: Calendar, label: 'Takvim', href: '/dashboard/calendar', permission: PERMISSIONS.VIEW },
        { icon: Factory, label: 'Fason Takibi', href: '/dashboard/subcontractors', permission: PERMISSIONS.MANAGE_SUBCONTRACTORS, id: 'sidebar-subcontractors' },
        { icon: ClipboardList, label: 'Atamalar', href: '/dashboard/assignments', permission: PERMISSIONS.ASSIGN_VEHICLES },
        { icon: Truck, label: 'Araçlar', href: '/dashboard/vehicles', permission: PERMISSIONS.MANAGE_VEHICLES },
        { icon: MapPin, label: 'Adresler', href: '/dashboard/addresses', permission: PERMISSIONS.MANAGE_ADDRESSES },
        { icon: Users, label: 'Kullanıcılar', href: '/dashboard/users', permission: PERMISSIONS.MANAGE_USERS },
        { icon: FileText, label: 'İşlem Geçmişi', href: '/dashboard/logs', permission: PERMISSIONS.VIEW_LOGS },
        { icon: Settings, label: 'Ayarlar', href: '/dashboard/settings', permission: PERMISSIONS.MANAGE_SETTINGS },
    ]

    // Debug: Log user permissions
    console.log('User permissions:', permissions)
    console.log('User role:', role)

    // Filter menu items based on user permissions
    const menuItems = allMenuItems.filter(item => {
        if (item.checkAny && item.permissions) {
            // Check if user has ANY of the required permissions
            const hasAny = item.permissions.some(perm => hasPermission(perm))
            console.log(`Checking ${item.label} (checkAny):`, item.permissions, '=> hasAny:', hasAny)
            return hasAny
        }
        // Check if user has the single required permission
        const hasPerm = hasPermission(item.permission)
        console.log(`Checking ${item.label}:`, item.permission, '=> hasPerm:', hasPerm)
        return hasPerm
    })

    console.log('Filtered menu items:', menuItems.map(i => i.label))
    return (
        <div className="relative h-screen w-screen overflow-hidden">
            {/* Full Screen Map Background */}
            <div className="absolute inset-0 z-0">
                <MapComponent />
            </div>

            {/* Hamburger Menu Button */}
            <button
                id="hamburger-menu"
                onClick={() => setMenuOpen(!menuOpen)}
                className="fixed top-4 left-4 z-50 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg hover:shadow-xl transition-all border border-slate-200"
            >
                {menuOpen ? <X size={24} className="text-slate-700" /> : <Menu size={24} className="text-slate-700" />}
            </button>

            {/* Notification Bell & Chat */}
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                <div className="bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-lg hover:shadow-xl transition-all border border-slate-200">
                    <ChatBox />
                </div>
                <div className="bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-lg hover:shadow-xl transition-all border border-slate-200">
                    <NotificationBell />
                </div>
            </div>

            {/* Sliding Menu */}
            {menuOpen && (
                <div className="fixed left-4 top-20 w-64 md:w-80 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 z-40 max-h-[calc(100vh-104px)] flex flex-col">
                    <div className="p-4 md:p-6 border-b border-slate-200">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">Rota Optimizasyon</h2>
                        <p className="text-xs md:text-sm text-slate-500">Yönetim Paneli</p>
                        <p className="text-xs md:text-sm text-primary font-medium mt-1">{user?.full_name || user?.username}</p>
                    </div>

                    <nav className="p-3 md:p-4 space-y-2 flex-1 overflow-y-auto">
                        {menuItems.length === 0 && (
                            <div className="p-4 text-center text-slate-500 text-sm">
                                Menü öğesi bulunamadı. Yetkilerinizi kontrol edin.
                                <br />
                                (Rol: {role}, İzinler: {permissions?.length || 0})
                            </div>
                        )}
                        {menuItems.map((item) => {
                            const Icon = item.icon
                            const isActive = pathname === item.href

                            return (
                                <Link
                                    key={item.href}
                                    id={item.id}
                                    href={item.href}
                                    onClick={() => setMenuOpen(false)}
                                    className={`flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-all ${isActive
                                        ? 'bg-primary text-white shadow-md'
                                        : 'text-slate-900 hover:bg-slate-100'
                                        }`}
                                >
                                    <Icon size={20} />
                                    <span className="font-medium text-sm md:text-base">{item.label}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    <div className="flex flex-col items-center gap-4 py-4 border-t border-slate-100">
                        <button
                            onClick={() => {
                                setMenuOpen(false)
                                startTutorial()
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Yardım / Turu Başlat"
                        >
                            <div className="flex items-center gap-2">
                                <HelpCircle size={24} />
                            </div>
                        </button>
                        <button
                            onClick={signOut}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Çıkış Yap"
                        >
                            <LogOut size={24} />
                        </button>
                        <div className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                            v1.3 - SYSTEM READY
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="relative z-10 h-full pointer-events-none">
                {children}
            </div>

            {/* Branding Logo - Bottom Right */}
            <div className="fixed bottom-6 right-6 z-50 pointer-events-none opacity-90">
                <img src="/logo.png" alt="Akalbatu Logo" className="h-12 w-auto drop-shadow-lg" />
            </div>
        </div>
    )
}

export default function DashboardLayout({ children }) {
    return (
        <DashboardProvider>
            <TutorialProvider>
                <DashboardContent>
                    {children}
                </DashboardContent>
            </TutorialProvider>
        </DashboardProvider>
    )
}

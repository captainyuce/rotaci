'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuth } from './AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'

const TutorialContext = createContext()

export function useTutorial() {
    return useContext(TutorialContext)
}

export function TutorialProvider({ children }) {
    const { user, role, hasPermission } = useAuth()
    const router = useRouter()
    const [driverObj, setDriverObj] = useState(null)

    useEffect(() => {
        console.log('TutorialProvider: Initializing driver')
        // Initialize driver
        const driverInstance = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: 'Tamamla',
            closeBtnText: 'Kapat',
            nextBtnText: 'İleri',
            prevBtnText: 'Geri',
            onDestroyStarted: () => {
                if (!driverInstance.hasNextStep() || confirm('Turu sonlandırmak istiyor musunuz?')) {
                    driverInstance.destroy();
                    // Mark as seen
                    localStorage.setItem('hasSeenTutorial_v1', 'true')
                }
            },
        })

        setDriverObj(driverInstance)
    }, [])

    useEffect(() => {
        console.log('TutorialProvider: Checking auto-start', { user: !!user, driverObj: !!driverObj, role })
        // Auto-start if not seen and user is logged in
        if (user && driverObj && role) {
            const hasSeen = localStorage.getItem('hasSeenTutorial_v1')
            if (!hasSeen) {
                console.log('TutorialProvider: Auto-starting tutorial')
                // Small delay to ensure UI is rendered
                setTimeout(() => {
                    startTutorial()
                }, 1500)
            }
        }
    }, [user, driverObj, role])

    const startTutorial = () => {
        console.log('TutorialProvider: startTutorial called', { driverObj: !!driverObj, role })
        if (!driverObj || !role) return

        // Only for managers/admins/dispatchers
        if (role !== 'manager' && role !== 'admin' && role !== 'dispatcher') {
            console.log('TutorialProvider: Role not allowed', role)
            return
        }

        // Helper to ensure sidebar is open
        const ensureSidebarOpen = () => {
            const sidebar = document.getElementById('sidebar-dashboard')
            const hamburger = document.getElementById('hamburger-menu')
            if (!sidebar || sidebar.offsetParent === null) {
                if (hamburger) hamburger.click()
            }
        }

        // Helper to ensure sidebar is closed
        const ensureSidebarClosed = () => {
            const sidebar = document.getElementById('sidebar-dashboard')
            const hamburger = document.getElementById('hamburger-menu')
            // If sidebar is visible (offsetParent not null) AND we are on mobile (check if hamburger is visible or window width)
            // Actually, checking if sidebar is visible is enough. If it's visible, we might want to close it if it's the sliding menu.
            // The sliding menu in DashboardLayout has a close button but also toggles via hamburger.
            // If we click hamburger when it's open, it closes.

            // Better check: The sliding menu in DashboardLayout is conditionally rendered with `menuOpen`.
            // If `sidebar-dashboard` is present, it means the menu is open (because it's inside the conditional block).
            // So if we find `sidebar-dashboard`, we should click hamburger to close it.
            if (sidebar && sidebar.offsetParent !== null) {
                if (hamburger) hamburger.click()
            }
        }

        const handleHighlightStarted = (element, step, options) => {
            const isSidebarItem = element.startsWith('#sidebar-')
            const isHamburger = element === '#hamburger-menu'

            if (isSidebarItem) {
                ensureSidebarOpen()
            } else if (!isHamburger) {
                // If it's not a sidebar item and not the hamburger itself, close the sidebar so it doesn't block view
                ensureSidebarClosed()
            }

            if (step.route) {
                router.push(step.route)
            }
        }

        const allSteps = [
            {
                element: '#hamburger-menu',
                popover: {
                    title: 'Menü',
                    description: 'Menüyü açıp kapatmak için burayı kullanabilirsiniz.',
                    side: 'bottom',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-dashboard',
                route: '/dashboard',
                permission: PERMISSIONS.VIEW,
                popover: {
                    title: 'Genel Bakış',
                    description: 'İşletmenizin genel durumunu, özet istatistikleri ve harita görünümünü takip edebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#header-notification',
                route: '/dashboard',
                permission: PERMISSIONS.VIEW,
                popover: {
                    title: 'Bildirimler',
                    description: 'Önemli güncellemeleri ve uyarıları buradan takip edebilirsiniz.',
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#header-chat',
                route: '/dashboard',
                permission: PERMISSIONS.VIEW,
                popover: {
                    title: 'Mesajlaşma',
                    description: 'Ekip içi iletişim ve duyurular için burayı kullanabilirsiniz.',
                    side: 'left',
                    align: 'start'
                }
            },
            {
                element: '#dashboard-vehicle-cards',
                route: '/dashboard',
                permission: PERMISSIONS.VIEW,
                popover: {
                    title: 'Araç Durumları',
                    description: 'Araçların anlık konumlarını, yük durumlarını ve günlük performanslarını buradan izleyebilirsiniz.',
                    side: 'top',
                    align: 'center'
                }
            },
            {
                element: '#sidebar-shipments',
                route: '/dashboard/shipments',
                permission: PERMISSIONS.CREATE_SHIPMENTS, // Using one of the shipment permissions
                popover: {
                    title: 'Sevkiyat Yönetimi',
                    description: 'Tüm sevkiyatları buradan planlayabilir, düzenleyebilir ve durumlarını takip edebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#new-shipment-btn',
                route: '/dashboard/shipments', // Ensure we are on the page
                permission: PERMISSIONS.CREATE_SHIPMENTS,
                popover: {
                    title: 'Yeni Sevkiyat',
                    description: 'Hızlıca yeni bir sevkiyat veya fason iş emri oluşturmak için bu butonu kullanın.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#sidebar-prepare',
                route: '/dashboard/prepare',
                permission: PERMISSIONS.PREPARE_SHIPMENTS,
                popover: {
                    title: 'Depo ve Hazırlık',
                    description: 'Depo süreçlerini ve sipariş hazırlıklarını buradan yönetebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-calendar',
                route: '/dashboard/calendar',
                permission: PERMISSIONS.VIEW,
                popover: {
                    title: 'Takvim',
                    description: 'Sevkiyat ve iş planını takvim üzerinde görüntüleyin.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-subcontractors',
                route: '/dashboard/subcontractors',
                permission: PERMISSIONS.MANAGE_SUBCONTRACTORS,
                popover: {
                    title: 'Fason Takibi',
                    description: 'Fasonculara gönderilen işleri ve üretim durumlarını buradan yönetebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-assignments',
                route: '/dashboard/assignments',
                permission: PERMISSIONS.ASSIGN_VEHICLES,
                popover: {
                    title: 'Atamalar',
                    description: 'Araç ve şoför atamalarını buradan yapabilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-vehicles',
                route: '/dashboard/vehicles',
                permission: PERMISSIONS.MANAGE_VEHICLES,
                popover: {
                    title: 'Araç Yönetimi',
                    description: 'Filo ve araç bilgilerinizi buradan düzenleyebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-addresses',
                route: '/dashboard/addresses',
                permission: PERMISSIONS.MANAGE_ADDRESSES,
                popover: {
                    title: 'Adres Defteri',
                    description: 'Müşteri ve teslimat adreslerini buradan yönetin.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-users',
                route: '/dashboard/users',
                permission: PERMISSIONS.MANAGE_USERS,
                popover: {
                    title: 'Kullanıcı Yönetimi',
                    description: 'Sisteme yeni kullanıcı ekleyebilir ve yetkilerini düzenleyebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-logs',
                route: '/dashboard/logs',
                permission: PERMISSIONS.VIEW_LOGS,
                popover: {
                    title: 'İşlem Geçmişi',
                    description: 'Sistemde yapılan tüm işlemlerin kaydını buradan inceleyebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-settings',
                route: '/dashboard/settings',
                permission: PERMISSIONS.MANAGE_SETTINGS,
                popover: {
                    title: 'Ayarlar',
                    description: 'Genel sistem ayarlarını buradan yapılandırabilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-help',
                popover: {
                    title: 'Yardım',
                    description: 'Turu tekrar başlatmak için.',
                    side: 'right',
                    align: 'start'
                }
            }
        ]

        // Filter steps based on permissions
        const filteredSteps = allSteps.filter(step => {
            if (!step.permission) return true
            return hasPermission(step.permission)
        }).map(step => ({
            ...step,
            onHighlightStarted: (element, stepObj, options) => handleHighlightStarted(element, step, options)
        }))

        console.log('TutorialProvider: Filtered steps', filteredSteps)
        driverObj.setSteps(filteredSteps)
        driverObj.drive()
    }

    return (
        <TutorialContext.Provider value={{ startTutorial }}>
            {children}
        </TutorialContext.Provider>
    )
}

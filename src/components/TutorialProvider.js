import { useRouter } from 'next/navigation'
import { PERMISSIONS } from '@/lib/permissions'

// ... existing imports ...

export function TutorialProvider({ children }) {
    const { user, role, hasPermission } = useAuth()
    const router = useRouter()
    const [driverObj, setDriverObj] = useState(null)

    // ... existing useEffects ...

    const startTutorial = () => {
        if (!driverObj || !role) return

        // Only for managers/admins/dispatchers
        if (role !== 'manager' && role !== 'admin' && role !== 'dispatcher') return

        // Helper to ensure sidebar is open
        const ensureSidebarOpen = () => {
            const sidebar = document.getElementById('sidebar-dashboard')
            const hamburger = document.getElementById('hamburger-menu')
            if (!sidebar || sidebar.offsetParent === null) {
                if (hamburger) hamburger.click()
            }
        }

        const handleHighlightStarted = (element, step, options) => {
            ensureSidebarOpen()

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

        driverObj.setSteps(filteredSteps)
        driverObj.drive()
    }

    return (
        <TutorialContext.Provider value={{ startTutorial }}>
            {children}
        </TutorialContext.Provider>
    )
}

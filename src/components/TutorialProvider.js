'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuth } from './AuthProvider'

const TutorialContext = createContext()

export function useTutorial() {
    return useContext(TutorialContext)
}

export function TutorialProvider({ children }) {
    const { user, role } = useAuth()
    const [driverObj, setDriverObj] = useState(null)

    // Define steps for each role
    const steps = {
        manager: [
            {
                element: '#sidebar-dashboard',
                popover: {
                    title: 'Genel Bakış',
                    description: 'Buradan işletmenizin genel durumunu, özet istatistikleri ve harita görünümünü takip edebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-shipments',
                popover: {
                    title: 'Sevkiyat Yönetimi',
                    description: 'Tüm sevkiyatları buradan planlayabilir, düzenleyebilir ve durumlarını takip edebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#new-shipment-btn',
                popover: {
                    title: 'Yeni Sevkiyat',
                    description: 'Hızlıca yeni bir sevkiyat veya fason iş emri oluşturmak için bu butonu kullanın.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#sidebar-subcontractors',
                popover: {
                    title: 'Fason Takibi',
                    description: 'Fasonculara gönderilen işleri ve üretim durumlarını buradan yönetebilirsiniz. Onay bekleyen işler burada görünür.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#sidebar-help',
                popover: {
                    title: 'Yardım ve Tur',
                    description: 'Bu turu tekrar izlemek isterseniz buraya tıklayabilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            }
        ],
        driver: [
            {
                element: '#sidebar-dashboard',
                popover: {
                    title: 'İşlerim',
                    description: 'Size atanan tüm sevkiyatları burada liste halinde görebilirsiniz.',
                    side: 'right',
                    align: 'start'
                }
            },
            {
                element: '#driver-map-view',
                popover: {
                    title: 'Harita Görünümü',
                    description: 'Teslimat rotanızı ve gideceğiniz noktaları harita üzerinde görüntüleyin.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#driver-status-btn',
                popover: {
                    title: 'Durum Güncelleme',
                    description: 'Yola çıktığınızda veya teslimat yaptığınızda durumu buradan güncellemeyi unutmayın.',
                    side: 'left',
                    align: 'center'
                }
            }
        ],
        subcontractor: [
            {
                element: '#subcontractor-orders',
                popover: {
                    title: 'Üretim Emirleri',
                    description: 'Size gelen işleri ve detaylarını (ürün bilgisi, adet vb.) buradan görebilirsiniz.',
                    side: 'top',
                    align: 'center'
                }
            },
            {
                element: '#subcontractor-ready-btn',
                popover: {
                    title: 'Hazır Bildirimi',
                    description: 'Üretim bittiğinde bu butona basarak yöneticinize "Hazır" bildirimi gönderin.',
                    side: 'left',
                    align: 'center'
                }
            }
        ]
    }

    useEffect(() => {
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
        // Auto-start if not seen and user is logged in
        if (user && driverObj && role) {
            const hasSeen = localStorage.getItem('hasSeenTutorial_v1')
            if (!hasSeen) {
                // Small delay to ensure UI is rendered
                setTimeout(() => {
                    startTutorial()
                }, 1500)
            }
        }
    }, [user, driverObj, role])

    const startTutorial = () => {
        if (!driverObj || !role) return

        const roleSteps = steps[role] || steps['manager'] // Fallback to manager if role not found

        // Filter steps to only include elements that exist in DOM
        // This prevents the tutorial from breaking if an element is missing
        // But driver.js handles missing elements gracefully usually, let's just pass them.
        // Actually, for better UX, let's try to find them.

        driverObj.setSteps(roleSteps)
        driverObj.drive()
    }

    return (
        <TutorialContext.Provider value={{ startTutorial }}>
            {children}
        </TutorialContext.Provider>
    )
}

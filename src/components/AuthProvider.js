'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { hasPermission as checkPermission } from '@/lib/permissions'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [role, setRole] = useState(null) // 'manager' | 'driver' | null
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const checkAuth = async () => {
            // Check localStorage for user session
            const userStr = localStorage.getItem('user')
            const roleStr = localStorage.getItem('role')
            const permissionsStr = localStorage.getItem('permissions')

            if (userStr && roleStr) {
                const userData = JSON.parse(userStr)
                setUser(userData)
                setRole(roleStr)

                if (permissionsStr) {
                    setPermissions(JSON.parse(permissionsStr))
                }
            }

            setLoading(false)
        }

        checkAuth()
    }, [pathname])

    const hasPermission = (permission) => {
        return checkPermission(permissions, permission)
    }

    const signOut = async () => {
        localStorage.removeItem('user')
        localStorage.removeItem('role')
        localStorage.removeItem('permissions')
        setUser(null)
        setRole(null)
        setPermissions([])
        router.push('/login')
    }

    return (
        <AuthContext.Provider value={{ user, role, permissions, hasPermission, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

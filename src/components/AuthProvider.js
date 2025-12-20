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
                const roleData = roleStr.toLowerCase()
                const permsData = permissionsStr ? JSON.parse(permissionsStr) : []

                console.log('Auth Check:', { username: userData.username, role: roleData, permissions: permsData })

                setUser(userData)
                setRole(roleData)
                setPermissions(permsData)
            }

            setLoading(false)
        }

        checkAuth()
    }, [pathname])

    const hasPermission = (permission) => {
        const currentRole = role?.toLowerCase()
        if (currentRole === 'admin') return true
        if (currentRole === 'manager') {
            // Managers might have specific permissions or all by default
            // For now, let's check the permissions array
            return checkPermission(permissions, permission)
        }
        return false
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

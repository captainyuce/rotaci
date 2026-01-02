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

                // Refresh permissions from ROLES constant to ensure they are up to date
                // This fixes issues where new permissions aren't applied to existing sessions
                let currentPermissions = []
                try {
                    // Dynamic import to avoid circular dependencies if any
                    const { ROLES } = await import('@/lib/permissions')
                    const roleKey = roleData.toUpperCase()
                    if (ROLES[roleKey]) {
                        currentPermissions = ROLES[roleKey].permissions
                        // Update localStorage with fresh permissions
                        localStorage.setItem('permissions', JSON.stringify(currentPermissions))
                    } else {
                        currentPermissions = permissionsStr ? JSON.parse(permissionsStr) : []
                    }
                } catch (e) {
                    console.error('Error refreshing permissions:', e)
                    currentPermissions = permissionsStr ? JSON.parse(permissionsStr) : []
                }

                setUser(userData)
                setRole(roleData)
                setPermissions(currentPermissions)
            }

            setLoading(false)
        }

        checkAuth()
    }, [pathname])

    const hasPermission = (permission) => {
        const currentRole = role?.toLowerCase()
        if (currentRole === 'admin') return true

        // For other roles (manager, worker, etc.), check the permissions array
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

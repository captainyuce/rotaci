'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { hasPermission as checkPermission, ROLES } from '@/lib/permissions'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [role, setRole] = useState(null)
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                handleUserSession(session.user)
            } else {
                setLoading(false)
            }
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session) {
                await handleUserSession(session.user)
            } else {
                setUser(null)
                setRole(null)
                setPermissions([])
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleUserSession = async (authUser) => {
        try {
            // Fetch profile to get role
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single()

            if (error) {
                console.error('Error fetching profile:', error)
                setRole('worker')
                setPermissions([])
            } else {
                const roleName = profile.role.toLowerCase()
                setRole(roleName)

                // Map role to permissions
                let userPermissions = []
                const roleKey = Object.keys(ROLES).find(key => ROLES[key].name.toLowerCase() === roleName)

                if (roleKey) {
                    userPermissions = ROLES[roleKey].permissions
                } else if (roleName === 'admin') {
                    // Fallback for admin if not found in ROLES (though it should be)
                    userPermissions = Object.values(ROLES.ADMIN.permissions)
                }

                setPermissions(userPermissions)
            }

            setUser({ ...authUser, ...profile })
        } catch (error) {
            console.error('Auth handling error:', error)
        } finally {
            setLoading(false)
        }
    }

    const hasPermission = (permission) => {
        // We need to re-implement this based on the role we fetched
        // Importing ROLES from permissions.js inside the function or file
        // Let's assume we set permissions state in handleUserSession
        return checkPermission(permissions, permission)
    }

    const signOut = async () => {
        await supabase.auth.signOut()
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

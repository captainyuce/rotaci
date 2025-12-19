'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'

export default function NotificationBell() {
    const { user } = useAuth()
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
        if (!user?.id) return

        fetchNotifications()

        // Real-time subscription
        let channel
        try {
            channel = supabase
                .channel('notifications_bell')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                }, (payload) => {
                    console.log('New notification:', payload)
                    setNotifications(prev => [payload.new, ...prev])
                    setUnreadCount(prev => prev + 1)
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Notification subscription active')
                    }
                })
        } catch (error) {
            console.error('Notification subscription error:', error)
        }

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [user?.id])

    useEffect(() => {
        // Close dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const fetchNotifications = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error

            if (data) {
                setNotifications(data)
                setUnreadCount(data.filter(n => !n.is_read).length)
            }
        } catch (error) {
            console.error('Error fetching notifications:', error)
            // Don't crash the UI, just log the error
        }
    }

    const markAsRead = async (id) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
    }

    const markAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false)
    }

    const deleteNotification = async (e, id) => {
        e.stopPropagation()

        try {
            // Optimistic update
            const isUnread = notifications.find(n => n.id === id)?.is_read === false
            setNotifications(prev => prev.filter(n => n.id !== id))
            if (isUnread) {
                setUnreadCount(prev => Math.max(0, prev - 1))
            }

            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error deleting notification:', error)
            // Revert optimistic update if needed
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full hover:bg-slate-100 relative transition-colors"
            >
                <Bell size={20} className="text-slate-600" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] flex items-center justify-center border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <h3 className="font-bold text-sm text-slate-800">Bildirimler</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Tümünü Okundu İşaretle
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <Bell size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Bildiriminiz yok</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        onClick={() => !notification.is_read && markAsRead(notification.id)}
                                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!notification.is_read ? 'bg-blue-50/50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notification.is_read ? 'bg-blue-500' : 'bg-transparent'
                                                }`} />
                                            <div className="flex-1">
                                                <h4 className={`text-sm ${!notification.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                    {notification.title}
                                                </h4>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                <span className="text-[10px] text-slate-400 mt-2 block">
                                                    {new Date(notification.created_at).toLocaleString('tr-TR')}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => deleteNotification(e, notification.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded transition-all"
                                                title="Sil"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

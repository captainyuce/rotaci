'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'

export default function ChatBox() {
    const { user, role } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)
    const messagesEndRef = useRef(null)
    const audioRef = useRef(null)

    // Only managers and admins can use the chat
    if (role !== 'manager' && role !== 'admin') return null

    useEffect(() => {
        setMounted(true)
        if (isOpen) {
            fetchMessages()
            scrollToBottom()
            setUnreadCount(0)
            localStorage.setItem('lastReadChat', new Date().toISOString())
        } else {
            // Check for unread messages on mount
            checkUnreadMessages()
        }

        const channel = supabase
            .channel('public:manager_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'manager_messages' }, (payload) => {
                handleNewMessage(payload.new)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isOpen])

    const checkUnreadMessages = async () => {
        const lastRead = localStorage.getItem('lastReadChat')
        if (!lastRead) {
            setUnreadCount(0)
            return
        }

        const { count, error } = await supabase
            .from('manager_messages')
            .select('*', { count: 'exact', head: true })
            .gt('created_at', lastRead)
            .neq('user_id', user?.id)

        if (!error && count > 0) {
            setUnreadCount(count)
        }
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('manager_messages')
            .select('*, user:users(full_name)')
            .order('created_at', { ascending: true })
            .limit(50)

        if (error) {
            console.error('Error fetching messages:', error)
        } else {
            setMessages(data || [])
        }
    }

    const handleNewMessage = async (message) => {
        // Fetch user info for the new message
        const { data: userData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', message.user_id)
            .single()

        const messageWithUser = { ...message, user: userData }

        setMessages(prev => [...prev, messageWithUser])

        // Increment unread count if chat is closed and message is from someone else
        if (!isOpen && message.user_id !== user?.id) {
            setUnreadCount(prev => prev + 1)
        }

        // Play sound if message is from someone else
        if (message.user_id !== user?.id && audioRef.current) {
            audioRef.current.play().catch(e => console.error('Audio play error:', e))
        }
    }

    const sendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || loading) return

        setLoading(true)
        const { error } = await supabase
            .from('manager_messages')
            .insert([{
                user_id: user.id,
                message: newMessage.trim()
            }])

        if (error) {
            console.error('Error sending message:', error)
            alert('Mesaj gönderilemedi.')
        } else {
            setNewMessage('')
            localStorage.setItem('lastReadChat', new Date().toISOString())
        }
        setLoading(false)
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const chatWindow = isOpen && mounted ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={() => setIsOpen(false)}
            />

            {/* Window */}
            <div className="relative w-full max-w-md h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-4 bg-primary text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare size={20} />
                        <h3 className="font-bold">Yönetici Sohbeti</h3>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm italic">
                            <MessageSquare size={48} className="mb-2 opacity-20" />
                            Henüz mesaj yok. İlk mesajı siz yazın!
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.user_id === user?.id ? 'items-end' : 'items-start'}`}
                            >
                                <div className="flex items-center gap-1 mb-1 px-1">
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {msg.user?.full_name || 'Bilinmeyen Kullanıcı'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${msg.user_id === user?.id
                                        ? 'bg-primary text-white rounded-tr-none'
                                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                                        }`}
                                >
                                    {msg.message}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Mesajınızı yazın..."
                        className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || loading}
                        className="p-2 bg-primary text-white rounded-full hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>,
        document.body
    ) : null

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative"
                title="Yönetici Sohbeti"
            >
                <MessageSquare size={24} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {chatWindow}

            {/* Notification Sound */}
            <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />
        </>
    )
}


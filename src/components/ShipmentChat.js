'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from './AuthProvider'
import { Send, MessageCircle } from 'lucide-react'

export default function ShipmentChat({ shipmentId, shipmentName }) {
    const { user, role } = useAuth()
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        if (!shipmentId) return

        fetchMessages()

        // Subscribe to real-time updates
        const channel = supabase
            .channel(`shipment-chat-${shipmentId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `shipment_id=eq.${shipmentId}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new])
                scrollToBottom()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [shipmentId])

    const fetchMessages = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('shipment_id', shipmentId)
            .order('created_at', { ascending: true })

        if (data) {
            setMessages(data)
            setTimeout(scrollToBottom, 100)
        }
        setLoading(false)
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const sendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || sending) return

        setSending(true)

        // Get user name
        const { data: userData } = await supabase
            .from(role === 'driver' ? 'vehicles' : 'users')
            .select(role === 'driver' ? 'driver_name' : 'name')
            .eq('id', user.id)
            .single()

        const userName = role === 'driver'
            ? userData?.driver_name || 'Sürücü'
            : userData?.name || 'Kullanıcı'

        const { error } = await supabase
            .from('messages')
            .insert({
                shipment_id: shipmentId,
                user_id: user.id,
                user_name: userName,
                user_role: role,
                message: newMessage.trim()
            })

        if (!error) {
            setNewMessage('')
        } else {
            console.error('Error sending message:', error)
            alert('Mesaj gönderilemedi')
        }

        setSending(false)
    }

    const formatTime = (timestamp) => {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Şimdi'
        if (diffMins < 60) return `${diffMins} dk önce`
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} saat önce`

        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getRoleBadgeColor = (userRole) => {
        switch (userRole) {
            case 'driver': return 'bg-blue-100 text-blue-700'
            case 'manager': return 'bg-purple-100 text-purple-700'
            case 'warehouse': return 'bg-green-100 text-green-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    const getRoleLabel = (userRole) => {
        switch (userRole) {
            case 'driver': return 'Sürücü'
            case 'manager': return 'Yönetici'
            case 'warehouse': return 'Depo'
            default: return 'Kullanıcı'
        }
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <MessageCircle size={20} className="text-blue-600" />
                    <h3 className="font-bold text-slate-900">Sohbet</h3>
                    {shipmentName && (
                        <span className="text-sm text-slate-500">- {shipmentName}</span>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <MessageCircle size={48} className="mb-2 opacity-50" />
                        <p className="text-sm">Henüz mesaj yok</p>
                        <p className="text-xs">İlk mesajı siz gönderin!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwnMessage = msg.user_id === user.id
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-700">
                                            {msg.user_name}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(msg.user_role)}`}>
                                            {getRoleLabel(msg.user_role)}
                                        </span>
                                    </div>
                                    <div className={`px-4 py-2 rounded-2xl ${isOwnMessage
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-900'
                                        }`}>
                                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {formatTime(msg.created_at)}
                                    </span>
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Mesajınızı yazın..."
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        <Send size={18} />
                        Gönder
                    </button>
                </div>
            </form>
        </div>
    )
}

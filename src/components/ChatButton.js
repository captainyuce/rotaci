'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import ShipmentChat from './ShipmentChat'

export default function ChatButton({ shipmentId, shipmentName, unreadCount = 0 }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            {/* Chat Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="relative p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Sohbet"
            >
                <MessageCircle size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Chat Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
                            <h2 className="font-bold text-lg text-slate-900">Sevkiyat Sohbeti</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-slate-600" />
                            </button>
                        </div>

                        {/* Chat Component */}
                        <div className="flex-1 overflow-hidden">
                            <ShipmentChat shipmentId={shipmentId} shipmentName={shipmentName} />
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

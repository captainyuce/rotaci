'use client'

import { useEffect, useState } from 'react'
import { X, Bell } from 'lucide-react'

export default function Toast({ message, type = 'info', onClose, duration = 5000 }) {
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false)
            setTimeout(onClose, 300) // Wait for animation
        }, duration)

        return () => clearTimeout(timer)
    }, [duration, onClose])

    if (!isVisible) return null

    const bgColors = {
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }

    return (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 transform translate-y-0 opacity-100 ${bgColors[type] || bgColors.info}`}>
            <div className="p-1 bg-white bg-opacity-50 rounded-full">
                <Bell size={18} />
            </div>
            <p className="text-sm font-medium">{message}</p>
            <button
                onClick={() => {
                    setIsVisible(false)
                    setTimeout(onClose, 300)
                }}
                className="p-1 hover:bg-black hover:bg-opacity-5 rounded-full transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    )
}

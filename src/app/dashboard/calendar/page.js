'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { logSecurityEvent } from '@/lib/auditLog'

export default function CalendarPage() {
    const { hasPermission, user } = useAuth()

    const [currentDate, setCurrentDate] = useState(new Date())
    const [shipments, setShipments] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState(null)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const [searchFilters, setSearchFilters] = useState({
        startDate: '',
        endDate: '',
        customerName: '',
        vehiclePlate: '',
        status: ''
    })
    const [vehicles, setVehicles] = useState([])

    // Permission check
    if (!hasPermission(PERMISSIONS.VIEW)) {
        logSecurityEvent(user?.id, user?.full_name || user?.username, '/dashboard/calendar', 'Page Access Denied')
        return <div className="p-8 text-center text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</div>
    }

    useEffect(() => {
        fetchShipments()
        fetchVehicles()
    }, [currentDate])

    const fetchShipments = async () => {
        setLoading(true)
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

        const { data, error } = await supabase
            .from('shipments')
            .select('*, vehicle:vehicles(plate)')
            .gte('delivery_date', startOfMonth.toISOString().split('T')[0])
            .lte('delivery_date', endOfMonth.toISOString().split('T')[0])

        if (data) setShipments(data)
        setLoading(false)
    }

    const fetchVehicles = async () => {
        const { data, error } = await supabase
            .from('vehicles')
            .select('id, plate')
            .order('plate')

        if (data) setVehicles(data)
    }

    const getDaysInMonth = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const days = []

        // Add empty slots for days before the first day of the month
        // getDay() returns 0 for Sunday, we want Monday as 0 (or adjust accordingly)
        // Let's assume Monday start: 0=Sun, 1=Mon... 
        // Standard JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        // We want Mon=0, ..., Sun=6
        let startDay = firstDay.getDay() - 1
        if (startDay === -1) startDay = 6

        for (let i = 0; i < startDay; i++) {
            days.push(null)
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i))
        }

        return days
    }

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1))
    }

    const days = getDaysInMonth()
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

    const getShipmentsForDay = (date) => {
        if (!date) return []
        // Use local date to match the calendar cell's date
        const offset = date.getTimezoneOffset()
        const localDate = new Date(date.getTime() - (offset * 60 * 1000))
        const dateStr = localDate.toISOString().split('T')[0]
        return shipments.filter(s => s.delivery_date === dateStr)
    }

    const handleSearch = async () => {
        if (!searchFilters.startDate || !searchFilters.endDate) {
            alert('Lütfen başlangıç ve bitiş tarihlerini seçin.')
            return
        }

        setLoading(true)
        let query = supabase
            .from('shipments')
            .select('*, vehicle:vehicles(plate)')
            .gte('delivery_date', searchFilters.startDate)
            .lte('delivery_date', searchFilters.endDate)

        if (searchFilters.customerName) {
            query = query.ilike('customer_name', `%${searchFilters.customerName}%`)
        }

        if (searchFilters.status) {
            query = query.eq('status', searchFilters.status)
        }

        const { data, error } = await query.order('delivery_date', { ascending: false })

        if (data) {
            // Filter by vehicle plate if specified (since it's a joined field)
            let results = data
            if (searchFilters.vehiclePlate) {
                results = data.filter(s =>
                    s.vehicle?.plate?.toLowerCase().includes(searchFilters.vehiclePlate.toLowerCase())
                )
            }
            setSearchResults(results)
        }
        setLoading(false)
    }

    const clearSearch = () => {
        setSearchResults(null)
        setSearchFilters({
            startDate: '',
            endDate: '',
            customerName: '',
            vehiclePlate: '',
            status: ''
        })
    }

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto pointer-events-auto">
            <div className="flex items-center justify-between mb-6 relative">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <CalendarIcon className="text-primary" />
                    Sevkiyat Takvimi
                </h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
                        <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 text-slate-700 rounded-md">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-bold text-lg w-32 text-center text-slate-900">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 text-slate-700 rounded-md">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-zinc-700 text-white rounded-lg shadow-sm transition-colors"
                    >
                        <Search size={18} />
                        <span className="hidden md:inline">Gelişmiş Arama</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Day Headers */}
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                    {dayNames.map(day => (
                        <div key={day} className="p-3 text-center font-bold text-slate-700 text-sm">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 auto-rows-fr">
                    {days.map((date, index) => {
                        const dayShipments = getShipmentsForDay(date)
                        const isToday = date && new Date().toDateString() === date.toDateString()

                        return (
                            <div
                                key={index}
                                className={`min-h-[120px] p-2 border-b border-r border-slate-100 relative group transition-colors
                                    ${!date ? 'bg-slate-50/50' : 'hover:bg-zinc-50/30 cursor-pointer bg-white'}
                                    ${isToday ? 'bg-zinc-50/50' : ''}
                                `}
                                onClick={() => date && setSelectedDay({ date, shipments: dayShipments })}
                            >
                                {date && (
                                    <>
                                        <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full mb-1
                                            ${isToday ? 'bg-primary text-white' : 'text-slate-700'}
                                        `}>
                                            {date.getDate()}
                                        </span>

                                        <div className="space-y-1 mt-1">
                                            {dayShipments.slice(0, 3).map(s => (
                                                <div key={s.id} className="text-xs px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded truncate border border-zinc-200">
                                                    {s.customer_name}
                                                </div>
                                            ))}
                                            {dayShipments.length > 3 && (
                                                <div className="text-xs text-slate-500 font-medium pl-1">
                                                    + {dayShipments.length - 3} daha
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Day Details Modal */}
            {selectedDay && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[80vh] overflow-y-auto relative">
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="font-bold text-lg text-slate-900">
                                {selectedDay.date.getDate()} {monthNames[selectedDay.date.getMonth()]} Sevkiyatları
                            </h3>
                            <button
                                onClick={() => setSelectedDay(null)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                <XIcon />
                            </button>
                        </div>

                        {selectedDay.shipments.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">Bu tarihte planlanmış sevkiyat yok.</p>
                        ) : (
                            <div className="space-y-3">
                                {selectedDay.shipments.map(s => {
                                    // Format delivered_at time if available
                                    const deliveredTime = s.delivered_at
                                        ? new Date(s.delivered_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                                        : null;

                                    return (
                                        <div key={s.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-slate-900">{s.customer_name}</span>
                                                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                                                    {s.delivery_time || '--:--'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 truncate">{s.delivery_address}</p>
                                            <div className="mt-2 flex gap-2 text-xs flex-wrap">
                                                <span className="bg-zinc-50 text-zinc-700 px-2 py-0.5 rounded border border-blue-100">
                                                    {s.weight} Palet
                                                </span>
                                                {s.vehicle?.plate && (
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                                                        🚐 {s.vehicle.plate}
                                                    </span>
                                                )}
                                                {s.status === 'delivered' || s.status === 'unloaded' ? (
                                                    <>
                                                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                                                            {s.type === 'pickup' ? 'Teslim Alındı' : 'Teslim Edildi'}
                                                        </span>
                                                        {deliveredTime && (
                                                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                                                ✓ {deliveredTime}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : s.status === 'pending' ? (
                                                    <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100">
                                                        Bekliyor
                                                    </span>
                                                ) : s.status === 'assigned' ? (
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                                        Yolda
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Search Modal */}
            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                filters={searchFilters}
                onFilterChange={setSearchFilters}
                onSearch={handleSearch}
                onClear={clearSearch}
                results={searchResults}
                vehicles={vehicles}
            />
        </div>
    )
}

function XIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
    )
}

function SearchModal({ isOpen, onClose, filters, onFilterChange, onSearch, onClear, results, vehicles }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                    <h2 className="text-xl font-bold text-gray-800">Gelişmiş Arama</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <XIcon />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Customer Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Adı</label>
                        <input
                            type="text"
                            value={filters.customerName}
                            onChange={(e) => onFilterChange({ ...filters, customerName: e.target.value })}
                            placeholder="Müşteri adı girin..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Vehicle Plate */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Araç Plakası</label>
                        <select
                            value={filters.vehiclePlate}
                            onChange={(e) => onFilterChange({ ...filters, vehiclePlate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Tüm Araçlar</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.plate}>{v.plate}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                        <select
                            value={filters.status}
                            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Tüm Durumlar</option>
                            <option value="pending">Beklemede</option>
                            <option value="assigned">Atandı</option>
                            <option value="in_transit">Yolda</option>
                            <option value="delivered">Teslim Edildi</option>
                            <option value="unloaded">İndirildi</option>
                            <option value="failed">Başarısız</option>
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onSearch}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            🔍 Ara
                        </button>
                        <button
                            onClick={onClear}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    {/* Search Results */}
                    {results.length > 0 && (
                        <div className="mt-6 border-t border-gray-200 pt-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">
                                Arama Sonuçları ({results.length} sonuç)
                            </h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {results.map(s => (
                                    <div key={s.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-bold text-gray-800">{s.customer_name}</span>
                                                {s.vehicle?.plate && (
                                                    <span className="ml-2 text-sm text-gray-600">🚐 {s.vehicle.plate}</span>
                                                )}
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${s.status === 'delivered' || s.status === 'unloaded' ? 'bg-green-100 text-green-800' :
                                                s.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                                                    s.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                                                        s.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {s.status === 'delivered' ? 'Teslim Edildi' :
                                                    s.status === 'unloaded' ? 'İndirildi' :
                                                        s.status === 'in_transit' ? 'Yolda' :
                                                            s.status === 'assigned' ? 'Atandı' :
                                                                s.status === 'failed' ? 'Başarısız' :
                                                                    'Beklemede'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-1">📍 {s.delivery_address}</p>
                                        <div className="flex gap-4 text-sm text-gray-500">
                                            <span>📅 {s.delivery_date}</span>
                                            <span>⚖️ {s.weight} kg</span>
                                            {(s.status === 'delivered' || s.status === 'unloaded') && s.delivered_at && (
                                                <span>✓ {new Date(s.delivered_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.length === 0 && filters.startDate && (
                        <div className="mt-6 border-t border-gray-200 pt-6 text-center text-gray-500">
                            Sonuç bulunamadı
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

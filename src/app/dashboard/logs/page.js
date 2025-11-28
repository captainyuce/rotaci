'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/components/AuthProvider'
import { PERMISSIONS } from '@/lib/permissions'
import { getActionLabel, getActionColor } from '@/lib/auditLog'
import { Clock, User, Package, Filter } from 'lucide-react'

export default function LogsPage() {
    const { hasPermission } = useAuth()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterAction, setFilterAction] = useState('all')
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!hasPermission(PERMISSIONS.VIEW_LOGS)) {
            return
        }
        fetchLogs()
    }, [hasPermission, filterAction])

    const fetchLogs = async () => {
        setLoading(true)
        setError(null)

        try {
            let query = supabase
                .from('shipment_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100)

            if (filterAction !== 'all') {
                query = query.eq('action', filterAction)
            }

            const { data, error: fetchError } = await query

            console.log('Logs fetch result:', { data, error: fetchError })

            if (fetchError) {
                setError(fetchError.message)
                console.error('Error fetching logs:', fetchError)
            } else {
                setLogs(data || [])
            }
        } catch (err) {
            console.error('Exception fetching logs:', err)
            setError(err.message)
        }

        setLoading(false)
    }

    if (!hasPermission(PERMISSIONS.VIEW_LOGS)) {
        return (
            <div className="h-full flex flex-col bg-white">
                <div className="p-8 text-center">
                    <div className="text-red-600 text-6xl mb-4">🚫</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Yetkiniz Yok</h2>
                    <p className="text-slate-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
                </div>
            </div>
        )
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="fixed left-20 top-4 bottom-4 w-[400px] md:w-[600px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto">
            <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">İşlem Geçmişi</h2>
                        <p className="text-xs text-slate-500">{logs.length} kayıt</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-400" />
                        <select
                            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                        >
                            <option value="all">Tümü</option>
                            <option value="created">Eklenenler</option>
                            <option value="updated">Düzenlenenler</option>
                            <option value="deleted">Silinenler</option>
                            <option value="assigned">Atananlar</option>
                            <option value="acknowledged">Kabul Edilenler</option>
                            <option value="delivered">Teslim Edilenler</option>
                            <option value="failed">Teslim Edilemeyenler</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Yükleniyor...</div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <div className="text-red-600 mb-2">❌ Hata</div>
                        <div className="text-sm text-slate-600">{error}</div>
                        <div className="text-xs text-slate-500 mt-2">
                            Tablo oluşturulmamış olabilir. Supabase SQL Editor'da add_audit_logs.sql dosyasını çalıştırın.
                        </div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="text-slate-500 mb-2">📝 Henüz kayıt yok</div>
                        <div className="text-xs text-slate-600">
                            Sevkiyat ekleme, düzenleme veya silme işlemi yapın
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {logs.map((log) => (
                            <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                                            {getActionLabel(log.action)}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs text-slate-600">
                                            <Clock size={12} />
                                            {formatDate(log.created_at)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-700">
                                        <User size={12} />
                                        <span className="font-medium">{log.user_name}</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-lg p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package size={14} className="text-slate-500" />
                                        <span className="font-medium text-slate-800">
                                            {log.shipment_data?.customer_name || 'Bilinmeyen Müşteri'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-700 space-y-1">
                                        <div>📍 {log.shipment_data?.delivery_address}</div>
                                        {log.shipment_data?.weight && (
                                            <div>⚖️ {log.shipment_data.weight} kg</div>
                                        )}
                                        {log.shipment_data?.delivery_time && (
                                            <div>🕐 {log.shipment_data.delivery_time}</div>
                                        )}
                                    </div>

                                    {log.action === 'updated' && log.changes && (
                                        <div className="mt-2 pt-2 border-t border-slate-200">
                                            <div className="text-xs font-medium text-slate-600 mb-1">Değişiklikler:</div>
                                            <div className="text-xs text-slate-500">
                                                {Object.keys(log.changes.after || {}).map(key => {
                                                    const before = log.changes.before?.[key]
                                                    const after = log.changes.after?.[key]
                                                    if (before !== after && key !== 'id') {
                                                        return (
                                                            <div key={key} className="mb-1">
                                                                <span className="font-medium">{key}:</span>{' '}
                                                                <span className="line-through text-red-600">{String(before)}</span>
                                                                {' → '}
                                                                <span className="text-green-600">{String(after)}</span>
                                                            </div>
                                                        )
                                                    }
                                                    return null
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

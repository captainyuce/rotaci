'use client'

import { useState, useEffect } from 'react'
import { User, Plus, Edit, Trash2, X, Shield } from 'lucide-react'
import { ROLES, PERMISSION_LABELS, PERMISSIONS } from '@/lib/permissions'
import { useAuth } from '@/components/AuthProvider'
import { logSecurityEvent, logShipmentAction } from '@/lib/auditLog'

export default function UsersPage() {
    const { user, hasPermission } = useAuth()

    // Permission check
    if (!hasPermission(PERMISSIONS.MANAGE_USERS)) {
        logSecurityEvent(user?.id, user?.full_name || user?.username, '/dashboard/users', 'Page Access Denied')
        return <div className="p-8 text-center text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</div>
    }
    const [users, setUsers] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'admin',
        permissions: []
    })
    const [editId, setEditId] = useState(null)

    const fetchUsers = async () => {
        const res = await fetch('/api/users')
        if (res.ok) setUsers(await res.json())
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()

        console.log('Form submitted with data:', formData)

        const url = '/api/users'
        const method = editId ? 'PUT' : 'POST'
        const body = editId ? { ...formData, id: editId } : formData

        console.log('Sending request:', { method, body })

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })

        const responseData = await res.json()
        console.log('Response:', responseData)

        if (res.ok) {
            setShowModal(false)
            setEditId(null)
            setFormData({ username: '', password: '', full_name: '', role: 'admin', permissions: [] })
            fetchUsers()

            // Log action
            if (editId) {
                const oldUser = users.find(u => u.id === editId)
                await logShipmentAction(
                    'updated',
                    null,
                    { type: 'user', ...body },
                    user.id,
                    user.full_name || user.username,
                    { before: oldUser, after: body }
                )
            } else {
                await logShipmentAction(
                    'created',
                    null,
                    { type: 'user', ...body },
                    user.id,
                    user.full_name || user.username
                )
            }
        } else {
            alert('Hata: ' + (responseData.error || 'Bilinmeyen hata'))
        }
    }

    const handleDelete = async (id) => {
        if (!hasPermission(PERMISSIONS.MANAGE_USERS)) {
            logSecurityEvent(user?.id, user?.full_name || user?.username, 'delete_user', `Attempted to delete user ${id}`)
            alert('Bu işlem için yetkiniz yok')
            return
        }
        if (!confirm('Kullanıcıyı silmek istediğinize emin misiniz?')) return
        const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
            fetchUsers()
            // Log deletion
            const deletedUser = users.find(u => u.id === id)
            if (deletedUser) {
                await logShipmentAction(
                    'deleted',
                    null,
                    { type: 'user', ...deletedUser },
                    user.id,
                    user.full_name || user.username
                )
            }
        }
    }

    const getUserPermissions = (user) => {
        // If user has custom permissions array, use that
        if (user.permissions && Array.isArray(user.permissions)) {
            return user.permissions
        }
        // Otherwise fall back to role-based permissions
        const roleKey = user.role?.toUpperCase()
        const roleDef = ROLES[roleKey]
        return roleDef?.permissions || []
    }

    const togglePermission = (permission) => {
        setFormData(prev => {
            const perms = prev.permissions || []
            if (perms.includes(permission)) {
                return { ...prev, permissions: perms.filter(p => p !== permission) }
            } else {
                return { ...prev, permissions: [...perms, permission] }
            }
        })
    }

    return (
        <div className="fixed left-20 top-4 bottom-4 w-[400px] md:w-[800px] bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden pointer-events-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Kullanıcı Yönetimi</h1>
                <button
                    onClick={() => {
                        setEditId(null)
                        setFormData({ username: '', password: '', full_name: '', role: 'admin', permissions: [] })
                        setShowModal(true)
                    }}
                    className="btn btn-primary flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-zinc-700"
                >
                    <Plus size={20} /> Yeni Kullanıcı
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600">Ad Soyad</th>
                            <th className="p-4 font-semibold text-slate-600">Kullanıcı Adı</th>
                            <th className="p-4 font-semibold text-slate-600">Rol</th>
                            <th className="p-4 font-semibold text-slate-600">Yetkiler</th>
                            <th className="p-4 font-semibold text-slate-600 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map((user) => {
                            const permissions = getUserPermissions(user)
                            return (
                                <tr key={user.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-medium text-slate-900">{user.full_name}</td>
                                    <td className="p-4 text-slate-600">{user.username}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize
                                            ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-700'}
                                        `}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {permissions.slice(0, 3).map(perm => (
                                                <span key={perm} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                    {PERMISSION_LABELS[perm] || perm}
                                                </span>
                                            ))}
                                            {permissions.length > 3 && (
                                                <span className="text-[10px] text-slate-400 px-1">+{permissions.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button
                                            onClick={() => {
                                                setFormData({
                                                    username: user.username,
                                                    password: user.password,
                                                    full_name: user.full_name,
                                                    role: user.role,
                                                    permissions: user.permissions || []
                                                })
                                                setEditId(user.id)
                                                setShowModal(true)
                                            }}
                                            className="text-primary hover:text-zinc-800 p-1"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800 p-1">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 pointer-events-auto">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
                            </h2>
                            <button onClick={() => setShowModal(false)}><X size={24} className="text-slate-500 hover:text-slate-700" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                type="text" placeholder="Ad Soyad" required className="w-full p-2 border rounded-lg text-slate-900 placeholder:text-slate-400"
                                value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            />
                            <input
                                type="text" placeholder="Kullanıcı Adı" required className="w-full p-2 border rounded-lg text-slate-900 placeholder:text-slate-400"
                                value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                            />
                            <input
                                type="text" placeholder="Şifre" required className="w-full p-2 border rounded-lg text-slate-900 placeholder:text-slate-400"
                                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                            <select
                                className="w-full p-2 border rounded-lg text-slate-900"
                                value={formData.role}
                                onChange={e => {
                                    const newRole = e.target.value
                                    let newPermissions = []

                                    // Find permissions for the selected role
                                    const roleDef = Object.values(ROLES).find(r => r.name.toLowerCase() === newRole)
                                    if (roleDef) {
                                        newPermissions = roleDef.permissions
                                    }

                                    setFormData({
                                        ...formData,
                                        role: newRole,
                                        permissions: newPermissions
                                    })
                                }}
                            >
                                {Object.values(ROLES).map(role => (
                                    <option key={role.name} value={role.name.toLowerCase()}>
                                        {role.label}
                                    </option>
                                ))}
                                <option value="driver">Sürücü</option>
                            </select>

                            {/* Permissions Section */}
                            <div className="border-t pt-4">
                                <label className="block text-sm font-bold text-slate-700 mb-3">Yetkiler</label>
                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg">
                                    {Object.entries(PERMISSION_LABELS).map(([perm, label]) => (
                                        <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={(formData.permissions || []).includes(perm)}
                                                onChange={() => togglePermission(perm)}
                                                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
                                            />
                                            <span className="text-sm text-slate-700">{label}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {(formData.permissions || []).length} yetki seçildi
                                </p>
                            </div>

                            <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-zinc-700">
                                Kaydet
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

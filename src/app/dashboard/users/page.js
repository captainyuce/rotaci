'use client'

import { useState, useEffect } from 'react'
import { User, Plus, Edit, Trash2, X } from 'lucide-react'

export default function UsersPage() {
    const [users, setUsers] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'admin' })
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
        const url = '/api/users'
        const method = editId ? 'PUT' : 'POST'
        const body = editId ? { ...formData, id: editId } : formData

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })

        if (res.ok) {
            setShowModal(false)
            setEditId(null)
            setFormData({ username: '', password: '', name: '', role: 'admin' })
            fetchUsers()
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Kullanıcıyı silmek istediğinize emin misiniz?')) return
        const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
        if (res.ok) fetchUsers()
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Kullanıcı Yönetimi</h1>
                <button
                    onClick={() => {
                        setEditId(null)
                        setFormData({ username: '', password: '', name: '', role: 'admin' })
                        setShowModal(true)
                    }}
                    className="btn btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    <Plus size={20} /> Yeni Kullanıcı
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600">Ad Soyad</th>
                            <th className="p-4 font-semibold text-slate-600">Kullanıcı Adı</th>
                            <th className="p-4 font-semibold text-slate-600">Rol</th>
                            <th className="p-4 font-semibold text-slate-600 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                                <td className="p-4 font-medium text-slate-900">{user.name}</td>
                                <td className="p-4 text-slate-600">{user.username}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize
                                        ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
                                    `}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button
                                        onClick={() => {
                                            setFormData({ username: user.username, password: user.password, name: user.name, role: user.role })
                                            setEditId(user.id)
                                            setShowModal(true)
                                        }}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800 p-1">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}
                            </h2>
                            <button onClick={() => setShowModal(false)}><X size={24} className="text-slate-400" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                type="text" placeholder="Ad Soyad" required className="w-full p-2 border rounded-lg"
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                            <input
                                type="text" placeholder="Kullanıcı Adı" required className="w-full p-2 border rounded-lg"
                                value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                            />
                            <input
                                type="text" placeholder="Şifre" required className="w-full p-2 border rounded-lg"
                                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                            <select
                                className="w-full p-2 border rounded-lg"
                                value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="admin">Yönetici</option>
                                <option value="driver">Sürücü</option>
                            </select>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">
                                Kaydet
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

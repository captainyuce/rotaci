'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Map from '@/components/Map/MapComponent'
import { initialVehicles, initialPendingOrders, currentUser as defaultUser, initialUsers, ROLES, ROLE_LABELS, MENU_ITEMS, SPECIAL_PERMISSIONS } from '@/lib/data'
import { getUsers, addUser, getShipments, addShipment, updateShipment, getVehicles, updateVehicle } from '@/lib/api'
import { getAllDriverLocations } from '@/lib/locationTracking'
import { getRoute } from '@/lib/routing'
import { Menu, Truck, Package, Check, X, Clock, AlertTriangle, User, Users, ClipboardList, Settings } from 'lucide-react'
import Sidebar from '@/components/Layout/Sidebar'

export default function Dashboard() {
    const router = useRouter()
    // App State
    const [vehicles, setVehicles] = useState([])
    const [pendingOrders, setPendingOrders] = useState([])
    const [loadingData, setLoadingData] = useState(true)

    // Poll data every 5 seconds
    useEffect(() => {
        const pollData = async () => {
            try {
                const [locations, shipmentsData, vehiclesData] = await Promise.all([
                    getAllDriverLocations(),
                    getShipments(),
                    getVehicles()
                ])

                // Update vehicles with locations
                const updatedVehicles = vehiclesData.map(vehicle => {
                    const driverLocation = locations[vehicle.id]
                    if (driverLocation) {
                        return {
                            ...vehicle,
                            location: driverLocation.location
                        }
                    }
                    return vehicle
                })
                setVehicles(updatedVehicles)

                // Filter pending orders
                setPendingOrders(shipmentsData.filter(s => s.status === 'pending'))

                setLoadingData(false)
            } catch (error) {
                console.error('Failed to fetch data:', error)
            }
        }

        // Initial fetch
        pollData()

        // Poll every 5 seconds
        const interval = setInterval(pollData, 5000)

        return () => clearInterval(interval)
    }, [])
    const [approvalQueue, setApprovalQueue] = useState([]) // New: For 09:00-18:00 shipments
    const [nextDayOrders, setNextDayOrders] = useState([]) // New: Rejected/Next Day shipments

    // UI State
    const [currentUser, setCurrentUser] = useState(defaultUser)
    const [currentView, setCurrentView] = useState('dashboard') // dashboard, new_shipment, pool, approval
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [selectedLocation, setSelectedLocation] = useState(null)

    // Form State
    const [newStopData, setNewStopData] = useState({
        name: '', lat: '', lng: '', vehicleId: '', load: '', deliveryTime: '', notes: ''
    })
    const [recommendedVehicleId, setRecommendedVehicleId] = useState(null)

    // --- Logic: Time Check ---
    const isWorkingHours = () => {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 9 && hour < 18;
    }

    // --- Handlers ---

    const handleMapClick = (latlng) => {
        if (currentView !== 'new_shipment') return; // Only allow map click in New Shipment view

        setSelectedLocation(latlng)
        setNewStopData(prev => ({
            ...prev,
            lat: latlng.lat.toFixed(4),
            lng: latlng.lng.toFixed(4)
        }))
        if (newStopData.load) recommendVehicle(latlng, newStopData.load);
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setNewStopData(prev => ({ ...prev, [name]: value }))
        if (name === 'load' && newStopData.lat && newStopData.lng) {
            recommendVehicle({ lat: newStopData.lat, lng: newStopData.lng }, value);
        }
    }

    const recommendVehicle = (location, loadAmount) => {
        const load = parseInt(loadAmount);
        if (isNaN(load)) return;
        let bestVehicle = null;
        let bestScore = -1;

        vehicles.forEach(vehicle => {
            const remainingCapacity = vehicle.capacity - vehicle.currentLoad;
            if (remainingCapacity < load) return;
            const dist = Math.sqrt(Math.pow(vehicle.location[0] - location.lat, 2) + Math.pow(vehicle.location[1] - location.lng, 2));
            const score = (1 / (dist + 0.001)) * 0.7 + (remainingCapacity / vehicle.capacity) * 0.3;
            if (score > bestScore) { bestScore = score; bestVehicle = vehicle.id; }
        });
        setRecommendedVehicleId(bestVehicle);
    }

    // Submit New Shipment
    const handleSubmitShipment = async () => {
        if (!newStopData.name || !newStopData.lat || !newStopData.lng || !newStopData.load) {
            alert('Lütfen tüm zorunlu alanları doldurun.');
            return;
        }

        const newOrder = {
            customer: newStopData.name,
            location_lat: parseFloat(newStopData.lat),
            location_lng: parseFloat(newStopData.lng),
            load: parseInt(newStopData.load),
            delivery_time: newStopData.deliveryTime,
            notes: newStopData.notes,
            status: 'pending',
            submission_time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };

        try {
            if (isWorkingHours()) {
                // Add to approval queue (for now local, but should be API)
                // TODO: Add approval queue API
                setApprovalQueue([...approvalQueue, { ...newOrder, id: Date.now() }]);
                alert('Sevkiyat onay kuyruğuna eklendi (09:00-18:00 arası).');
            } else {
                // Add directly to pool via API
                await addShipment(newOrder);
                alert('Sevkiyat havuza eklendi.');
            }

            // Reset form
            setNewStopData({ name: '', lat: '', lng: '', vehicleId: '', load: '', deliveryTime: '', notes: '' });
            setSelectedLocation(null);
            setCurrentView('pool');
        } catch (error) {
            console.error('Failed to add shipment:', error);
            alert('Sevkiyat eklenirken bir hata oluştu.');
        }
    }

    // Admin: Approve Shipment
    const handleApproveShipment = (order) => {
        setPendingOrders(prev => [...prev, { ...order, status: 'pending' }]);
        setApprovalQueue(prev => prev.filter(o => o.id !== order.id));
    }

    // Admin: Reject/Next Day Shipment
    const handleRejectShipment = (order) => {
        setNextDayOrders(prev => [...prev, { ...order, status: 'next_day' }]);
        setApprovalQueue(prev => prev.filter(o => o.id !== order.id));
    }

    // Assign to Vehicle (From Pool)
    const handleAssignOrder = async (order, targetVehicleId) => {
        const targetVehicle = vehicles.find(v => v.id === targetVehicleId);
        if (!targetVehicle) return;

        if (targetVehicle.current_load + order.load > targetVehicle.capacity) {
            if (!confirm(`UYARI: Kapasite aşılacak! Devam?`)) return;
        }

        try {
            // Update shipment status and assigned driver
            await updateShipment({
                id: order.id,
                status: 'assigned',
                assigned_driver: targetVehicleId
            });

            // Update vehicle load
            await updateVehicle({
                id: targetVehicle.id,
                current_load: targetVehicle.current_load + order.load
            });

            // Remove from local pending orders immediately for UI responsiveness
            setPendingOrders(prev => prev.filter(o => o.id !== order.id));

            alert(`${order.customer} sevkiyatı ${targetVehicle.name} aracına atandı.`);
        } catch (error) {
            console.error('Failed to assign order:', error);
            alert('Atama işlemi başarısız oldu.');
        }
    }

    const resetForm = () => {
        setNewStopData({ name: '', lat: '', lng: '', vehicleId: '', load: '', deliveryTime: '', notes: '' });
        setSelectedLocation(null);
        setRecommendedVehicleId(null);
    }

    // --- Render Views ---

    // --- Render Content Panels ---

    const renderContentPanel = () => {
        switch (currentView) {
            case 'new_shipment':
                return (
                    <div className="h-full overflow-y-auto p-6 border-r bg-white shadow-lg relative z-10">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-800">
                            <Package size={24} /> Yeni Sevkiyat
                        </h2>

                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
                                <div className="font-bold flex items-center gap-2 mb-1"><Clock size={16} /> Çalışma Saati</div>
                                {isWorkingHours()
                                    ? '09:00-18:00: Yönetici onayı gerekir.'
                                    : '09:00 öncesi: Direkt havuza eklenir.'}
                            </div>

                            <div className="space-y-3">
                                <input type="text" name="name" placeholder="Müşteri Adı" className="input w-full" value={newStopData.name} onChange={handleInputChange} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" name="lat" placeholder="Enlem" className="input" value={newStopData.lat} onChange={handleInputChange} />
                                    <input type="text" name="lng" placeholder="Boylam" className="input" value={newStopData.lng} onChange={handleInputChange} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" name="load" placeholder="Yük (kg)" className="input" value={newStopData.load} onChange={handleInputChange} />
                                    <input type="time" name="deliveryTime" className="input" value={newStopData.deliveryTime} onChange={handleInputChange} />
                                </div>
                                <textarea name="notes" placeholder="Notlar" className="input w-full h-20" value={newStopData.notes} onChange={handleInputChange} />
                            </div>

                            <button className="btn btn-primary w-full py-3 font-bold shadow-sm" onClick={handleSubmitShipment}>
                                Kaydet ve Gönder
                            </button>
                            <p className="text-xs text-gray-400 text-center">Konum seçmek için haritaya tıklayın.</p>
                        </div>
                    </div>
                );

            case 'pool':
                // Check if user has permission to assign shipments
                const canAssignShipments = currentUser.permissions && currentUser.permissions.includes('can_assign_shipments');

                return (
                    <div className="h-full overflow-y-auto p-6 border-r bg-white shadow-lg relative z-10">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-700">
                            <Check size={24} /> Sevkiyat Havuzu
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full ml-auto">{pendingOrders.length}</span>
                        </h2>
                        <div className="space-y-4">
                            {pendingOrders.length === 0 && <div className="text-center text-gray-400 py-8">Havuz boş.</div>}
                            {pendingOrders.map(order => (
                                <div key={order.id} className="card p-4 border-l-4 border-green-500 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="font-bold text-gray-800">{order.customer}</div>
                                    <div className="text-sm text-gray-600 mt-1">{order.load} kg • {order.deliveryTime}</div>
                                    <div className="text-xs text-gray-500 italic mt-2 mb-3">{order.notes}</div>

                                    {canAssignShipments ? (
                                        <select
                                            className="input text-sm w-full bg-gray-50"
                                            onChange={(e) => e.target.value && handleAssignOrder(order, parseInt(e.target.value))}
                                            value=""
                                        >
                                            <option value="">Araca Ata...</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.name} ({v.capacity - v.currentLoad} kg boş)</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded border border-gray-200">
                                            🔒 Atama yetkisi yok
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'approval':
                return (
                    <div className="h-full overflow-y-auto p-6 border-r bg-white shadow-lg relative z-10">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-orange-600">
                            <AlertTriangle size={24} /> Onay Bekleyenler
                            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full ml-auto">{approvalQueue.length}</span>
                        </h2>

                        <div className="space-y-4">
                            {approvalQueue.length === 0 && <div className="text-center text-gray-400 py-8">Bekleyen işlem yok.</div>}
                            {approvalQueue.map(order => (
                                <div key={order.id} className="card p-4 border-l-4 border-orange-400 shadow-sm">
                                    <div className="font-bold text-gray-800">{order.customer}</div>
                                    <div className="text-sm text-gray-600 mt-1">{order.load} kg • {order.submissionTime}</div>
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => handleRejectShipment(order)} className="flex-1 btn bg-gray-100 text-gray-600 text-xs hover:bg-gray-200">Ertele</button>
                                        <button onClick={() => handleApproveShipment(order)} className="flex-1 btn bg-green-600 text-white text-xs hover:bg-green-700">Onayla</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {nextDayOrders.length > 0 && (
                            <div className="mt-8 pt-6 border-t">
                                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Ertesi Güne Kalanlar</h3>
                                <div className="space-y-2 opacity-60">
                                    {nextDayOrders.map(order => (
                                        <div key={order.id} className="text-sm p-2 bg-gray-50 rounded flex justify-between">
                                            <span>{order.customer}</span>
                                            <span className="font-mono">{order.load}kg</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'vehicle_management':
                return (
                    <div className="h-full overflow-y-auto p-6 border-r bg-white shadow-lg relative z-10">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                            <Truck size={24} /> Araç Yönetimi
                        </h2>

                        {/* Add New Vehicle Form */}
                        <div className="card p-4 mb-6 border-2 border-dashed border-slate-200 bg-slate-50">
                            <h3 className="font-bold text-sm mb-3 text-slate-600">Yeni Araç Ekle</h3>
                            <div className="space-y-3">
                                <input type="text" placeholder="Araç Adı (Örn: Araç 4)" className="input w-full" />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Plaka" className="input" />
                                    <input type="text" placeholder="Sürücü" className="input" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" placeholder="Kapasite (kg)" className="input" />
                                    <select className="input">
                                        <option value="truck">Kamyon</option>
                                        <option value="van">Kamyonet</option>
                                        <option value="car">Binek</option>
                                    </select>
                                </div>

                                <div className="bg-white p-3 rounded border">
                                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Kısıtlamalar</div>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" className="rounded text-blue-600" /> 1. Köprü Yasak
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" className="rounded text-blue-600" /> 2. Köprü Yasak
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" className="rounded text-blue-600" /> Avrasya Tüneli Yasak
                                        </label>
                                    </div>
                                </div>

                                <button className="btn btn-primary w-full">Aracı Kaydet</button>
                            </div>
                        </div>

                        {/* Vehicle List */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg text-slate-800">Mevcut Araçlar ({vehicles.length})</h3>
                            {vehicles.map(v => (
                                <div key={v.id} className="card p-4 border shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-slate-800">{v.name}</div>
                                            <div className="text-xs text-slate-500">{v.driver}</div>
                                        </div>
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded font-mono uppercase">{v.type || 'Standart'}</span>
                                    </div>

                                    <div className="text-sm text-slate-600 mb-3">
                                        <div>Kapasite: {v.capacity} kg</div>
                                        <div>Mevcut Yük: {v.currentLoad} kg</div>
                                    </div>

                                    {v.restrictions && v.restrictions.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {v.restrictions.map(r => (
                                                <span key={r} className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] border border-red-100 rounded">
                                                    {r === 'bridge1' ? '1. Köprü' : r === 'bridge2' ? '2. Köprü' : r === 'tunnel' ? 'Avrasya' : r}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-3 flex gap-2">
                                        <button className="flex-1 btn bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">Düzenle</button>
                                        <button className="flex-1 btn bg-red-50 text-red-600 text-xs hover:bg-red-100">Sil</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'user_management':
                return (
                    <div className="h-full overflow-y-auto p-6 border-r bg-white shadow-lg relative z-10">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-700">
                            <Users size={24} /> Kullanıcı Yönetimi
                        </h2>

                        {/* Add New User Form */}
                        <div className="card p-4 mb-6 border-2 border-dashed border-purple-200 bg-purple-50">
                            <h3 className="font-bold text-sm mb-3 text-purple-600">Yeni Kullanıcı Ekle</h3>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Kullanıcı Adı"
                                    className="input w-full"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                />
                                <input
                                    type="password"
                                    placeholder="Şifre"
                                    className="input w-full"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Ad Soyad"
                                    className="input w-full"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                />
                                <select
                                    className="input w-full"
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>

                                {/* Menu Permission Selection */}
                                <div className="bg-white p-3 rounded border">
                                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Menü Erişim Yetkileri</div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {MENU_ITEMS.map(item => (
                                            <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-purple-600"
                                                    checked={newUser.permissions.includes(item.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewUser({ ...newUser, permissions: [...newUser.permissions, item.id] });
                                                        } else {
                                                            setNewUser({ ...newUser, permissions: newUser.permissions.filter(p => p !== item.id) });
                                                        }
                                                    }}
                                                />
                                                {item.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Special Permissions */}
                                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                    <div className="text-xs font-bold text-purple-600 mb-2 uppercase">Özel Yetkiler</div>
                                    <div className="space-y-2">
                                        {SPECIAL_PERMISSIONS.map(perm => (
                                            <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-purple-100 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-purple-600"
                                                    checked={newUser.permissions.includes(perm.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewUser({ ...newUser, permissions: [...newUser.permissions, perm.id] });
                                                        } else {
                                                            setNewUser({ ...newUser, permissions: newUser.permissions.filter(p => p !== perm.id) });
                                                        }
                                                    }}
                                                />
                                                {perm.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button className="btn btn-primary w-full bg-purple-600 hover:bg-purple-700" onClick={handleAddUser}>
                                    Kullanıcıyı Kaydet
                                </button>
                            </div>
                        </div>

                        {/* User List */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg text-slate-800">Mevcut Kullanıcılar ({users.length})</h3>
                            {users.map(user => (
                                <div key={user.id} className="card p-4 border shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <div className="font-bold text-slate-800">{user.name}</div>
                                            <div className="text-xs text-slate-500">{user.username}</div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === ROLES.ADMIN || user.role === ROLES.BOSS ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {ROLE_LABELS[user.role] || user.role}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <button className="flex-1 btn bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">Düzenle</button>
                                        <button className="flex-1 btn bg-red-50 text-red-600 text-xs hover:bg-red-100">Sil</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );



            default: // 'dashboard'
                return null;
        }
    }

    // --- Auth Check ---
    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (!user) {
            router.push('/login');
        } else {
            // Migration for old 'manager' role
            if (user.role === 'manager') {
                user.role = ROLES.WAREHOUSE_MANAGER;
            }
            // Migration: Add default permissions if missing
            if (!user.permissions) {
                if (user.role === ROLES.ADMIN || user.role === ROLES.BOSS) {
                    user.permissions = ['dashboard', 'new_shipment', 'pool', 'approval', 'vehicle_management', 'user_management', 'can_assign_shipments', 'can_approve_shipments'];
                } else if (user.role === ROLES.WAREHOUSE_MANAGER || user.role === ROLES.SHIPMENT_MANAGER) {
                    user.permissions = ['dashboard', 'new_shipment', 'pool', 'can_assign_shipments'];
                } else {
                    user.permissions = ['dashboard', 'new_shipment', 'pool'];
                }
                localStorage.setItem('currentUser', JSON.stringify(user));
            }
            setCurrentUser(user);
        }
    }, []);

    // --- User Management Logic ---
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        name: '',
        role: ROLES.WAREHOUSE_MANAGER,
        permissions: ['dashboard', 'new_shipment', 'pool'] // Default permissions
    });

    // Load users from API on mount
    useEffect(() => {
        async function fetchUsers() {
            try {
                const usersData = await getUsers();
                setUsers(usersData);
            } catch (error) {
                console.error('Failed to load users:', error);
            } finally {
                setLoadingUsers(false);
            }
        }
        fetchUsers();
    }, []);

    const handleAddUser = async () => {
        if (newUser.username && newUser.password && newUser.name && newUser.permissions.length > 0) {
            try {
                const addedUser = await addUser(newUser);
                setUsers([...users, addedUser]);
                setNewUser({
                    username: '',
                    password: '',
                    name: '',
                    role: ROLES.WAREHOUSE_MANAGER,
                    permissions: ['dashboard', 'new_shipment', 'pool']
                });
                alert('Kullanıcı eklendi!');
            } catch (error) {
                alert('Kullanıcı eklenirken hata oluştu!');
            }
        } else {
            alert('Lütfen tüm alanları doldurun ve en az bir yetki seçin!');
        }
    };

    // --- Main Render ---

    if (!currentUser) return null; // Prevent flash of content

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                currentView={currentView}
                setView={setCurrentView}
                currentUser={currentUser}
            />

            {/* Header */}
            <header className="h-16 bg-white border-b flex items-center px-6 justify-between shrink-0 z-30 relative shadow-sm">
                <div className="flex items-center gap-4 z-50">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative z-50">
                        <Menu size={24} className="text-gray-600" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">
                        {currentView === 'dashboard' && 'Genel Bakış'}
                        {currentView === 'new_shipment' && 'Yeni Sevkiyat Girişi'}
                        {currentView === 'pool' && 'Sevkiyat Havuzu'}
                        {currentView === 'approval' && 'Onay Bekleyenler'}
                        {currentView === 'vehicle_management' && 'Araç Yönetimi'}
                        {currentView === 'user_management' && 'Kullanıcı Yönetimi'}
                    </h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-bold text-slate-700">{currentUser.name}</span>
                        <span className="text-xs text-slate-500 uppercase">{ROLE_LABELS[currentUser.role] || currentUser.role}</span>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                        {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                    </div>
                </div>
            </header>

            {/* Main Content Area (Split View) */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Left Panel (Content) - Width varies based on view */}
                <div
                    className={`transition-all duration-300 ease-in-out h-full flex-shrink-0 ${currentView === 'dashboard' ? 'w-0' : 'w-full md:w-[400px] lg:w-[450px]'}`}
                    style={{ overflow: 'hidden' }} // Hide content when width is 0
                >
                    <div className="w-full h-full" style={{ width: currentView === 'dashboard' ? '0' : '100%' }}>
                        {renderContentPanel()}
                    </div>
                </div>

                {/* Right Panel (Map) - Always Visible */}
                <div className="flex-1 relative h-full bg-slate-200">
                    <Map
                        vehicles={vehicles}
                        onMapClick={handleMapClick}
                        selectedLocation={selectedLocation}
                        pendingOrders={pendingOrders}
                    />

                    {/* Dashboard Overlay: Vehicle Status Bar */}
                    {currentView === 'dashboard' && (
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t p-4 z-[1000] overflow-x-auto">
                            <div className="flex gap-4 min-w-max">
                                {vehicles.map(v => (
                                    <div key={v.id} className="w-64 bg-white rounded-lg shadow-sm border p-3 text-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-slate-800">{v.name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.currentLoad > v.capacity ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {v.status === 'moving' ? 'Hareket' : 'Duruyor'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                            <div
                                                className={`h-2 rounded-full ${v.currentLoad > v.capacity ? 'bg-red-500' : 'bg-blue-500'}`}
                                                style={{ width: `${Math.min((v.currentLoad / v.capacity) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>{v.currentLoad}/{v.capacity} kg</span>
                                            <span>Hedef: {v.nextStop}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}

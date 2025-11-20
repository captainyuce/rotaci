export const ROLES = {
    BOSS: 'boss',
    ADMIN: 'admin',
    WAREHOUSE_MANAGER: 'warehouse_manager',
    SHIPMENT_MANAGER: 'shipment_manager',
    PURCHASING: 'purchasing',
    MARKETING: 'marketing',
    PRODUCTION: 'production',
    SUBCONTRACTOR: 'subcontractor',
    DRIVER: 'driver'
};

export const ROLE_LABELS = {
    [ROLES.BOSS]: 'Patron (Boss)',
    [ROLES.ADMIN]: 'Yönetici (Admin)',
    [ROLES.WAREHOUSE_MANAGER]: 'Depo Sorumlusu',
    [ROLES.SHIPMENT_MANAGER]: 'Sevkiyat Sorumlusu',
    [ROLES.PURCHASING]: 'Satınalmacı',
    [ROLES.MARKETING]: 'Pazarlamacı',
    [ROLES.PRODUCTION]: 'Üretim Sorumlusu',
    [ROLES.SUBCONTRACTOR]: 'Fason Takipçi',
    [ROLES.DRIVER]: 'Sürücü'
};

export const MENU_ITEMS = [
    { id: 'dashboard', label: 'Genel Bakış' },
    { id: 'new_shipment', label: 'Yeni Sevkiyat Girişi' },
    { id: 'pool', label: 'Sevkiyat Havuzu' },
    { id: 'approval', label: 'Onay Bekleyenler' },
    { id: 'vehicle_management', label: 'Araç Yönetimi' },
    { id: 'user_management', label: 'Kullanıcı Yönetimi' },
];

export const SPECIAL_PERMISSIONS = [
    { id: 'can_assign_shipments', label: '📦 Sevkiyat Atama Yetkisi' },
    { id: 'can_approve_shipments', label: '✅ Sevkiyat Onaylama Yetkisi' },
];

export const initialUsers = [
    {
        username: 'akalbatu',
        password: '123',
        role: ROLES.ADMIN,
        name: 'Admin',
        permissions: ['dashboard', 'new_shipment', 'pool', 'approval', 'vehicle_management', 'user_management', 'can_assign_shipments', 'can_approve_shipments'] // Full access
    }
];

export const initialVehicles = [
    {
        id: 1,
        name: 'Araç 1 (34 ABC 123)',
        driver: 'Ahmet Yılmaz',
        status: 'idle', // moving, stopped, idle
        location: [41.0082, 28.9784], // Istanbul
        route: [],
        nextStop: '-',
        battery: 100,
        capacity: 1000, // kg
        currentLoad: 0, // kg - SIFIRLANMIŞ
        type: 'truck',
        restrictions: []
    },
    {
        id: 2,
        name: 'Araç 2 (34 XYZ 789)',
        driver: 'Mehmet Demir',
        status: 'idle',
        location: [40.9882, 29.0284], // Kadikoy
        route: [],
        nextStop: '-',
        battery: 100,
        capacity: 1200, // kg
        currentLoad: 0, // kg - SIFIRLANMIŞ
        type: 'van',
        restrictions: []
    },
    {
        id: 3,
        name: 'Araç 3 (34 KL 456)',
        driver: 'Ayşe Kaya',
        status: 'idle',
        location: [41.0382, 28.9884], // Taksim
        route: [],
        nextStop: '-',
        battery: 100,
        capacity: 800, // kg
        currentLoad: 0, // kg - SIFIRLANMIŞ
        type: 'van',
        restrictions: []
    }
];

export const currentUser = {
    role: ROLES.WAREHOUSE_MANAGER,
    name: 'Depo Sorumlusu'
}

export const initialOrders = [];

export const initialPendingOrders = [];

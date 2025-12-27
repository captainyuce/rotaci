// Permission constants
export const PERMISSIONS = {
    VIEW: 'view',
    CREATE_SHIPMENTS: 'create_shipments',
    EDIT_SHIPMENTS: 'edit_shipments',
    DELETE_SHIPMENTS: 'delete_shipments',
    ASSIGN_VEHICLES: 'assign_vehicles',
    MANAGE_ADDRESSES: 'manage_addresses',
    MANAGE_USERS: 'manage_users',
    MANAGE_VEHICLES: 'manage_vehicles',
    VIEW_LOGS: 'view_logs',
    MANAGE_SETTINGS: 'manage_settings',
    MANAGE_CHAT: 'manage_chat',
    CLEAR_LOGS: 'clear_logs',
    PREPARE_SHIPMENTS: 'prepare_shipments',
    OVERRIDE_PREPARATION: 'override_preparation'
}

// Predefined roles with their permissions
export const ROLES = {
    ADMIN: {
        name: 'Admin',
        label: 'Yönetici',
        permissions: Object.values(PERMISSIONS)
    },
    MANAGER: {
        name: 'Manager',
        label: 'Müdür',
        permissions: [
            PERMISSIONS.VIEW,
            PERMISSIONS.CREATE_SHIPMENTS,
            PERMISSIONS.EDIT_SHIPMENTS,
            PERMISSIONS.DELETE_SHIPMENTS,
            PERMISSIONS.MANAGE_ADDRESSES,
            PERMISSIONS.MANAGE_VEHICLES,
            PERMISSIONS.MANAGE_SETTINGS,
            PERMISSIONS.MANAGE_CHAT,
            PERMISSIONS.PREPARE_SHIPMENTS,
            PERMISSIONS.OVERRIDE_PREPARATION
        ]
    },
    DISPATCHER: {
        name: 'Dispatcher',
        label: 'Atama Sorumlusu',
        permissions: [
            PERMISSIONS.VIEW,
            PERMISSIONS.ASSIGN_VEHICLES
        ]
    },
    WORKER: {
        name: 'Worker',
        label: 'Çalışan (Depo)',
        permissions: [
            PERMISSIONS.VIEW,
            PERMISSIONS.PREPARE_SHIPMENTS
        ]
    },
    VIEWER: {
        name: 'Viewer',
        label: 'Görüntüleyici',
        permissions: [PERMISSIONS.VIEW]
    }
}

// Permission labels for UI
export const PERMISSION_LABELS = {
    [PERMISSIONS.VIEW]: 'Görüntüleme',
    [PERMISSIONS.CREATE_SHIPMENTS]: 'Sevkiyat Ekleme',
    [PERMISSIONS.EDIT_SHIPMENTS]: 'Sevkiyat Düzenleme',
    [PERMISSIONS.DELETE_SHIPMENTS]: 'Sevkiyat Silme',
    [PERMISSIONS.ASSIGN_VEHICLES]: 'Araç Atama',
    [PERMISSIONS.MANAGE_ADDRESSES]: 'Adres Yönetimi',
    [PERMISSIONS.MANAGE_USERS]: 'Kullanıcı Yönetimi',
    [PERMISSIONS.MANAGE_VEHICLES]: 'Araç Yönetimi',
    [PERMISSIONS.VIEW_LOGS]: 'İşlem Geçmişi Görüntüleme',
    [PERMISSIONS.MANAGE_SETTINGS]: 'Sistem Ayarları',
    [PERMISSIONS.MANAGE_CHAT]: 'Sohbet Yönetimi',
    [PERMISSIONS.CLEAR_LOGS]: 'Log Temizleme',
    [PERMISSIONS.PREPARE_SHIPMENTS]: 'Sevkiyat Hazırlama'
}

// Check if user has a specific permission
export function hasPermission(userPermissions, permission) {
    if (!userPermissions || !Array.isArray(userPermissions)) {
        return false
    }
    return userPermissions.includes(permission)
}

// Check if user has any of the specified permissions
export function hasAnyPermission(userPermissions, permissions) {
    if (!userPermissions || !Array.isArray(userPermissions)) {
        return false
    }
    return permissions.some(permission => userPermissions.includes(permission))
}

// Check if user has all of the specified permissions
export function hasAllPermissions(userPermissions, permissions) {
    if (!userPermissions || !Array.isArray(userPermissions)) {
        return false
    }
    return permissions.every(permission => userPermissions.includes(permission))
}

// Get role by permissions (find matching predefined role)
export function getRoleByPermissions(permissions) {
    if (!permissions || !Array.isArray(permissions)) {
        return null
    }

    for (const [key, role] of Object.entries(ROLES)) {
        const rolePerms = [...role.permissions].sort()
        const userPerms = [...permissions].sort()

        if (JSON.stringify(rolePerms) === JSON.stringify(userPerms)) {
            return { key, ...role }
        }
    }

    return { key: 'CUSTOM', name: 'Custom', label: 'Özel', permissions }
}

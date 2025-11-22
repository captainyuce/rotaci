import { Menu, X, Truck, Package, ClipboardList, Settings, LogOut, User } from 'lucide-react'
import { ROLES, ROLE_LABELS } from '@/lib/data'

export default function Sidebar({ isOpen, onClose, currentView, setView, currentUser }) {
    const menuItems = [
        {
            id: 'dashboard',
            label: 'Genel Bakış',
            icon: <Truck size={20} />,
            roles: [ROLES.BOSS, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SHIPMENT_MANAGER, ROLES.PURCHASING, ROLES.MARKETING, ROLES.PRODUCTION, ROLES.SUBCONTRACTOR]
        },
        {
            id: 'new_shipment',
            label: 'Yeni Sevkiyat Girişi',
            icon: <Package size={20} />,
            roles: [ROLES.BOSS, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SHIPMENT_MANAGER]
        },
        {
            id: 'pool',
            label: 'Sevkiyat Havuzu',
            icon: <ClipboardList size={20} />,
            roles: [ROLES.BOSS, ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.SHIPMENT_MANAGER, ROLES.PRODUCTION]
        },
        {
            id: 'approval',
            label: 'Onay Bekleyenler',
            icon: <Settings size={20} />,
            roles: [ROLES.BOSS, ROLES.ADMIN]
        },
        {
            id: 'vehicle_management',
            label: 'Araç Yönetimi',
            icon: <Truck size={20} />,
            roles: [ROLES.BOSS, ROLES.ADMIN]
        },
        {
            id: 'user_management',
            label: 'Kullanıcı Yönetimi',
            icon: <User size={20} />,
            roles: [ROLES.BOSS, ROLES.ADMIN]
        },
    ]

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2999 }}
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '280px',
                background: 'white',
                zIndex: 3000,
                transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--border)'
            }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <img src="/akalbatu-logo.png" alt="Akalbatu" style={{ height: '32px' }} />
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ background: '#e2e8f0', padding: '0.5rem', borderRadius: '50%' }}>
                            <User size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{currentUser.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>{ROLE_LABELS[currentUser.role] || currentUser.role}</div>
                        </div>
                    </div>
                </div>

                <nav style={{ flex: 1, padding: '1rem' }}>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {menuItems.map(item => {
                            // Check if user has permission for this menu item
                            const hasPermission = currentUser.permissions && currentUser.permissions.includes(item.id);
                            if (!hasPermission) return null;

                            const isActive = currentView === item.id;
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => {
                                            setView(item.id);
                                            onClose();
                                        }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            borderRadius: '0.5rem',
                                            background: isActive ? '#eff6ff' : 'transparent',
                                            color: isActive ? '#1e40af' : '#475569',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            fontWeight: isActive ? '600' : 'normal'
                                        }}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                    <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ef4444', textDecoration: 'none', padding: '0.5rem' }}>
                        <LogOut size={20} />
                        Çıkış Yap
                    </a>
                </div>
            </div>
        </>
    )
}

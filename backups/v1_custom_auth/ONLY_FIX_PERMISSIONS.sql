-- BU DOSYADA SADECE IZIN DUZELTME KOMUTU VARDIR
-- Lutfen Supabase SQL Editor'deki HER SEYI SILIN ve sadece bunu yapistirin.

UPDATE users
SET permissions = ARRAY[
    'view',
    'create_shipments',
    'edit_shipments',
    'delete_shipments',
    'assign_vehicles',
    'manage_vehicles',
    'manage_addresses',
    'manage_users',
    'view_logs'
]
WHERE username = 'admin';

-- Guncelleme kontrolu (bunu calistirdiginizda admin kullanicisini ve izinlerini gormelisiniz)
SELECT username, permissions FROM users WHERE username = 'admin';

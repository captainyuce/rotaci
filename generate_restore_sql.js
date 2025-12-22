const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function run() {
    const envPath = path.resolve('.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: logs, error } = await supabase.from('shipment_logs').select('shipment_data').not('shipment_data', 'is', null);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    const shipments = new Map();
    const addresses = new Map();

    logs.forEach(log => {
        const s = log.shipment_data;
        if (!s || !s.id) return;
        shipments.set(s.id, s);
        if (s.delivery_address && s.delivery_lat) {
            addresses.set(s.delivery_address, { name: s.customer_name, address: s.delivery_address, lat: s.delivery_lat, lng: s.delivery_lng });
        }
    });

    let sql = '-- Data Restoration Script\n\n';

    sql += '-- 1. Restore Vehicles\n';
    const defaultVehicles = [
        { id: 'b2d75c67-ae73-46ab-88fa-0d1f4e11c9a8', plate: '34 KL 1234', driver_name: 'Ahmet Yılmaz', driver_password: '1234', capacity: 1500 },
        { id: '7710298a-2718-465b-9a0e-72344ad00ece', plate: '34 AB 5678', driver_name: 'Mehmet Demir', driver_password: '1234', capacity: 1300 },
        { id: 'cd70bd3a-1111-2222-3333-444444444444', plate: '34 CD 9012', driver_name: 'Ayşe Kaya', driver_password: '1234', capacity: 1400 }
    ];
    defaultVehicles.forEach(v => {
        sql += `INSERT INTO vehicles (id, plate, driver_name, driver_password, capacity) VALUES ('${v.id}', '${v.plate}', '${v.driver_name}', '${v.driver_password}', ${v.capacity}) ON CONFLICT (id) DO NOTHING;\n`;
    });

    sql += '\n-- 2. Restore Addresses\n';
    Array.from(addresses.values()).forEach(a => {
        sql += `INSERT INTO addresses (name, address, lat, lng) VALUES ('${(a.name || 'Müşteri').replace(/'/g, "''")}', '${a.address.replace(/'/g, "''")}', ${a.lat}, ${a.lng}) ON CONFLICT DO NOTHING;\n`;
    });

    sql += '\n-- 3. Restore Shipments\n';
    Array.from(shipments.values()).forEach(s => {
        const fields = [];
        const values = [];
        Object.entries(s).forEach(([k, v]) => {
            if (v === null) return;
            fields.push(k);
            if (typeof v === 'string') values.push("'" + v.replace(/'/g, "''") + "'");
            else if (typeof v === 'object') values.push("'" + JSON.stringify(v).replace(/'/g, "''") + "'");
            else values.push(v);
        });
        sql += `INSERT INTO shipments (${fields.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO NOTHING;\n`;
    });

    fs.writeFileSync('full_restore.sql', sql);
    console.log('✅ full_restore.sql generated with ' + shipments.size + ' shipments.');
}
run();

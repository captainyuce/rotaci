const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function restore() {
    console.log('Fetching shipment logs...');
    const { data: logs, error: logsError } = await supabase
        .from('shipment_logs')
        .select('shipment_data')
        .not('shipment_data', 'is', null);

    if (logsError) {
        console.error('Error fetching logs:', logsError);
        return;
    }

    console.log(`Found ${logs.length} logs with data.`);

    const shipmentsMap = new Map();
    const addressesMap = new Map();
    const vehicleIds = new Set();

    logs.forEach(log => {
        const s = log.shipment_data;
        if (!s || !s.id) return;

        // Keep the latest version of the shipment (logs are usually ordered by created_at, but we'll just overwrite)
        shipmentsMap.set(s.id, s);

        if (s.delivery_address && s.delivery_lat && s.delivery_lng) {
            const addrKey = `${s.delivery_lat}_${s.delivery_lng}`;
            addressesMap.set(addrKey, {
                name: s.customer_name || 'Müşteri',
                address: s.delivery_address,
                lat: s.delivery_lat,
                lng: s.delivery_lng,
                category: 'customer'
            });
        }

        if (s.assigned_vehicle_id) {
            vehicleIds.add(s.assigned_vehicle_id);
        }
    });

    console.log(`Unique shipments to restore: ${shipmentsMap.size}`);
    console.log(`Unique addresses to restore: ${addressesMap.size}`);
    console.log(`Vehicle IDs found: ${vehicleIds.size}`);

    // 1. Restore Addresses
    if (addressesMap.size > 0) {
        console.log('Restoring addresses...');
        const addresses = Array.from(addressesMap.values());
        // Just insert and ignore duplicates if constraint exists, or let it insert if not
        const { error: addrError } = await supabase.from('addresses').upsert(addresses);
        if (addrError) console.error('Error restoring addresses:', addrError);
        else console.log('✅ Addresses restored.');
    }

    // 2. Restore Vehicles
    const defaultVehicles = [
        { id: 'b2d75c67-ae73-46ab-88fa-0d1f4e11c9a8', plate: '34 KL 1234', driver_name: 'Ahmet Yılmaz', driver_password: '1234', capacity: 1500, current_lat: 41.0082, current_lng: 28.9784 },
        { id: '7710298a-2718-465b-9a0e-72344ad00ece', plate: '34 AB 5678', driver_name: 'Mehmet Demir', driver_password: '1234', capacity: 1300, current_lat: 41.0082, current_lng: 28.9784 },
        { id: 'cd70bd3a-1111-2222-3333-444444444444', plate: '34 CD 9012', driver_name: 'Ayşe Kaya', driver_password: '1234', capacity: 1400, current_lat: 41.0082, current_lng: 28.9784 }
    ];

    console.log('Restoring vehicles...');
    const { error: vehError } = await supabase.from('vehicles').upsert(defaultVehicles);
    if (vehError) console.error('Error restoring vehicles:', vehError);
    else console.log('✅ Vehicles restored.');

    // 3. Restore Shipments
    if (shipmentsMap.size > 0) {
        console.log('Restoring shipments...');
        const shipments = Array.from(shipmentsMap.values()).map(s => {
            // Remove fields that might cause issues or are not in the schema
            const { shipment_data, ...rest } = s;
            return rest;
        });

        // Batch insert to avoid payload limits
        const batchSize = 50;
        for (let i = 0; i < shipments.length; i += batchSize) {
            const batch = shipments.slice(i, i + batchSize);
            const { error: shipError } = await supabase.from('shipments').upsert(batch);
            if (shipError) console.error(`Error restoring shipment batch ${i}:`, shipError);
        }
        console.log('✅ Shipments restored.');
    }

    console.log('Restoration complete!');
}

restore();

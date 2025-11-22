
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
    console.error('Error: Could not read Supabase credentials from .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const initialVehicles = [
    { id: 1, plate: '34 KL 1234', name: 'Ford Transit', capacity: 1500, current_load: 0, status: 'idle', location: { lat: 41.0082, lng: 28.9784 }, route: [], route_segments: [] },
    { id: 2, plate: '34 AB 5678', name: 'Fiat Ducato', capacity: 1300, current_load: 0, status: 'idle', location: { lat: 41.0082, lng: 28.9784 }, route: [], route_segments: [] },
    { id: 3, plate: '34 CD 9012', name: 'Renault Master', capacity: 1400, current_load: 0, status: 'idle', location: { lat: 41.0082, lng: 28.9784 }, route: [], route_segments: [] }
];

async function seed() {
    console.log('Seeding vehicles...');

    // Check if vehicles exist
    const { data: existingVehicles, error: checkError } = await supabase.from('vehicles').select('id');
    if (checkError) {
        console.error('Error checking vehicles:', checkError);
        return;
    }

    if (existingVehicles && existingVehicles.length > 0) {
        console.log('Vehicles already exist. Skipping seed.');
    } else {
        // Note: id is serial, so we let Supabase generate it or force it if we want specific IDs.
        // Since we use integer IDs in our app logic (sometimes), let's be careful.
        // The initialVehicles have IDs 1, 2, 3.
        const { error } = await supabase.from('vehicles').insert(initialVehicles);
        if (error) {
            console.error('Error inserting vehicles:', error);
        } else {
            console.log('✅ Vehicles seeded successfully!');
        }
    }
}

seed();

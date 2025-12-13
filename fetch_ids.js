const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: vehicles } = await supabase.from('vehicles').select('id, plate').limit(1);
    const { data: shipments } = await supabase.from('shipments').select('id').limit(2);

    if (vehicles && vehicles.length > 0 && shipments && shipments.length > 0) {
        console.log('Vehicle ID:', vehicles[0].id);
        console.log('Shipment IDs:', shipments.map(s => s.id));

        // Also check settings
        const { data: settings } = await supabase.from('settings').select('*').eq('key', 'base_address');
        console.log('Settings:', settings);
    } else {
        console.log('No data found');
    }
}

main();


const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchVehicles() {
    const { data, error } = await supabase
        .from('vehicles')
        .select('plate, driver_password')
        .limit(5);

    if (error) {
        console.error('Error fetching vehicles:', error);
        return;
    }

    console.log('Vehicles:', data);
}

fetchVehicles();

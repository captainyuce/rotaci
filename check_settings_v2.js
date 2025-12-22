
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ghiiegwkebssocrhrecc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaWllZ3drZWJzc29jcmhyZWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODY1NDIsImV4cCI6MjA3OTQ2MjU0Mn0.p5zLSllhgWyF_61K_mlxgZJhbrmDar-nif7GdbWswWg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'base_address');

    if (error) {
        console.error('Error fetching settings:', error);
    } else {
        console.log('Settings found:', JSON.stringify(data, null, 2));
    }
}

checkSettings();

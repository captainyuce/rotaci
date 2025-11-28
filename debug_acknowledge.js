// Test script to check if acknowledged_at field exists
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  console.log('Testing acknowledged_at field...')
  
  // Get a shipment
  const { data: shipments } = await supabase
    .from('shipments')
    .select('*')
    .limit(1)
  
  if (shipments && shipments.length > 0) {
    console.log('Sample shipment:', shipments[0])
    console.log('Has acknowledged_at field?', 'acknowledged_at' in shipments[0])
  }
}

test()

import { optimizeRoute } from './src/lib/routeOptimizer.js';

const vehicleLocation = { lat: 41.0082, lng: 28.9784 };
const shipments = [
    {
        id: 'test-1',
        customer_name: 'Test Customer',
        delivery_address: 'Test Address',
        delivery_lat: 41.0422,
        delivery_lng: 29.0097,
        weight: 10
    }
];
const options = {
    endLocation: { lat: 41.0082, lng: 28.9784 },
    keepOrder: true
};

async function test() {
    try {
        console.log('Testing optimizeRoute with 1 shipment and endLocation...');
        const result = await optimizeRoute(vehicleLocation, shipments, options);
        console.log('Result optimizedShipments length:', result.optimizedShipments.length);
        console.log('Result routes length:', result.routes.length);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();

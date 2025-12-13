import { optimizeRoute } from './src/lib/routeOptimizer.js';

const vehicleLocation = { lat: 41.0082, lng: 28.9784 };
const shipments = [
    { id: '1', delivery_lat: 41.0100, delivery_lng: 28.9800, delivery_time: null },
    { id: '2', delivery_lat: 41.0200, delivery_lng: 28.9900, delivery_time: null }
];
const options = {
    departureTime: new Date().toISOString(),
    bridgePreference: 'any',
    endLocation: { lat: 41.0237631877135, lng: 28.91381621360779 } // Depot
};

async function run() {
    console.log('Running optimization test...');
    try {
        const result = await optimizeRoute(vehicleLocation, shipments, options);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

run();

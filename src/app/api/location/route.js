import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// Store driver locations in memory
let driverLocations = {};

export async function GET() {
    // Return all driver locations
    return NextResponse.json(driverLocations);
}

export async function POST(request) {
    try {
        const { driverId, location, heading, speed } = await request.json();

        // Update driver location
        driverLocations[driverId] = {
            location,
            heading: heading || 0,
            speed: speed || 0,
            timestamp: Date.now()
        };

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

// Clean up old locations (older than 5 minutes)
setInterval(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    Object.keys(driverLocations).forEach(driverId => {
        if (driverLocations[driverId].timestamp < fiveMinutesAgo) {
            delete driverLocations[driverId];
        }
    });
}, 60000); // Run every minute

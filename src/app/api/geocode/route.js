import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        console.log('Geocoding request for:', q);
        const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&countrycodes=tr&limit=5';
        console.log('Fetching from:', url);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Rotaci/1.0 (contact@example.com)'
            }
        });

        console.log('Nominatim response status:', response.status);

        if (!response.ok) {
            throw new Error(`Nominatim API returned status ${response.status}`);
        }

        const data = await response.json();
        console.log('Geocoding results:', data.length, 'locations found');
        return NextResponse.json(data);
    } catch (error) {
        console.error('Geocoding API error:', error);
        return NextResponse.json({ error: 'Geocoding failed', details: error.message }, { status: 500 });
    }
}

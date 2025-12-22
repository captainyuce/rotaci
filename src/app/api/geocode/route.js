import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`, {
            headers: {
                'User-Agent': 'Rotaci/1.0 (contact@example.com)'
            }
        });
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Geocoding API error:', error);
        return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
    }
}

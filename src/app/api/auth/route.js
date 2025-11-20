import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function POST(request) {
    try {
        const { username, password } = await request.json();
        const db = getDB();

        const user = db.users.find(u => u.username === username && u.password === password);

        if (user) {
            return NextResponse.json({ success: true, user });
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

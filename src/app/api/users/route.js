import { NextResponse } from 'next/server';
import { getDB, initializeDB } from '@/lib/db';
import { initialUsers } from '@/lib/data';

// Initialize DB with default users
initializeDB({ users: initialUsers });

export async function GET() {
    const db = getDB();
    return NextResponse.json(db.users);
}

export async function POST(request) {
    try {
        const newUser = await request.json();
        const db = getDB();

        // Add ID if not present
        if (!newUser.id) {
            newUser.id = Date.now();
        }

        db.users.push(newUser);
        return NextResponse.json(newUser, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

export async function PUT(request) {
    try {
        const updatedUser = await request.json();
        const db = getDB();

        const index = db.users.findIndex(u => u.id === updatedUser.id);
        if (index !== -1) {
            db.users[index] = updatedUser;
            return NextResponse.json(updatedUser);
        }

        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get('id'));
        const db = getDB();

        db.users = db.users.filter(u => u.id !== id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

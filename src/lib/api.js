// API helper functions

export async function getUsers() {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

export async function addUser(user) {
    const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to add user');
    return res.json();
}

export async function updateUser(user) {
    const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
}

export async function deleteUser(id) {
    const res = await fetch(`/api/users?id=${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
}

export async function login(username, password) {
    const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
}

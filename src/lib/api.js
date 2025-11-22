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

// Shipments API
export async function getShipments() {
    const res = await fetch('/api/shipments');
    if (!res.ok) throw new Error('Failed to fetch shipments');
    return res.json();
}

export async function addShipment(shipment) {
    const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipment)
    });
    if (!res.ok) throw new Error('Failed to add shipment');
    return res.json();
}

export async function updateShipment(shipment) {
    const res = await fetch('/api/shipments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipment)
    });
    if (!res.ok) throw new Error('Failed to update shipment');
    return res.json();
}

// Vehicles API
export async function getVehicles() {
    const res = await fetch('/api/vehicles');
    if (!res.ok) throw new Error('Failed to fetch vehicles');
    return res.json();
}

export async function updateVehicle(vehicle) {
    const res = await fetch('/api/vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicle)
    });
    if (!res.ok) throw new Error('Failed to update vehicle');
    return res.json();
}

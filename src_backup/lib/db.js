// Simple in-memory database (will be replaced with persistent storage later)
// For now, this will reset on server restart, but it's a starting point

let db = {
    users: [],
    shipments: [],
    vehicles: []
};

export function getDB() {
    return db;
}

export function setDB(newDB) {
    db = newDB;
}

export function initializeDB(initialData) {
    if (db.users.length === 0 && initialData.users) {
        db.users = initialData.users;
    }
    if (db.vehicles.length === 0 && initialData.vehicles) {
        db.vehicles = initialData.vehicles;
    }
    if (db.shipments.length === 0 && initialData.shipments) {
        db.shipments = initialData.shipments;
    }
}

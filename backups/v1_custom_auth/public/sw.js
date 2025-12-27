// Service Worker for Push Notifications
// This runs in the background even when the app is closed

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installed')
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activated')
    event.waitUntil(self.clients.claim())
})

// Listen for push events from server
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push event received', event)

    let data = {}

    if (event.data) {
        try {
            data = event.data.json()
        } catch (e) {
            data = { title: 'Yeni Bildirim', body: event.data.text() }
        }
    }

    const title = data.title || 'Akalbatu'
    const options = {
        body: data.body || 'Yeni bir güncelleme var',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'notification',
        requireInteraction: true,
        data: data.data || {},
        actions: [
            { action: 'open', title: 'Aç' },
            { action: 'close', title: 'Kapat' }
        ]
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
    )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked', event)

    event.notification.close()

    if (event.action === 'close') {
        return
    }

    // Open the app when notification is clicked
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes('/driver') && 'focus' in client) {
                        return client.focus()
                    }
                }

                // Otherwise open new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow('/driver')
                }
            })
    )
})

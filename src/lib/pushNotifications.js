/**
 * Push Notification Utilities
 * Handles Web Push API for driver notifications
 */

// Check if push notifications are supported
export function isPushNotificationSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window
}

// Request notification permission
export async function requestNotificationPermission() {
    if (!isPushNotificationSupported()) {
        console.error('Push notifications not supported')
        return false
    }

    try {
        const permission = await Notification.requestPermission()
        return permission === 'granted'
    } catch (error) {
        console.error('Error requesting notification permission:', error)
        return false
    }
}

// Register Service Worker
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported')
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        })

        console.log('Service Worker registered:', registration)

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready

        return registration
    } catch (error) {
        console.error('Service Worker registration failed:', error)
        throw error
    }
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(userId) {
    try {
        // Register service worker first
        const registration = await registerServiceWorker()

        // Request permission
        const permissionGranted = await requestNotificationPermission()
        if (!permissionGranted) {
            throw new Error('Notification permission denied')
        }

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey())
        })

        console.log('Push subscription:', subscription)

        // Save subscription to database
        // If userId is provided, save to profiles (Manager/Worker)
        // If not, it might be a driver vehicle update (handled separately usually, but let's support it)
        if (userId) {
            const { supabase } = await import('@/lib/supabaseClient')

            const { error } = await supabase
                .from('profiles')
                .update({ push_subscription: subscription })
                .eq('id', userId)

            if (error) {
                console.error('Error saving subscription to profile:', error)
                // Don't throw, just log. Subscription is valid locally.
            }
        }

        return subscription
    } catch (error) {
        console.error('Error subscribing to push notifications:', error)
        throw error
    }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications() {
    try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
            await subscription.unsubscribe()
            console.log('Unsubscribed from push notifications')
            return true
        }

        return false
    } catch (error) {
        console.error('Error unsubscribing from push notifications:', error)
        return false
    }
}

// Get current push subscription
export async function getPushSubscription() {
    try {
        const registration = await navigator.serviceWorker.ready
        return await registration.pushManager.getSubscription()
    } catch (error) {
        console.error('Error getting push subscription:', error)
        return null
    }
}

// VAPID public key (you'll need to generate this)
// For now, using a placeholder - in production, generate real VAPID keys
function getVapidPublicKey() {
    // This is a placeholder - you need to generate real VAPID keys
    // Use: npx web-push generate-vapid-keys
    return 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
}

// Send a test notification
export async function sendTestNotification() {
    if (!isPushNotificationSupported()) {
        alert('Push notifications not supported')
        return
    }

    const permission = await requestNotificationPermission()
    if (!permission) {
        alert('Notification permission denied')
        return
    }

    new Notification('Test Notification', {
        body: 'This is a test notification from Akalbatu',
        icon: '/icon-192.png',
        vibrate: [200, 100, 200]
    })
}

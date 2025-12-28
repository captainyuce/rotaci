import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import webpush from 'web-push'

// Configure web-push with VAPID keys
// In production, store these in environment variables
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const VAPID_PRIVATE_KEY = 'UUxE4puxxJykA6UBXdaaoq6L2Jcqgjj0VJSFzKFNnQ'

export async function POST(request) {
    webpush.setVapidDetails(
        'mailto:support@akalbatu.com',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    )

    try {
        const { vehicleId, targetRoles, title, body, data } = await request.json()

        const subscriptions = []

        // 1. If vehicleId provided, get driver subscription
        if (vehicleId) {
            const { data: vehicle } = await supabase
                .from('vehicles')
                .select('push_subscription')
                .eq('id', vehicleId)
                .single()

            if (vehicle?.push_subscription) {
                subscriptions.push(vehicle.push_subscription)
            }
        }

        // 2. If targetRoles provided (e.g. ['manager', 'dispatcher']), get their subscriptions
        if (targetRoles && targetRoles.length > 0) {
            // Use supabaseAdmin to bypass RLS if needed, or just supabase if RLS allows reading profiles
            // Since this is an API route, we should probably use supabaseAdmin for reliability
            const { supabaseAdmin } = await import('@/lib/supabaseAdmin')
            const client = supabaseAdmin || supabase

            const { data: profiles } = await client
                .from('profiles')
                .select('push_subscription')
                .in('role', targetRoles)
                .not('push_subscription', 'is', null)

            if (profiles) {
                profiles.forEach(p => {
                    if (p.push_subscription) subscriptions.push(p.push_subscription)
                })
            }
        }

        if (subscriptions.length === 0) {
            return NextResponse.json({ message: 'No subscriptions found to send to' })
        }

        // Prepare payload
        const payload = JSON.stringify({
            title: title || 'Akalbatu',
            body: body || 'Yeni bir bildirim var',
            data: data || {},
            tag: 'shipment-notification',
            icon: '/icon-192.png',
            badge: '/icon-192.png'
        })

        // Send to all
        const results = await Promise.allSettled(
            subscriptions.map(sub => webpush.sendNotification(sub, payload))
        )

        const successCount = results.filter(r => r.status === 'fulfilled').length
        console.log(`Notifications sent: ${successCount}/${subscriptions.length}`)

        return NextResponse.json({
            success: true,
            sent: successCount,
            total: subscriptions.length
        })
    } catch (error) {
        console.error('Send notification error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

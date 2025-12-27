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
        const { vehicleId, title, body, data } = await request.json()

        if (!vehicleId) {
            return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 })
        }

        // Get vehicle's push subscription
        const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('push_subscription, plate, driver_name')
            .eq('id', vehicleId)
            .single()

        if (vehicleError || !vehicle) {
            return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
        }

        if (!vehicle.push_subscription) {
            return NextResponse.json({ error: 'No push subscription for this vehicle' }, { status: 400 })
        }

        // Prepare notification payload
        const payload = JSON.stringify({
            title: title || 'Akalbatu',
            body: body || 'Yeni bir bildirim var',
            data: data || {},
            tag: 'shipment-notification'
        })

        // Send push notification
        try {
            await webpush.sendNotification(vehicle.push_subscription, payload)
            console.log('Push notification sent to', vehicle.plate, vehicle.driver_name)

            return NextResponse.json({
                success: true,
                message: 'Notification sent successfully'
            })
        } catch (pushError) {
            console.error('Push notification error:', pushError)

            // If subscription is invalid, remove it from database
            if (pushError.statusCode === 410) {
                await supabase
                    .from('vehicles')
                    .update({ push_subscription: null })
                    .eq('id', vehicleId)
            }

            return NextResponse.json({
                error: 'Failed to send notification',
                details: pushError.message
            }, { status: 500 })
        }
    } catch (error) {
        console.error('Send notification error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

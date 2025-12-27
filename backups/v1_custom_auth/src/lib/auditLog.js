import { supabase } from './supabaseClient'

/**
 * Log a shipment action to the audit trail
 * @param {string} action - 'created', 'updated', or 'deleted'
 * @param {string} shipmentId - UUID of the shipment
 * @param {object} shipmentData - Full shipment data
 * @param {string} userId - UUID of the user performing the action
 * @param {string} userName - Full name of the user
 * @param {object} changes - Optional: Object containing before/after values for updates
 */
export async function logShipmentAction(action, shipmentId, shipmentData, userId, userName, changes = null) {
    console.log('logShipmentAction called with:', { action, shipmentId, shipmentData, userId, userName, changes })

    try {
        const logEntry = {
            shipment_id: shipmentId,
            action,
            user_id: userId,
            user_name: userName,
            shipment_data: shipmentData,
            changes: changes
        }

        console.log('Inserting log entry:', logEntry)

        const { error } = await supabase
            .from('shipment_logs')
            .insert([logEntry])

        if (error) {
            console.error('Error logging shipment action:', error)
        } else {
            console.log('Log entry inserted successfully')
        }
    } catch (err) {
        console.error('Exception in logShipmentAction:', err)
    }
}

/**
 * Get formatted action label in Turkish
 */
export function getActionLabel(action) {
    const labels = {
        created: 'Eklendi',
        updated: 'Düzenlendi',
        deleted: 'Silindi',
        assigned: 'Atandı',
        acknowledged: 'Kabul Edildi',
        delivered: 'Teslim Edildi',
        delivered: 'Teslim Edildi',
        failed: 'Teslim Edilemedi',
        mark_ready: 'Hazırlandı',
        mark_pending: 'Hazırlanacak (Geri Alındı)',
        unauthorized_access: 'Yetkisiz Erişim'
    }
    return labels[action] || action
}

/**
 * Get action color for UI
 */
export function getActionColor(action) {
    const colors = {
        created: 'bg-green-50 text-green-800 border border-green-200',
        updated: 'bg-zinc-50 text-zinc-800 border border-zinc-200',
        deleted: 'bg-red-50 text-red-800 border border-red-200',
        assigned: 'bg-purple-50 text-purple-800 border border-purple-200',
        acknowledged: 'bg-orange-50 text-orange-800 border border-orange-200',
        delivered: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        failed: 'bg-rose-50 text-rose-800 border border-rose-200',
        mark_ready: 'bg-teal-50 text-teal-800 border border-teal-200',
        mark_pending: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
        unauthorized_access: 'bg-red-100 text-red-900 border border-red-300 font-bold'
    }
    return colors[action] || 'bg-slate-50 text-slate-800 border border-slate-200'
}

/**
 * Log a security event (unauthorized access)
 * @param {string} userId - UUID of the user
 * @param {string} userName - Full name of the user
 * @param {string} resource - The resource accessed (e.g., '/dashboard/users')
 * @param {string} details - Additional details
 */
export async function logSecurityEvent(userId, userName, resource, details = '') {
    console.log('logSecurityEvent called:', { userId, userName, resource, details })

    try {
        const logEntry = {
            action: 'unauthorized_access',
            user_id: userId,
            user_name: userName,
            shipment_data: { resource, details }, // Storing resource info in shipment_data for simplicity
            changes: null
        }

        const { error } = await supabase
            .from('shipment_logs')
            .insert([logEntry])

        if (error) {
            console.error('Error logging security event:', error)
        }
    } catch (err) {
        console.error('Exception in logSecurityEvent:', err)
    }
}

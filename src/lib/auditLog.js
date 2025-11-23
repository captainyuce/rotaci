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
    try {
        const logEntry = {
            shipment_id: shipmentId,
            action,
            user_id: userId,
            user_name: userName,
            shipment_data: shipmentData,
            changes: changes
        }

        const { error } = await supabase
            .from('shipment_logs')
            .insert([logEntry])

        if (error) {
            console.error('Error logging shipment action:', error)
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
        deleted: 'Silindi'
    }
    return labels[action] || action
}

/**
 * Get action color for UI
 */
export function getActionColor(action) {
    const colors = {
        created: 'bg-green-50 text-green-800 border border-green-200',
        updated: 'bg-blue-50 text-blue-800 border border-blue-200',
        deleted: 'bg-red-50 text-red-800 border border-red-200'
    }
    return colors[action] || 'bg-slate-50 text-slate-800 border border-slate-200'
}

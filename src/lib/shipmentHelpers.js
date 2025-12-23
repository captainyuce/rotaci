// Helper function to check if a shipment should be hidden based on completion time
export const shouldHideCompletedShipment = (shipment) => {
    // Only apply to completed shipments
    if (shipment.status !== 'delivered' && shipment.status !== 'unloaded') {
        return false
    }

    // Check if delivered_at exists
    if (!shipment.delivered_at) {
        return false
    }

    // Convert UTC delivered_at to Turkey time
    const deliveredDate = new Date(shipment.delivered_at)

    // Get Turkey time (UTC+3)
    const turkeyTime = new Date(deliveredDate.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))

    // Get current Turkey time
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))

    // Check if delivered after 19:00 (7 PM)
    const deliveredHour = turkeyTime.getHours()

    // If delivered after 19:00, hide it
    if (deliveredHour >= 19) {
        return true
    }

    // If delivered before 19:00 but it's now past 19:00 on the same day, hide it
    const isSameDay = turkeyTime.toDateString() === now.toDateString()
    const isAfter7PM = now.getHours() >= 19

    if (isSameDay && isAfter7PM && deliveredHour < 19) {
        return true
    }

    return false
}

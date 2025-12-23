// Helper functions for Turkey Time (UTC+3) handling

/**
 * Get current date in Turkey as YYYY-MM-DD string
 * @returns {string} YYYY-MM-DD
 */
export const getTurkeyDateString = () => {
    const now = new Date()
    return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}

/**
 * Get current time in Turkey as a Date object
 * @returns {Date} Date object representing current Turkey time
 */
export const getTurkeyTime = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
}

/**
 * Convert any date input to Turkey YYYY-MM-DD string
 * @param {string|Date|number} dateInput 
 * @returns {string} YYYY-MM-DD
 */
export const toTurkeyDateString = (dateInput) => {
    if (!dateInput) return null
    const date = new Date(dateInput)
    return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}

/**
 * Get tomorrow's date in Turkey as YYYY-MM-DD string
 * @returns {string} YYYY-MM-DD
 */
export const getTurkeyTomorrowDateString = () => {
    const turkeyTime = getTurkeyTime()
    turkeyTime.setDate(turkeyTime.getDate() + 1)
    return turkeyTime.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}

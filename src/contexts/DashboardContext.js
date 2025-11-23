'use client'

import { createContext, useContext, useState } from 'react'

const DashboardContext = createContext()

export function DashboardProvider({ children }) {
    const [selectedVehicle, setSelectedVehicle] = useState(null)
    const [optimizedRoutes, setOptimizedRoutes] = useState({}) // vehicleId -> route data with geometry

    return (
        <DashboardContext.Provider value={{
            selectedVehicle,
            setSelectedVehicle,
            optimizedRoutes,
            setOptimizedRoutes
        }}>
            {children}
        </DashboardContext.Provider>
    )
}

export function useDashboard() {
    const context = useContext(DashboardContext)
    if (!context) {
        throw new Error('useDashboard must be used within DashboardProvider')
    }
    return context
}

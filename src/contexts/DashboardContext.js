'use client'

import { createContext, useContext, useState } from 'react'

const DashboardContext = createContext()

export function DashboardProvider({ children }) {
    const [selectedVehicle, setSelectedVehicle] = useState(null)
    const [optimizedRoutes, setOptimizedRoutes] = useState({}) // vehicleId -> route data with geometry
    const [calculatingVehicleId, setCalculatingVehicleId] = useState(null)

    const calculateVehicleRoute = async (vehicleId, shipmentIds) => {
        if (!vehicleId || !shipmentIds || shipmentIds.length === 0) return

        setCalculatingVehicleId(vehicleId)
        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId,
                    shipmentIds,
                    departureTime: new Date().toISOString(),
                    keepOrder: true,
                    saveToDb: false
                })
            })

            const data = await response.json()
            if (data.routes && data.routes.length > 0) {
                setOptimizedRoutes(prev => ({
                    ...prev,
                    [vehicleId]: data
                }))
            }
        } catch (err) {
            console.error(`Error calculating route for vehicle ${vehicleId}:`, err)
            alert('Rota hesaplanırken bir hata oluştu.')
        } finally {
            setCalculatingVehicleId(null)
        }
    }

    const hideVehicleRoute = (vehicleId) => {
        setOptimizedRoutes(prev => {
            const newRoutes = { ...prev }
            delete newRoutes[vehicleId]
            return newRoutes
        })
    }

    return (
        <DashboardContext.Provider value={{
            selectedVehicle,
            setSelectedVehicle,
            optimizedRoutes,
            setOptimizedRoutes,
            calculatingVehicleId,
            calculateVehicleRoute,
            hideVehicleRoute
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

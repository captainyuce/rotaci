'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

const DashboardContext = createContext()

export function DashboardProvider({ children }) {
    const [selectedVehicle, setSelectedVehicle] = useState(null)
    const [optimizedRoutes, setOptimizedRoutes] = useState({}) // vehicleId -> route data with geometry
    const [calculatingVehicleId, setCalculatingVehicleId] = useState(null)
    const [hiddenShipments, setHiddenShipments] = useState({}) // { shipmentId: true }
    const [activeRouteDate, setActiveRouteDate] = useState(null) // 'YYYY-MM-DD' or null
    const [depotLocation, setDepotLocation] = useState(null)

    // Fetch depot location on mount
    useEffect(() => {
        const fetchDepot = async () => {
            const { data: settings } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'base_address')
                .single()

            if (settings?.value) {
                try {
                    const parsed = JSON.parse(settings.value)
                    if (parsed.lat && parsed.lng) {
                        setDepotLocation(parsed)
                    }
                } catch (e) {
                    console.error('Error parsing depot location:', e)
                }
            }
        }
        fetchDepot()
    }, [])

    const toggleVisibility = (shipmentId) => {
        console.log('Toggling visibility for:', shipmentId)
        setHiddenShipments(prev => ({
            ...prev,
            [shipmentId]: !prev[shipmentId]
        }))
    }

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
                    saveToDb: false,
                    depotLocation // Pass depot location to API
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

    const value = {
        selectedVehicle,
        setSelectedVehicle,
        optimizedRoutes,
        setOptimizedRoutes,
        calculatingVehicleId,
        calculateVehicleRoute,
        hideVehicleRoute,
        hiddenShipments,
        toggleVisibility,
        activeRouteDate,
        setActiveRouteDate
    }

    return (
        <DashboardContext.Provider value={value}>
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

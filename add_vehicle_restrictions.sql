-- Add bridge preference to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS bridge_preference TEXT DEFAULT 'any';
-- Options: 'any', 'fsm_only' (3rd bridge - Yavuz Sultan Selim), 'bosphorus_only', 'fatih_only'

COMMENT ON COLUMN vehicles.bridge_preference IS 'Bridge preference for route planning: any, fsm_only (Yavuz Sultan Selim - 3rd bridge), bosphorus_only (15 Temmuz/Boğaziçi), fatih_only (Fatih Sultan Mehmet)';

-- Add vehicle restrictions
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS restrictions JSONB DEFAULT '{}';
-- Example: {"avoid_tunnels": true, "max_height": 4.5, "max_weight": 18}

COMMENT ON COLUMN vehicles.restrictions IS 'Vehicle-specific route restrictions in JSON format';

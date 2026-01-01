-- Add columns for Advanced Subcontractor Tracking

-- 1. Product Info (What is being shipped/produced)
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS product_info TEXT;

-- 2. Target Subcontractor (Who is the destination)
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS target_subcontractor_id UUID REFERENCES users(id);

-- 3. Estimated Completion Date (When the subcontractor expects to finish)
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS estimated_completion_date DATE;

-- 4. Parent Shipment ID (To link the production order to the original delivery)
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS parent_shipment_id UUID REFERENCES shipments(id);

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_shipments_target_subcontractor_id ON shipments(target_subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_shipments_parent_shipment_id ON shipments(parent_shipment_id);

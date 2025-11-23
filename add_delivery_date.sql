-- Add delivery_date column to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT CURRENT_DATE;

-- Update existing records to have today's date if null (though default handles new ones)
UPDATE shipments SET delivery_date = CURRENT_DATE WHERE delivery_date IS NULL;

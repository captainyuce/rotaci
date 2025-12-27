-- Create addresses table for managing delivery locations
CREATE TABLE addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  category TEXT NOT NULL CHECK (category IN ('customer', 'supplier', 'subcontractor')),
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for simplicity (matching other tables)
ALTER TABLE addresses DISABLE ROW LEVEL SECURITY;

-- Insert sample addresses for each category
INSERT INTO addresses (name, address, category, latitude, longitude, phone) VALUES
-- Müşteriler (Customers)
('ABC Market', 'Kadıköy Merkez, İstanbul', 'customer', 40.990, 29.020, '+90 216 555 0101'),
('XYZ Süpermarket', 'Beşiktaş Çarşı, İstanbul', 'customer', 41.042, 29.007, '+90 212 555 0102'),
('DEF Mağazası', 'Şişli Center, İstanbul', 'customer', 41.060, 28.987, '+90 212 555 0103'),

-- Tedarikçiler (Suppliers)
('Tedarik A.Ş.', 'Ümraniye Sanayi, İstanbul', 'supplier', 41.020, 29.120, '+90 216 555 0201'),
('Malzeme Ltd.', 'Kartal Organize, İstanbul', 'supplier', 40.910, 29.180, '+90 216 555 0202'),

-- Fasoncular (Subcontractors)
('Fason Üretim', 'Pendik Sanayi, İstanbul', 'subcontractor', 40.880, 29.230, '+90 216 555 0301'),
('Montaj Atölyesi', 'Tuzla Organize, İstanbul', 'subcontractor', 40.820, 29.300, '+90 216 555 0302');

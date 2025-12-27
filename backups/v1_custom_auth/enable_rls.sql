
-- RLS Politikalarını Etkinleştir
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Herkese Açık Erişim Politikaları (Geliştirme aşaması için)
-- Not: Prodüksiyonda daha kısıtlı politikalar kullanılmalıdır.

-- Vehicles
CREATE POLICY "Enable read access for all users" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON vehicles FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON vehicles FOR UPDATE USING (true);

-- Shipments
CREATE POLICY "Enable read access for all users" ON shipments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON shipments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON shipments FOR UPDATE USING (true);

-- Users
CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON users FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON users FOR DELETE USING (true);

-- Driver Locations
CREATE POLICY "Enable read access for all users" ON driver_locations FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON driver_locations FOR INSERT WITH CHECK (true);

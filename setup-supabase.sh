#!/bin/bash

echo "🚀 Supabase Kurulum Scripti"
echo "============================"
echo ""
echo "Lütfen Supabase Dashboard'dan aşağıdaki bilgileri kopyalayın:"
echo ""
echo "1. Tarayıcınızda açık olan sayfada (https://supabase.com/dashboard/project/.../settings/api)"
echo "2. 'Project URL' değerini kopyalayın"
echo ""
read -p "Project URL'yi yapıştırın: " SUPABASE_URL
echo ""
echo "3. 'anon public' key'i kopyalayın (uzun bir string)"
echo ""
read -p "Anon Key'i yapıştırın: " SUPABASE_KEY
echo ""

# .env.local dosyasını oluştur
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF

echo "✅ .env.local dosyası oluşturuldu!"
echo ""
echo "Şimdi Supabase'de SQL tablolarını oluşturalım..."
echo ""
echo "1. Supabase Dashboard'da 'SQL Editor' sekmesine gidin"
echo "2. 'New Query' butonuna tıklayın"
echo "3. Aşağıdaki SQL'i kopyalayıp yapıştırın:"
echo ""
echo "----------------------------------------"
cat << 'SQL'
-- Users tablosu
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İlk admin kullanıcısı
INSERT INTO users (username, password, name, role, permissions)
VALUES ('akalbatu', '123', 'Admin', 'admin', '["dashboard", "new_shipment", "pool", "vehicle_management", "user_management", "can_assign_shipments", "can_approve_shipments"]'::jsonb)
ON CONFLICT (username) DO NOTHING;
SQL
echo "----------------------------------------"
echo ""
read -p "SQL'i çalıştırdınız mı? (y/n): " SQL_DONE

if [ "$SQL_DONE" = "y" ]; then
    echo ""
    echo "🎉 Kurulum tamamlandı!"
    echo ""
    echo "Sonraki adım: Backend entegrasyonu için bana haber verin!"
else
    echo ""
    echo "⚠️  Lütfen SQL'i çalıştırın ve tekrar deneyin."
fi

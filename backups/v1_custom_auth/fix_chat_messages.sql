-- 1. Yönetici Mesajları tablosunu oluştur
CREATE TABLE IF NOT EXISTS manager_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Güvenlik ayarlarını yap (Erişimi aç)
ALTER TABLE manager_messages DISABLE ROW LEVEL SECURITY;

-- 3. Gerçek zamanlı güncellemeleri etkinleştir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'manager_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE manager_messages;
    END IF;
END $$;

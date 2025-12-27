-- Mesajlar tablosunu oluştur
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime'ı etkinleştir
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

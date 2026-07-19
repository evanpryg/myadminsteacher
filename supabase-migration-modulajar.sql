-- ============================================================
-- MIGRATION: Modul Ajar Generator
-- Jalankan di Supabase SQL Editor (sekali saja).
--
-- Alur: form minimal -> AI generate seluruh isi -> simpan riwayat
-- -> download Word (templates/modul-ajar-sma-v1.docx).
-- Tidak ada editor di aplikasi: koreksi langsung di Word.
-- ============================================================

CREATE TABLE IF NOT EXISTS modul_ajar (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    form_data JSONB NOT NULL DEFAULT '{}',
    ai_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE modul_ajar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access on modul_ajar" ON modul_ajar;
CREATE POLICY "Allow anon full access on modul_ajar"
    ON modul_ajar FOR ALL USING (true) WITH CHECK (true);

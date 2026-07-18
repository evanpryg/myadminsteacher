-- ============================================================
-- MIGRATION: Bank Materi, CP & TP untuk Lesson Plan Generator
-- Jalankan di Supabase SQL Editor. AMAN dijalankan ulang
-- (idempoten) - jika sudah pernah menjalankan versi lama file
-- ini, jalankan lagi untuk menambah dukungan jenis 'MATERI'.
--
-- Dikelola dari: Pengaturan -> tab "Materi & CP/TP" (CRUD),
-- dan otomatis bertambah saat guru menulis baru di form
-- lesson plan (typeahead).
-- ============================================================

CREATE TABLE IF NOT EXISTS lp_cp_tp (
    id BIGSERIAL PRIMARY KEY,
    jenis TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    phase TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Perbarui constraint jenis agar mencakup MATERI (drop dulu jika ada)
ALTER TABLE lp_cp_tp DROP CONSTRAINT IF EXISTS lp_cp_tp_jenis_check;
ALTER TABLE lp_cp_tp ADD CONSTRAINT lp_cp_tp_jenis_check CHECK (jenis IN ('MATERI', 'CP', 'TP'));

ALTER TABLE lp_cp_tp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access on lp_cp_tp" ON lp_cp_tp;
CREATE POLICY "Allow anon full access on lp_cp_tp"
    ON lp_cp_tp FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lp_cp_tp_jenis_subject ON lp_cp_tp (jenis, subject);

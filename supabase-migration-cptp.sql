-- ============================================================
-- MIGRATION: Bank CP & TP untuk Lesson Plan Generator
-- Jalankan di Supabase SQL Editor (sekali saja).
--
-- CP (Capaian Pembelajaran) dan TP (Tujuan Pembelajaran)
-- disimpan terpisah per mapel. Di form lesson plan, guru cukup
-- mengetik lalu memilih dari dropdown (typeahead). Entri baru
-- otomatis tersimpan ke bank saat lesson plan di-generate.
-- ============================================================

CREATE TABLE IF NOT EXISTS lp_cp_tp (
    id BIGSERIAL PRIMARY KEY,
    jenis TEXT NOT NULL CHECK (jenis IN ('CP', 'TP')),
    subject TEXT NOT NULL DEFAULT '',
    phase TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lp_cp_tp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access on lp_cp_tp" ON lp_cp_tp;
CREATE POLICY "Allow anon full access on lp_cp_tp"
    ON lp_cp_tp FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lp_cp_tp_jenis_subject ON lp_cp_tp (jenis, subject);

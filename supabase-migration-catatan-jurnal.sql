-- ============================================================
-- MIGRATION: Create catatan_siswa and jurnal_mengajar tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- Table for student notes (Catatan Siswa)
CREATE TABLE IF NOT EXISTS catatan_siswa (
    id BIGSERIAL PRIMARY KEY,
    siswa_id BIGINT NOT NULL REFERENCES data_siswa(id) ON DELETE CASCADE,
    kelas TEXT NOT NULL,
    catatan TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one note per student per class
ALTER TABLE catatan_siswa ADD CONSTRAINT catatan_siswa_unique UNIQUE (siswa_id, kelas);

ALTER TABLE catatan_siswa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon full access on catatan_siswa"
    ON catatan_siswa FOR ALL USING (true) WITH CHECK (true);

-- Table for teaching journal (Jurnal Mengajar)
CREATE TABLE IF NOT EXISTS jurnal_mengajar (
    id BIGSERIAL PRIMARY KEY,
    kelas TEXT NOT NULL,
    pertemuan_ke INT NOT NULL,
    tanggal DATE NOT NULL,
    catatan TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one entry per class per meeting number
ALTER TABLE jurnal_mengajar ADD CONSTRAINT jurnal_mengajar_unique UNIQUE (kelas, pertemuan_ke);

ALTER TABLE jurnal_mengajar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon full access on jurnal_mengajar"
    ON jurnal_mengajar FOR ALL USING (true) WITH CHECK (true);

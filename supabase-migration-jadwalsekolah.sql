-- ============================================================
-- MIGRATION: Jadwal Sekolah (jadwal seluruh guru & seluruh kelas)
-- Jalankan di Supabase SQL Editor. Aman dijalankan ulang.
--
-- Diisi lewat fitur "Impor PDF" di aplikasi (Jadwal Sekolah ->
-- Impor). Sumber: PDF aSc Timetables dari kurikulum sekolah.
-- ============================================================

CREATE TABLE IF NOT EXISTS jadwal_sekolah (
    id BIGSERIAL PRIMARY KEY,
    sumber TEXT NOT NULL,            -- 'guru' | 'kelas'
    pemilik TEXT NOT NULL,           -- kode guru (BI2) atau nama kelas (XII A4)
    pemilik_nama TEXT DEFAULT '',    -- nama lengkap guru (utk sumber 'guru')
    hari TEXT NOT NULL,              -- Senin..Sabtu
    hari_idx INT NOT NULL,           -- 0=Senin .. 5=Sabtu
    jam_ke TEXT DEFAULT '',          -- mis. "1-2"
    jam_mulai TEXT NOT NULL,         -- "07:00"
    jam_selesai TEXT NOT NULL,       -- "08:20"
    mapel TEXT DEFAULT '',
    kode_guru TEXT DEFAULT '',
    kelas TEXT DEFAULT '',
    jenis TEXT DEFAULT 'mengajar',   -- mengajar | piket | elective | paralel
    periode TEXT DEFAULT '',         -- label periode berlaku, mis. "27 Jul - 17 Agu 2026"
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jadwal_sekolah ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access on jadwal_sekolah" ON jadwal_sekolah;
CREATE POLICY "Allow anon full access on jadwal_sekolah"
    ON jadwal_sekolah FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_jadwal_sekolah_sumber ON jadwal_sekolah (sumber, pemilik);
CREATE INDEX IF NOT EXISTS idx_jadwal_sekolah_hari ON jadwal_sekolah (hari_idx, jam_mulai);
CREATE INDEX IF NOT EXISTS idx_jadwal_sekolah_kode ON jadwal_sekolah (kode_guru);

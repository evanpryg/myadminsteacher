-- ============================================================
-- MIGRATION: Create app_settings table for TeachMate
-- Run this in Supabase SQL Editor BEFORE deploying the web app
-- ============================================================

-- Table to store app settings (replaces Google Apps Script PropertiesService)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and allow anon access (since this is a personal app)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access on app_settings"
    ON app_settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- Optional: Create jadwal_mengajar table if not exists
CREATE TABLE IF NOT EXISTS jadwal_mengajar (
    id BIGSERIAL PRIMARY KEY,
    hari TEXT NOT NULL,
    jam_mulai TEXT,
    jam_selesai TEXT,
    kelas TEXT,
    mata_pelajaran TEXT,
    ruang TEXT,
    kategori TEXT DEFAULT 'Normal',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jadwal_mengajar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon full access on jadwal_mengajar"
    ON jadwal_mengajar FOR ALL USING (true) WITH CHECK (true);

-- Optional: Create data_guru table if not exists
CREATE TABLE IF NOT EXISTS data_guru (
    id BIGSERIAL PRIMARY KEY,
    kode_guru TEXT,
    nama TEXT NOT NULL,
    mata_pelajaran TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_guru ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon full access on data_guru"
    ON data_guru FOR ALL USING (true) WITH CHECK (true);

-- Optional: Create data_wali_kelas table if not exists
CREATE TABLE IF NOT EXISTS data_wali_kelas (
    id BIGSERIAL PRIMARY KEY,
    kelas TEXT NOT NULL,
    nama_wali TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_wali_kelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon full access on data_wali_kelas"
    ON data_wali_kelas FOR ALL USING (true) WITH CHECK (true);

-- Seed default settings (optional)
INSERT INTO app_settings (key, value) VALUES
    ('GS_TAHUN_AJARAN', '2025/2026'),
    ('GS_SEMESTER', 'Ganjil'),
    ('GS_BOBOT_BAB', '50'),
    ('GS_BOBOT_HDR', '10'),
    ('GS_BOBOT_AKTF', '10'),
    ('GS_BOBOT_SAS', '30'),
    ('GS_KKM', '75'),
    ('GS_NAMA_GURU', ''),
    ('GS_NAMA_SEKOLAH', ''),
    ('GS_NAMA_KEPALA', ''),
    ('GS_TODO_LIST', '[]'),
    ('GS_QUICK_LINKS', '{}'),
    ('GS_JADWAL_OVERRIDES', '[]'),
    ('GS_DAFTAR_SEMESTER', '[]')
ON CONFLICT (key) DO NOTHING;

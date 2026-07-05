-- ============================================================
-- MIGRATION: AI Lesson Plan Generator (v2 - template-based)
-- Jalankan di Supabase SQL Editor.
-- Arsitektur: form_data (static, nested) + ai_data (hasil AI, editable)
-- Template DOCX & model pembelajaran dikelola lewat DB.
-- ============================================================

-- ------------------------------------------------------------
-- 1. MODEL PEMBELAJARAN (data, bukan kode)
--    syntax: array langkah [{key, label, hint}] -> dipakai
--    prompt builder & loop main_activities di DOCX.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lp_learning_models (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    syntax JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lp_learning_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access on lp_learning_models" ON lp_learning_models;
CREATE POLICY "Allow anon full access on lp_learning_models"
    ON lp_learning_models FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 2. TEMPLATE DOCX
--    file_url  : URL file .docx (relatif thd root web, atau URL penuh
--                mis. Supabase Storage public URL)
--    manifest  : mapping field logis -> placeholder fisik di template.
--                Menambah template baru = upload .docx + INSERT row ini.
--                Prompt AI TIDAK berubah.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lp_templates (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    version INT DEFAULT 1,
    file_url TEXT NOT NULL,
    manifest JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lp_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access on lp_templates" ON lp_templates;
CREATE POLICY "Allow anon full access on lp_templates"
    ON lp_templates FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 3. LESSON PLANS
--    form_data : data statis dari form guru (nested JSON per section)
--    ai_data   : hasil AI (JSON) - dapat diedit guru sebelum export
--
--    CATATAN: tabel lesson_plans dari fitur lama (yang sudah
--    dinonaktifkan) memiliki skema berbeda dan kosong, sehingga
--    di-drop lalu dibuat ulang. Jika Anda pernah menyimpan data
--    penting di tabel ini, backup dulu sebelum menjalankan.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS lesson_plans;
CREATE TABLE lesson_plans (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',          -- draft | final
    template_id BIGINT REFERENCES lp_templates(id),
    learning_model_slug TEXT,
    form_data JSONB NOT NULL DEFAULT '{}',
    ai_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon full access on lesson_plans" ON lesson_plans;
CREATE POLICY "Allow anon full access on lesson_plans"
    ON lesson_plans FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 4. SEED: MODEL PEMBELAJARAN
--    Menambah model baru = INSERT row baru. Tidak ada kode yang diubah.
--    "hint" menjadi panduan AI saat menyusun aktivitas per langkah.
-- ------------------------------------------------------------
INSERT INTO lp_learning_models (slug, name, syntax) VALUES
('discovery_learning', 'Discovery Learning', '[
    {"key":"stimulation","label":"Stimulation","hint":"Berikan rangsangan berupa fenomena, gambar, video, atau pertanyaan pemantik yang membuat siswa penasaran terhadap topik."},
    {"key":"problem_statement","label":"Problem Statement","hint":"Siswa mengidentifikasi dan merumuskan masalah/pertanyaan dari stimulus yang diberikan."},
    {"key":"data_collection","label":"Data Collection","hint":"Siswa mengumpulkan informasi/data yang relevan melalui membaca, observasi, atau eksperimen."},
    {"key":"data_processing","label":"Data Processing","hint":"Siswa mengolah dan menafsirkan data yang telah dikumpulkan."},
    {"key":"verification","label":"Verification","hint":"Siswa memeriksa kebenaran hipotesis/jawaban dengan membandingkan hasil olahan data."},
    {"key":"generalization","label":"Generalization","hint":"Siswa menarik kesimpulan yang dapat digeneralisasi dan mempresentasikannya."}
]'::jsonb),
('problem_based_learning', 'Problem Based Learning (PBL)', '[
    {"key":"orientasi_masalah","label":"Orientasi Masalah","hint":"Sajikan masalah kontekstual dunia nyata yang menantang dan relevan dengan topik."},
    {"key":"mengorganisasi","label":"Mengorganisasi Peserta Didik","hint":"Bagi siswa ke dalam kelompok dan bantu mendefinisikan tugas belajar terkait masalah."},
    {"key":"investigasi","label":"Membimbing Investigasi","hint":"Dorong siswa mengumpulkan informasi dan melakukan penyelidikan untuk memecahkan masalah."},
    {"key":"presentasi","label":"Mengembangkan dan Menyajikan Hasil","hint":"Siswa menyusun dan mempresentasikan hasil pemecahan masalah (laporan, karya, dsb.)."},
    {"key":"evaluasi","label":"Analisis dan Evaluasi","hint":"Refleksi dan evaluasi terhadap proses penyelidikan dan pemecahan masalah."}
]'::jsonb),
('project_based_learning', 'Project Based Learning (PjBL)', '[
    {"key":"pertanyaan_mendasar","label":"Penentuan Pertanyaan Mendasar","hint":"Ajukan pertanyaan esensial yang memicu proyek dan relevan dengan kehidupan nyata."},
    {"key":"perencanaan","label":"Mendesain Perencanaan Proyek","hint":"Siswa dan guru merancang proyek: aturan, aktivitas, alat dan bahan."},
    {"key":"penyusunan_jadwal","label":"Menyusun Jadwal","hint":"Siswa menyusun timeline penyelesaian proyek beserta tenggat tiap tahap."},
    {"key":"monitoring","label":"Memonitor Kemajuan Proyek","hint":"Guru memonitor aktivitas siswa dan kemajuan proyek, memberikan bimbingan."},
    {"key":"pengujian_hasil","label":"Menguji Hasil","hint":"Siswa mempresentasikan/menguji produk proyek, guru mengukur ketercapaian."},
    {"key":"evaluasi","label":"Evaluasi Pengalaman","hint":"Refleksi terhadap aktivitas dan hasil proyek yang telah dijalankan."}
]'::jsonb),
('inquiry_based_learning', 'Inquiry-Based Learning', '[
    {"key":"orientasi","label":"Orientasi","hint":"Kondisikan siswa siap belajar dan perkenalkan topik melalui fenomena menarik."},
    {"key":"merumuskan_masalah","label":"Merumuskan Masalah","hint":"Siswa merumuskan pertanyaan/persoalan yang akan diselidiki."},
    {"key":"merumuskan_hipotesis","label":"Merumuskan Hipotesis","hint":"Siswa mengajukan jawaban sementara atas rumusan masalah."},
    {"key":"mengumpulkan_data","label":"Mengumpulkan Data","hint":"Siswa menjaring informasi melalui eksperimen, observasi, atau studi literatur."},
    {"key":"menguji_hipotesis","label":"Menguji Hipotesis","hint":"Siswa menganalisis data untuk menentukan diterima/ditolaknya hipotesis."},
    {"key":"menyimpulkan","label":"Merumuskan Kesimpulan","hint":"Siswa mendeskripsikan temuan dan menarik kesimpulan."}
]'::jsonb),
('contextual_teaching_learning', 'Contextual Teaching and Learning (CTL)', '[
    {"key":"konstruktivisme","label":"Konstruktivisme","hint":"Siswa membangun pemahaman sendiri dari pengalaman/pengetahuan awal yang dikaitkan dengan konteks nyata."},
    {"key":"inquiry","label":"Menemukan (Inquiry)","hint":"Siswa menemukan konsep melalui kegiatan penyelidikan terbimbing."},
    {"key":"bertanya","label":"Bertanya (Questioning)","hint":"Kembangkan sesi tanya jawab untuk menggali dan mengkonfirmasi pemahaman."},
    {"key":"masyarakat_belajar","label":"Masyarakat Belajar","hint":"Siswa bekerja dalam kelompok, saling berbagi dan berdiskusi."},
    {"key":"pemodelan","label":"Pemodelan","hint":"Berikan contoh/model konkret (demonstrasi, karya contoh) yang bisa ditiru siswa."},
    {"key":"refleksi_penilaian","label":"Refleksi & Penilaian Nyata","hint":"Siswa merefleksikan pembelajaran dan guru melakukan penilaian autentik."}
]'::jsonb),
('task_based_learning', 'Task-Based Learning (TBL)', '[
    {"key":"pre_task","label":"Pre-Task","hint":"Perkenalkan topik dan tugas, aktifkan kosakata/konsep yang dibutuhkan."},
    {"key":"task","label":"Task","hint":"Siswa mengerjakan tugas secara berpasangan/kelompok."},
    {"key":"planning","label":"Planning","hint":"Siswa menyiapkan laporan hasil pengerjaan tugas."},
    {"key":"report","label":"Report","hint":"Siswa melaporkan/mempresentasikan hasil tugas."},
    {"key":"analysis_practice","label":"Analysis & Practice","hint":"Analisis hasil, penguatan konsep, dan latihan tambahan."}
]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 5. SEED: TEMPLATE DEFAULT (Lesson Plan SMA)
--    map        : field logis -> nama placeholder di DOCX
--    activities : loop docxtemplater utk main activities
--                 (placeholder dalam loop: time, syntax, activity)
--    checkbox   : konvensi chk_<group>_<key> -> simbol centang,
--                 dan <group>_others utk isian "Others: ..."
-- ------------------------------------------------------------
INSERT INTO lp_templates (name, version, file_url, manifest, is_active)
SELECT 'Lesson Plan SMA Progresif', 1, 'templates/lesson-plan-sma-v1.docx', '{
    "delimiters": {"start": "{{", "end": "}}"},
    "activities": {"tag": "main_activities"},
    "map": {
        "teacher_name": "Nama_Guru",
        "principal_name": "Nama_Kepala",
        "subject": "Subject",
        "grade": "Grade",
        "phase": "Phase",
        "date": "Date",
        "date_today": "Date_Today",
        "school_year": "Tahun_Ajaran",
        "duration": "Duration",
        "meeting": "Meeting",
        "learning_material": "Learning_Material",
        "learning_achievement": "Learning_Achievement",
        "cdc": "CDC",
        "learning_objectives": "Learning_Objectives",
        "learning_topic": "Learning_Topic",
        "learning_media": "Learning_Media",
        "resources": "Resources",
        "students": "Students",
        "partnerships": "Partnerships",
        "learning_environment": "Learning_Environment",
        "digital_utilization": "Digital_Utilization",
        "islamic_value": "Islamic_Value",
        "prior_knowledge": "Prior_Knowledge",
        "review": "Review",
        "alpha_zone": "Alpha_Zone",
        "application": "Application",
        "closing": "Closing",
        "time_closing": "Time_Closing"
    }
}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM lp_templates WHERE name = 'Lesson Plan SMA Progresif');

-- ------------------------------------------------------------
-- 6. Trigger updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION lp_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lesson_plans_updated ON lesson_plans;
CREATE TRIGGER trg_lesson_plans_updated
    BEFORE UPDATE ON lesson_plans
    FOR EACH ROW EXECUTE FUNCTION lp_set_updated_at();

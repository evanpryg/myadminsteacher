# TeachMate Web — GitHub Pages

## Deploy ke GitHub Pages

1. Push semua file dari folder ini ke **root** repo GitHub
2. Buka repo → **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)`
5. Klik **Save**
6. Tunggu 1-2 menit → website live di `https://evanpryg.github.io/myteacheradministration/`

## Persiapan Supabase (Hanya Sekali)

1. Jalankan `supabase-migration.sql` di Supabase SQL Editor.
2. Jalankan `supabase-migration-lessonplan.sql` (fitur Lesson Plan Generator).
3. Jalankan `supabase-migration-cptp.sql` (bank Materi/CP/TP — aman dijalankan ulang).

## Struktur File

```
/ (root repo)
├── index.html
├── supabase-migration.sql
├── supabase-migration-lessonplan.sql
├── README.md
├── css/
│   └── style.css
├── templates/
│   ├── lesson-plan-sma-v1.docx      # template DOCX (placeholder + loop docxtemplater)
│   └── CONTOH-HASIL-RENDER.docx     # contoh hasil jadi
└── js/
    ├── supabase-client.js
    ├── api.js
    ├── api-nilai.js
    ├── app-utama.js
    ├── app-dashboard.js
    ├── app-nilai.js
    ├── app-presensi.js
    ├── app-keaktifan.js
    ├── app-pengaturan.js
    ├── lp-registry.js        # Field Registry (source of truth field lesson plan)
    ├── lp-api.js             # CRUD lesson_plans / lp_templates / lp_learning_models
    ├── lp-ai.js              # prompt builder + adapter Gemini (output JSON)
    ├── lp-docx.js            # flatten + render docxtemplater (client-side)
    └── app-lessonplan.js     # UI: list, wizard, editor review, export
```

## Fitur Lesson Plan Generator

Alur: **Form → Generate AI (JSON) → Review/Edit oleh guru → Simpan → Download Word**.

- AI hanya menghasilkan isi (JSON); dokumen Word dirakit aplikasi dari template
  DOCX ber-placeholder (`templates/lesson-plan-sma-v1.docx`) via docxtemplater.
- **Setup**: isi API Key Gemini di Pengaturan → tab AI Lesson Plan (gratis di
  [Google AI Studio](https://aistudio.google.com/apikey)).
- **Menambah model pembelajaran**: INSERT row baru di tabel `lp_learning_models`
  (kolom `syntax` = daftar langkah). Tanpa mengubah kode.
- **Menambah template DOCX**: upload file .docx baru (mis. folder `templates/` atau
  Supabase Storage) + INSERT row di `lp_templates` dengan `manifest` mapping
  placeholder. Prompt AI tidak berubah.
- Baris kegiatan inti memakai loop `{{#main_activities}}…{{/main_activities}}`,
  jadi jumlah langkah bebas mengikuti model pembelajaran.
- Checkbox (dimensi profil, strategi, metode, asesmen) memakai placeholder
  `{{chk_<grup>_<opsi>}}` yang diisi simbol ☑/☐.
- **Download PDF**: butuh setup sekali — deploy `gas-pdf-converter.gs` ke
  script.google.com (petunjuk lengkap ada di dalam file), lalu tempel URL
  `/exec`-nya di Pengaturan → AI Lesson Plan → "URL Konverter PDF".
  Nama file mengikuti pola `LP_<kode>_<kelas>_P<pertemuan>` (kode diatur
  di Pengaturan, default `M16`).

### Mengubah template lesson plan

1. Edit file `.docx`-nya di Word/Google Docs (jaga placeholder `{{...}}` tetap utuh).
2. Simpan sebagai file baru (mis. `templates/lesson-plan-sma-v2.docx`) dan push ke repo.
3. Update baris di tabel `lp_templates`: ganti `file_url` ke file baru (atau INSERT
   row baru + set `is_active`). Jika hanya mengubah tata letak/teks statis, selesai —
   tanpa menyentuh kode. Jika menambah placeholder baru: tambah field di
   `js/lp-registry.js` + mapping di kolom `manifest`.

### Input minimal di generator

Guru cukup mengisi: mapel, kelas, tanggal, topik, dan model pembelajaran.
Sisanya (materi, CP, TP, lintas disiplin, media, sumber, strategi/metode/
dimensi/asesmen) diisi atau disarankan AI dan tetap bisa diedit di step review.

**Bank Materi/CP/TP** (tabel `lp_cp_tp`): dikelola di Pengaturan → tab
"Materi & CP/TP" (tambah/edit/hapus) — idealnya disiapkan di awal semester.
Di form generator, field Materi/CP/TP memakai dropdown ketik-cari dari bank;
entri baru yang ditulis langsung di generator otomatis tersimpan ke bank.

### Jadwal: sekali vs berulang

- Tambah jadwal (Pengaturan → Jadwal, atau tombol **+** di halaman Jadwal
  Mengajar per hari): pilih **berulang tiap minggu** (tabel `jadwal_mengajar`,
  dengan tanggal "berlaku mulai" — tidak muncul di minggu-minggu sebelumnya)
  atau **hanya tanggal tertentu** (override `GS_JADWAL_OVERRIDES`).
- Hapus dari halaman Jadwal Mengajar: **hapus hari ini saja** (skip per
  tanggal, bisa di-undo) atau **hapus seterusnya** (seri diakhiri mulai
  tanggal itu via override `aksi:'end'` — riwayat minggu sebelumnya TETAP
  tersimpan untuk rekap). Hard delete permanen hanya ada di Pengaturan →
  Jadwal. Agenda dashboard & modal "Jadwal Minggu Depan" ikut menerapkan
  semua override ini.
- Halaman Jadwal Mengajar berupa **timeline kalender ber-jam** (sumbu waktu
  di kiri, event diposisikan & ditinggikan sesuai jam) sehingga jeda kosong
  terlihat; di layar sempit bisa digeser horizontal.

### Kalender Pertemuan (sinkron pertemuan ↔ tanggal)

Nomor pertemuan diturunkan otomatis dari jadwal: pertemuan ke-N sebuah
kelas = kemunculan terjadwal ke-N sejak **Tanggal Mulai Semester**
(Pengaturan → Semester). Dipakai lintas fitur agar bebas human error:

- **Presensi**: dropdown TM menampilkan tanggalnya ("Pertemuan 3 — 22/07")
  dan field tanggal terisi otomatis (tetap bisa diubah manual).
- **Lesson plan**: pilih kelas + pertemuan → tanggal terisi otomatis
  (dan sebaliknya, ganti tanggal → nomor pertemuan menyesuaikan).
  Duplikat massal memakai tanggal pertemuan yang sama di tiap kelas tujuan.
- **Keaktifan**: badge "Pertemuan ke-N sesuai jadwal" di bawah tanggal.

## Catatan
- SUPABASE_KEY yang dipakai adalah anon key (public), aman untuk client-side
- RLS harus dikonfigurasi di Supabase untuk mengatur akses data
- API key Gemini milik guru disimpan di tabel `app_settings` (aplikasi personal)

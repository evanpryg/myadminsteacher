# TeachMate Web — GitHub Pages

## Deploy ke GitHub Pages

1. Push semua file dari folder ini ke **root** repo GitHub
2. Buka repo → **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)`
5. Klik **Save**
6. Tunggu 1-2 menit → website live di `https://evanpryg.github.io/myteacheradministration/`

## Persiapan Supabase (Hanya Sekali)

Jalankan `supabase-migration.sql` di Supabase SQL Editor.

## Struktur File

```
/ (root repo)
├── index.html
├── supabase-migration.sql
├── README.md
├── css/
│   └── style.css
└── js/
    ├── supabase-client.js
    ├── api.js
    ├── api-nilai.js
    ├── app-utama.js
    ├── app-dashboard.js
    ├── app-nilai.js
    ├── app-presensi.js
    ├── app-keaktifan.js
    └── app-pengaturan.js
```

## Catatan
- Fitur Lesson Plan AI dinonaktifkan sementara (butuh proxy untuk API key Gemini)
- SUPABASE_KEY yang dipakai adalah anon key (public), aman untuk client-side
- RLS harus dikonfigurasi di Supabase untuk mengatur akses data

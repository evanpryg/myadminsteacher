// ============================================================
// API FUNCTIONS - NILAI & PENILAIAN
// ============================================================

async function getSiswaUntukPenilaian(kelasDipilih) {
    const results = await fetchSupabaseParallel([
        "/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelasDipilih),
        "/rest/v1/buku_nilai_rekap",
        "/rest/v1/data_presensi?kelas=eq." + encodeURIComponent(kelasDipilih),
        "/rest/v1/log_keaktifan?kelas=eq." + encodeURIComponent(kelasDipilih)
    ]);

    const siswa = results[0] || [];
    const semuaNilai = results[1] || [];
    const presensiData = results[2] || [];
    const keaktifanData = results[3] || [];

    const idSet = {};
    siswa.forEach(s => { idSet[s.id] = true; });
    const nilai = semuaNilai.filter(n => idSet[n.siswa_id]);

    const nilaiMap = {};
    nilai.forEach(n => { nilaiMap[n.siswa_id] = n; });

    const presensiPerSiswa = {};
    presensiData.forEach(p => {
        if (!presensiPerSiswa[p.siswa_id]) presensiPerSiswa[p.siswa_id] = { total: 0, hadir: 0 };
        presensiPerSiswa[p.siswa_id].total++;
        if (p.status_hadir === 'H' || p.status_hadir === 'I') presensiPerSiswa[p.siswa_id].hadir++;
    });

    const keaktifanPerSiswa = {};
    let maxPoin = 0;
    keaktifanData.forEach(k => {
        if (!keaktifanPerSiswa[k.siswa_id]) keaktifanPerSiswa[k.siswa_id] = 0;
        keaktifanPerSiswa[k.siswa_id] += (k.poin_keaktifan || 0);
    });
    Object.keys(keaktifanPerSiswa).forEach(id => {
        if (keaktifanPerSiswa[id] > maxPoin) maxPoin = keaktifanPerSiswa[id];
    });

    const hasil = [];
    siswa.forEach((s, idx) => {
        const n = nilaiMap[s.id] || {};
        let babs = [];
        if (n.nilai_babs_json) { try { babs = JSON.parse(n.nilai_babs_json); } catch (e) { babs = []; } }
        if (babs.length === 0 && n.nilai_bab) { babs.push({ tugas: [n.nilai_bab], uh_asli: n.nilai_bab, uh_remed: '', uh_katrol: n.nilai_bab }); }

        let hdr = n.nilai_hdr || '';
        if (hdr === '' && presensiPerSiswa[s.id] && presensiPerSiswa[s.id].total > 0) {
            hdr = Math.round((presensiPerSiswa[s.id].hadir / presensiPerSiswa[s.id].total) * 100);
        }
        let aktf = n.nilai_aktf || '';
        if (aktf === '' && keaktifanPerSiswa[s.id] !== undefined && maxPoin > 0) {
            aktf = Math.round((keaktifanPerSiswa[s.id] / maxPoin) * 100);
        }

        hasil.push({
            no: idx + 1, id_siswa: s.nisn, nama: s.nama_siswa,
            tugas: n.nilai_bab ? [n.nilai_bab] : [], babs,
            uh_asli: n.nilai_bab || '', uh_remed: '', uh_katrol: n.nilai_bab || '',
            hdr, aktf,
            sas_asli: n.nilai_sas || '', sas_remed: '', sas_katrol: n.nilai_sas || '',
            rapor: n.nilai_akhir || '', status: (n.nilai_akhir >= 75) ? 'TUNTAS' : 'TIDAK TUNTAS'
        });
    });
    return hasil;
}

async function simpanDataNilaiBab(kelas, mapel, babKe, dataNilaiSiswa) {
    const siswa = await fetchSupabase("/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas), "GET") || [];
    const idMap = {};
    siswa.forEach(s => { idMap[s.nisn] = s.id; });

    const payloadBatch = [];
    dataNilaiSiswa.forEach(s => {
        const db_id = idMap[s.id_siswa];
        if (!db_id) return;
        let totalBab = 0, countBab = 0;
        const babs = s.babs || [];
        babs.forEach(bab => {
            const uh = parseFloat(bab.uh_katrol);
            if (!isNaN(uh) && uh > 0) { totalBab += uh; countBab++; }
        });
        const avgBab = countBab > 0 ? Math.round(totalBab / countBab) : 0;
        payloadBatch.push({ siswa_id: db_id, mata_pelajaran: mapel, nilai_bab: avgBab, nilai_babs_json: JSON.stringify(babs) });
    });

    if (payloadBatch.length > 0) {
        await fetchSupabase("/rest/v1/buku_nilai_rekap", "POST", payloadBatch, { "Prefer": "return=representation,resolution=merge-duplicates" });
    }
    return { success: true };
}

async function simpanDataNilaiSAS(kelas, mapel, dataNilaiSiswa) {
    const siswa = await fetchSupabase("/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas), "GET") || [];
    const idMap = {};
    siswa.forEach(s => { idMap[s.nisn] = s.id; });

    const payloadBatch = [];
    dataNilaiSiswa.forEach(s => {
        const db_id = idMap[s.id_siswa];
        if (!db_id) return;
        payloadBatch.push({
            siswa_id: db_id, mata_pelajaran: mapel,
            nilai_hdr: s.hdr ? parseInt(s.hdr) : null,
            nilai_aktf: s.aktf ? parseInt(s.aktf) : null,
            nilai_sas: s.sas_katrol ? parseInt(s.sas_katrol) : null,
            nilai_akhir: s.rapor ? parseInt(s.rapor) : null
        });
    });

    if (payloadBatch.length > 0) {
        await fetchSupabase("/rest/v1/buku_nilai_rekap", "POST", payloadBatch, { "Prefer": "return=representation,resolution=merge-duplicates" });
    }
    return { success: true };
}

// ── JADWAL ──────────────────────────────────────────────────
async function getDaftarJadwal() {
    const data = await fetchSupabase("/rest/v1/jadwal_mengajar?order=hari,jam_ke", "GET");
    if (!data) return [];
    // Map kolom tabel ke format frontend
    return data.map(j => {
        let jam_mulai = '', jam_selesai = '';
        if (j.jam_ke) {
            // Format bisa "07:00-08:30" atau "07:00 08:30"
            const parts = j.jam_ke.split(/[-\s]+/);
            jam_mulai = (parts[0] || '').trim();
            jam_selesai = (parts[1] || '').trim();
        }
        return {
            id: j.id,
            hari: j.hari || '',
            jam_mulai,
            jam_selesai,
            kelas: j.kelas || '',
            mata_pelajaran: j.mata_pelajaran || '',
            ruang: j.ruangan || '',
            kategori: j.kategori || 'Normal'
        };
    });
}

async function tambahJadwal(jadwal) {
    // Map ke kolom tabel: hari, jam_ke, kelas, mata_pelajaran, ruangan, kategori
    const payload = {
        hari: jadwal.hari || '',
        jam_ke: (jadwal.jam_mulai && jadwal.jam_selesai) ? jadwal.jam_mulai + ' ' + jadwal.jam_selesai : (jadwal.jam_mulai || ''),
        kelas: jadwal.kelas || '',
        mata_pelajaran: jadwal.mata_pelajaran || '',
        ruangan: jadwal.ruang || '',
        kategori: jadwal.kategori || 'Normal'
    };
    const res = await fetchSupabase("/rest/v1/jadwal_mengajar", "POST", payload);
    if (res) return { success: true };
    return { success: false, message: 'Gagal menyimpan jadwal: ' + (_lastSupabaseError || 'Unknown error') };
}

async function updateJadwal(rowId, jadwal) {
    const payload = {
        hari: jadwal.hari || '',
        jam_ke: (jadwal.jam_mulai && jadwal.jam_selesai) ? jadwal.jam_mulai + ' ' + jadwal.jam_selesai : (jadwal.jam_mulai || ''),
        kelas: jadwal.kelas || '',
        mata_pelajaran: jadwal.mata_pelajaran || '',
        ruangan: jadwal.ruang || '',
        kategori: jadwal.kategori || 'Normal'
    };
    const res = await fetchSupabase("/rest/v1/jadwal_mengajar?id=eq." + rowId, "PATCH", payload);
    if (res !== null) return { success: true };
    return { success: false, message: 'Gagal mengupdate jadwal: ' + (_lastSupabaseError || 'Unknown error') };
}

async function hapusJadwal(rowId) {
    await fetchSupabase("/rest/v1/jadwal_mengajar?id=eq." + rowId, "DELETE");
    return { success: true };
}

// ── PROFIL GURU ─────────────────────────────────────────────
async function saveProfilGuru(profil) {
    const settings = {};
    if (profil.nama !== undefined) settings.GS_NAMA_GURU = profil.nama;
    if (profil.sekolah !== undefined) settings.GS_NAMA_SEKOLAH = profil.sekolah;
    if (profil.namaKepala !== undefined) settings.GS_NAMA_KEPALA = profil.namaKepala;
    if (profil.tahunAjaran !== undefined) settings.GS_TAHUN_AJARAN = profil.tahunAjaran;
    if (profil.semester !== undefined) settings.GS_SEMESTER = profil.semester;
    if (profil.kkm !== undefined) settings.GS_KKM = profil.kkm;
    await setMultipleSettings(settings);
    return { success: true };
}

// ── TODO & QUICK LINKS ──────────────────────────────────────
async function saveTodoList(todos) {
    await setAppSetting('GS_TODO_LIST', JSON.stringify(todos || []));
    return { success: true };
}

async function simpanQuickLinks(links) {
    await setAppSetting('GS_QUICK_LINKS', JSON.stringify(links || []));
    return { success: true };
}

async function getQuickLinksData() {
    const raw = await getAppSetting('GS_QUICK_LINKS', '');
    if (!raw) return { categories: ['Umum'], links: [] };
    try { return JSON.parse(raw); } catch (e) { return { categories: ['Umum'], links: [] }; }
}

// ── SEMESTER ────────────────────────────────────────────────
async function gantiSemesterAktif(ta, sem) {
    await setMultipleSettings({ GS_TAHUN_AJARAN: ta, GS_SEMESTER: sem });
    return { success: true };
}

async function buatSemesterBaru(ta, sem, opsi) {
    const periode = ta + '-' + sem;
    
    // Update semester aktif
    await setMultipleSettings({ GS_TAHUN_AJARAN: ta, GS_SEMESTER: sem });
    
    // Tambahkan ke daftar semester
    const rawDaftar = await getAppSetting('GS_DAFTAR_SEMESTER', '[]');
    let daftar = [];
    try { daftar = JSON.parse(rawDaftar); } catch (e) { daftar = []; }
    
    // Cek duplikat
    if (!daftar.find(s => s.periode === periode)) {
        daftar.unshift({
            tahunAjaran: ta,
            semester: sem,
            periode: periode,
            tanggalDibuat: new Date().toLocaleDateString('id-ID')
        });
        await setAppSetting('GS_DAFTAR_SEMESTER', JSON.stringify(daftar));
    }
    
    // Reset nilai jika diminta
    if (opsi === 'reset_nilai' || (opsi && opsi.resetNilai)) {
        await fetchSupabase("/rest/v1/buku_nilai_rekap?id=gt.0", "DELETE");
    }
    return { success: true, message: 'Semester baru berhasil dibuat.' };
}

// ── GURU & WALI KELAS ───────────────────────────────────────
async function getDataGuru() {
    return await fetchSupabase("/rest/v1/data_guru?order=nama", "GET") || [];
}

async function tambahGuru(kode, nama, mapel) {
    const res = await fetchSupabase("/rest/v1/data_guru", "POST", { kode_guru: kode, nama, mata_pelajaran: mapel });
    if (res) return { success: true };
    return { success: false, message: 'Gagal menambah guru.' };
}

async function editGuru(id, kode, nama, mapel) {
    const res = await fetchSupabase("/rest/v1/data_guru?id=eq." + id, "PATCH", { kode_guru: kode, nama, mata_pelajaran: mapel });
    if (res !== null) return { success: true };
    return { success: false, message: 'Gagal mengupdate guru.' };
}

async function hapusGuru(id) {
    await fetchSupabase("/rest/v1/data_guru?id=eq." + id, "DELETE");
    return { success: true };
}

async function getDataWaliKelas() {
    const [wali, siswa] = await fetchSupabaseParallel([
        "/rest/v1/data_wali_kelas?order=kelas",
        "/rest/v1/data_siswa?select=kelas"
    ]);
    const countMap = {};
    (siswa || []).forEach(s => { countMap[s.kelas] = (countMap[s.kelas] || 0) + 1; });
    return (wali || []).map(w => ({ ...w, total_siswa: countMap[w.kelas] || 0 }));
}

async function tambahWaliKelas(kelas, namaWali) {
    const res = await fetchSupabase("/rest/v1/data_wali_kelas", "POST", { kelas, nama_wali: namaWali });
    if (res) return { success: true };
    return { success: false, message: 'Gagal menambah wali kelas.' };
}

async function editWaliKelas(id, kelas, namaWali) {
    const res = await fetchSupabase("/rest/v1/data_wali_kelas?id=eq." + id, "PATCH", { kelas, nama_wali: namaWali });
    if (res !== null) return { success: true };
    return { success: false, message: 'Gagal mengupdate.' };
}

async function hapusWaliKelas(id) {
    await fetchSupabase("/rest/v1/data_wali_kelas?id=eq." + id, "DELETE");
    return { success: true };
}

// ── JADWAL OVERRIDES ────────────────────────────────────────
async function getJadwalOverrides() {
    const raw = await getAppSetting('GS_JADWAL_OVERRIDES', '[]');
    try { return JSON.parse(raw); } catch (e) { return []; }
}

async function simpanJadwalOverride(override) {
    const overrides = await getJadwalOverrides();
    overrides.push(override);
    await setAppSetting('GS_JADWAL_OVERRIDES', JSON.stringify(overrides));
    return { success: true };
}

async function hapusJadwalOverride(tanggal, jadwalId) {
    let overrides = await getJadwalOverrides();
    overrides = overrides.filter(o => !(o.tanggal === tanggal && o.jadwalId === jadwalId && o.aksi === 'skip'));
    await setAppSetting('GS_JADWAL_OVERRIDES', JSON.stringify(overrides));
    return { success: true };
}

// ── DASHBOARD DATA (combines multiple reads) ────────────────
async function getDashboardData() {
    const settings = await getMultipleSettings([
        'GS_NAMA_GURU', 'GS_NAMA_SEKOLAH', 'GS_TAHUN_AJARAN', 'GS_SEMESTER',
        'GS_KKM', 'GS_TODO_LIST', 'GS_QUICK_LINKS', 'GS_JADWAL_OVERRIDES'
    ]);

    const ta = settings.GS_TAHUN_AJARAN || '2025/2026';
    const sem = settings.GS_SEMESTER || 'Ganjil';
    const kkm = parseInt(settings.GS_KKM || '75');

    // Parallel fetch main data
    const [mengajar, siswa, nilai, jadwal] = await fetchSupabaseParallel([
        "/rest/v1/pengaturan_mengajar?select=kelas,mata_pelajaran",
        "/rest/v1/data_siswa?select=id,kelas,nisn,nama_siswa",
        "/rest/v1/buku_nilai_rekap?select=siswa_id,nilai_akhir",
        "/rest/v1/jadwal_mengajar?order=jam_ke"
    ]);

    const kelasSet = {};
    (mengajar || []).forEach(m => { kelasSet[m.kelas] = true; });
    const jumlahKelas = Object.keys(kelasSet).length;
    
    // Hitung siswa HANYA dari kelas yang diampu
    const siswaYangDiampu = (siswa || []).filter(s => kelasSet[s.kelas]);
    const jumlahSiswa = siswaYangDiampu.length;

    // Rata-rata nilai
    let rataRataNilai = null;
    const nilaiValid = (nilai || []).filter(n => n.nilai_akhir > 0);
    if (nilaiValid.length > 0) {
        const total = nilaiValid.reduce((acc, n) => acc + n.nilai_akhir, 0);
        rataRataNilai = Math.round(total / nilaiValid.length);
    }

    // Agenda hari ini
    const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const hariIni = hariList[now.getDay()];
    const agenda = (jadwal || []).filter(j => j.hari === hariIni).map(j => {
        let jam_mulai = '', jam_selesai = '';
        if (j.jam_ke) { const p = j.jam_ke.split('-'); jam_mulai = (p[0]||'').trim(); jam_selesai = (p[1]||'').trim(); }
        return {
            jamMulai: jam_mulai, jamSelesai: jam_selesai,
            kelas: j.kelas || '', mapel: j.mata_pelajaran || '',
            ruang: j.ruangan || '', kategori: j.kategori || 'Normal'
        };
    });

    // Todo & Quick Links
    let todos = [];
    try { todos = JSON.parse(settings.GS_TODO_LIST || '[]'); } catch (e) { todos = []; }
    let quickLinks = { categories: ['Umum'], links: [] };
    try { quickLinks = JSON.parse(settings.GS_QUICK_LINKS || '{}'); } catch (e) {}

    return {
        configured: true,
        periodeAktif: ta + '-' + sem,
        profil: { nama: settings.GS_NAMA_GURU || 'Guru', sekolah: settings.GS_NAMA_SEKOLAH || '', tahunAjaran: ta, semester: sem, kkm },
        stats: { jumlahSiswa, jumlahKelas, rataRataNilai, rataRataKehadiran: null },
        agenda, hariIni, todos, quickLinks,
        siswaPerluPerhatian: _hitungSiswaPerluPerhatian(siswaYangDiampu, nilai, kkm),
        apresiasi: _hitungApresiasi(siswaYangDiampu, nilai, kkm)
    };
}

// ── Dashboard Helpers: Perhatian & Apresiasi ────────────────
function _hitungSiswaPerluPerhatian(siswa, nilaiData, kkm) {
    if (!siswa || siswa.length === 0 || !nilaiData) return [];
    const nilaiMap = {};
    (nilaiData || []).forEach(n => { nilaiMap[n.siswa_id] = n; });

    const hasil = [];
    siswa.forEach(s => {
        const n = nilaiMap[s.id];
        if (!n) return;
        const alasan = [];
        if (n.nilai_akhir && n.nilai_akhir < kkm) {
            alasan.push({ tipe: 'nilai', label: 'Nilai ' + n.nilai_akhir + ' (< KKM ' + kkm + ')' });
        }
        if (alasan.length > 0) {
            hasil.push({ nama: s.nama_siswa, kelas: s.kelas, alasan });
        }
    });
    return hasil.slice(0, 5); // Max 5
}

function _hitungApresiasi(siswa, nilaiData, kkm) {
    const result = { academicStar: null, growthChampion: null, activeLearner: null };
    if (!siswa || siswa.length === 0 || !nilaiData || nilaiData.length === 0) return result;

    const nilaiMap = {};
    (nilaiData || []).forEach(n => { nilaiMap[n.siswa_id] = n; });

    // Academic Star: siswa dengan nilai tertinggi
    let topNilai = 0, topSiswa = null;
    siswa.forEach(s => {
        const n = nilaiMap[s.id];
        if (n && n.nilai_akhir && n.nilai_akhir > topNilai) {
            topNilai = n.nilai_akhir;
            topSiswa = s;
        }
    });
    if (topSiswa && topNilai > 0) {
        result.academicStar = { nama: topSiswa.nama_siswa, kelas: topSiswa.kelas, nilai: topNilai };
    }

    return result;
}

// ── PENGATURAN DATA (for Pengaturan page) ───────────────────
async function getPengaturanData() {
    const settings = await getMultipleSettings([
        'GS_NAMA_GURU', 'GS_NAMA_SEKOLAH', 'GS_TAHUN_AJARAN', 'GS_SEMESTER',
        'GS_KKM', 'GS_BOBOT_BAB', 'GS_BOBOT_HDR', 'GS_BOBOT_AKTF', 'GS_BOBOT_SAS',
        'GS_DAFTAR_SEMESTER', 'GS_QUICK_LINKS', 'GS_NAMA_KEPALA'
    ]);

    const [mengajar, kelasUnik, jadwal] = await fetchSupabaseParallel([
        "/rest/v1/pengaturan_mengajar?select=id,kelas,mata_pelajaran",
        "/rest/v1/data_siswa?select=kelas",
        "/rest/v1/jadwal_mengajar?order=hari,jam_ke"
    ]);

    const ta = settings.GS_TAHUN_AJARAN || '2025/2026';
    const sem = settings.GS_SEMESTER || 'Ganjil';
    const periodeAktif = ta + '-' + sem;

    // Parse daftar semester dari settings (JSON array)
    let daftarSemester = [];
    try { daftarSemester = JSON.parse(settings.GS_DAFTAR_SEMESTER || '[]'); } catch (e) { daftarSemester = []; }
    // Pastikan semester aktif ada di daftar
    if (daftarSemester.length === 0 || !daftarSemester.find(s => s.periode === periodeAktif)) {
        daftarSemester.unshift({ tahunAjaran: ta, semester: sem, periode: periodeAktif, tanggalDibuat: new Date().toLocaleDateString('id-ID') });
    }

    // Parse quick links
    let quickLinks = [];
    try { quickLinks = JSON.parse(settings.GS_QUICK_LINKS || '[]'); } catch (e) { quickLinks = []; }

    // Map jadwal to frontend format
    const jadwalMapped = (jadwal || []).map(j => {
        let jam_mulai = '', jam_selesai = '';
        if (j.jam_ke) { const p = j.jam_ke.split(/[-\s]+/); jam_mulai = (p[0]||'').trim(); jam_selesai = (p[1]||'').trim(); }
        return { id: j.id, hari: j.hari, jam_mulai, jam_selesai, kelas: j.kelas || '', mata_pelajaran: j.mata_pelajaran || '', ruang: j.ruangan || '', kategori: j.kategori || 'Normal' };
    });

    return {
        configured: true,
        periodeAktif,
        infoAktif: { tahunAjaran: ta, semester: sem },
        daftarSemester,
        profil: {
            nama: settings.GS_NAMA_GURU || '', sekolah: settings.GS_NAMA_SEKOLAH || '',
            namaKepala: settings.GS_NAMA_KEPALA || '',
            tahunAjaran: ta, semester: sem,
            kkm: settings.GS_KKM || '75'
        },
        bobot: { bab: parseInt(settings.GS_BOBOT_BAB || '50'), hdr: parseInt(settings.GS_BOBOT_HDR || '10'), aktf: parseInt(settings.GS_BOBOT_AKTF || '10'), sas: parseInt(settings.GS_BOBOT_SAS || '30') },
        mengajar: mengajar || [],
        kelasUnik: [...new Set((kelasUnik || []).map(k => k.kelas))].sort(),
        jadwal: jadwalMapped,
        quickLinks
    };
}


// ── EXPORT DATA ─────────────────────────────────────────────
async function getExportData(jenis) {
    try {
        if (jenis === 'siswa') {
            const data = await fetchSupabase("/rest/v1/data_siswa?order=kelas,nama_siswa", "GET") || [];
            return { data: [['NISN', 'Nama', 'Kelas'], ...data.map(s => [s.nisn, s.nama_siswa, s.kelas])] };
        }
        if (jenis === 'nilai') {
            const [siswa, nilai] = await fetchSupabaseParallel(["/rest/v1/data_siswa?order=kelas,nama_siswa", "/rest/v1/buku_nilai_rekap"]);
            const idMap = {}; (siswa || []).forEach(s => { idMap[s.id] = s; });
            const rows = [['NISN', 'Nama', 'Kelas', 'Nilai Bab', 'Nilai SAS', 'Nilai Akhir']];
            (nilai || []).forEach(n => { const s = idMap[n.siswa_id]; if (s) rows.push([s.nisn, s.nama_siswa, s.kelas, n.nilai_bab || '', n.nilai_sas || '', n.nilai_akhir || '']); });
            return { data: rows };
        }
        if (jenis === 'presensi') {
            const [siswa, presensi] = await fetchSupabaseParallel(["/rest/v1/data_siswa?order=kelas,nama_siswa", "/rest/v1/data_presensi?order=tanggal"]);
            const idMap = {}; (siswa || []).forEach(s => { idMap[s.id] = s; });
            const rows = [['NISN', 'Nama', 'Kelas', 'Tanggal', 'Status']];
            (presensi || []).forEach(p => { const s = idMap[p.siswa_id]; if (s) rows.push([s.nisn, s.nama_siswa, s.kelas, p.tanggal, p.status_hadir]); });
            return { data: rows };
        }
        if (jenis === 'keaktifan') {
            const [siswa, logs] = await fetchSupabaseParallel(["/rest/v1/data_siswa?order=kelas,nama_siswa", "/rest/v1/log_keaktifan?order=tanggal"]);
            const idMap = {}; (siswa || []).forEach(s => { idMap[s.id] = s; });
            const rows = [['NISN', 'Nama', 'Kelas', 'Tanggal', 'Aktivitas', 'Poin']];
            (logs || []).forEach(l => { const s = idMap[l.siswa_id]; if (s) rows.push([s.nisn, s.nama_siswa, s.kelas, l.tanggal, l.catatan, l.poin_keaktifan]); });
            return { data: rows };
        }
        if (jenis === 'semua') {
            const [s, n, p, k] = await Promise.all([getExportData('siswa'), getExportData('nilai'), getExportData('presensi'), getExportData('keaktifan')]);
            return { siswa: s.data, nilai: n.data, presensi: p.data, keaktifan: k.data };
        }
        return { error: 'Jenis export tidak dikenali.' };
    } catch (e) {
        return { error: e.message || 'Gagal mengambil data export.' };
    }
}

// ── DATA MASTER INIT ────────────────────────────────────────
async function initHalamanDataMaster() {
    tampilkanTabData('siswa');
}

function tampilkanTabData(tab) {
    ['siswa', 'guru', 'wali'].forEach(t => {
        const panel = document.getElementById('dm-panel-' + t);
        const btn = document.getElementById('dm-tab-' + t);
        if (panel) panel.classList.add('hidden');
        if (btn) { btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm'); btn.classList.add('text-slate-500', 'hover:bg-slate-100'); }
    });
    const panel = document.getElementById('dm-panel-' + tab);
    const btn = document.getElementById('dm-tab-' + tab);
    if (panel) panel.classList.remove('hidden');
    if (btn) { btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm'); btn.classList.remove('text-slate-500', 'hover:bg-slate-100'); }

    if (tab === 'siswa' && typeof muatDmSiswa === 'function') muatDmSiswa();
    if (tab === 'guru' && typeof muatDmGuru === 'function') muatDmGuru();
    if (tab === 'wali' && typeof muatDmWali === 'function') muatDmWali();
}

async function muatDmSiswa() {
    const tbody = document.getElementById('dm-tbody-siswa');
    const info = document.getElementById('dm-siswa-info');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-indigo-500 animate-pulse font-semibold">Memuat...</td></tr>';
    try {
        const mengajar = await getDaftarMengajar();
        const kelasAmpu = mengajar.map(m => m.kelas);
        if (kelasAmpu.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-slate-400 font-semibold">Belum ada kelas yang diampu.</td></tr>';
            return;
        }
        // Fetch siswa from semua kelas yang diampu
        const filter = kelasAmpu.map(k => "kelas.eq." + encodeURIComponent(k)).join(",");
        const data = await fetchSupabase("/rest/v1/data_siswa?or=(" + filter + ")&order=kelas,nama_siswa", "GET") || [];
        if (tbody) {
            tbody.innerHTML = data.map((s, i) => `<tr class="hover:bg-slate-50"><td class="py-2 px-3 text-slate-400">${i + 1}</td><td class="py-2 px-3 font-mono text-slate-600">${s.nisn}</td><td class="py-2 px-3 font-semibold text-slate-800">${s.nama_siswa}</td><td class="py-2 px-3 text-slate-600">${s.kelas}</td></tr>`).join('') || '<tr><td colspan="4" class="py-8 text-center text-slate-400">Tidak ada siswa.</td></tr>';
        }
        if (info) info.textContent = `Total: ${data.length} siswa dari ${kelasAmpu.length} kelas yang diampu`;
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-rose-500 font-bold">Gagal: ${err.message}</td></tr>`;
    }
}

function filterDmSiswa() {
    // Simple client-side filter handled by search input
}

// ── QUICK LINKS PAGE INIT ───────────────────────────────────
async function initHalamanQuickLinks() {
    const container = document.getElementById('ql-container');
    if (!container) return;
    container.innerHTML = '<div class="py-10 text-center text-indigo-500 animate-pulse font-semibold">Memuat quick links...</div>';
    try {
        const data = await getQuickLinksData();
        _renderQuickLinksPage(data, container);
    } catch (err) {
        container.innerHTML = `<div class="py-10 text-center text-rose-500 font-bold">Gagal: ${err.message}</div>`;
    }
}

function _renderQuickLinksPage(data, container) {
    const links = (data && data.links) || [];
    if (links.length === 0) {
        container.innerHTML = '<div class="py-10 text-center text-slate-400 font-semibold">Belum ada link. Klik "+ Tambah Link" untuk menambahkan.</div>';
        return;
    }
    const colorMap = { emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', sky: 'bg-sky-50 border-sky-200 text-sky-700', indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700', violet: 'bg-violet-50 border-violet-200 text-violet-700', rose: 'bg-rose-50 border-rose-200 text-rose-700' };
    container.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">${links.map(l => `
        <a href="${l.url}" target="_blank" class="flex items-center gap-3 p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all ${colorMap[l.color] || colorMap.indigo}">
            <i data-lucide="${l.icon || 'link'}" class="w-5 h-5 shrink-0"></i>
            <span class="font-bold text-sm truncate">${l.label}</span>
        </a>`).join('')}</div>`;
    lucide.createIcons();
}

// ── MIGRASI PLACEHOLDER ─────────────────────────────────────
async function jalankanMigrasiPeriode() {
    return { success: true, laporan: ["Migrasi tidak diperlukan pada versi web."] };
}

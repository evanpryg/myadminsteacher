// ============================================================
// API FUNCTIONS - Replaces server-side Code.js functions
// All functions are async and call Supabase directly
// ============================================================

// ── DATA SISWA ──────────────────────────────────────────────
async function getSiswaByKelas(kelas) {
    const data = await fetchSupabase("/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas), "GET");
    if (!data) return [];
    return data.map(s => ({ id_siswa: s.nisn, nama: s.nama_siswa }));
}

async function getNisSiswaAktif() {
    const data = await fetchSupabase("/rest/v1/data_siswa?select=nisn", "GET");
    if (!data) return [];
    return data.map(s => s.nisn);
}

async function importDataSiswaMassal(dataArray) {
    if (!dataArray || dataArray.length === 0) return { berhasil: 0, duplikat: 0, errorList: [] };
    const payload = dataArray.map(d => ({
        nisn: String(d.nis).trim(),
        nama_siswa: String(d.nama).trim(),
        kelas: String(d.kelas).trim(),
        status_aktif: true
    }));
    const res = await fetchSupabase("/rest/v1/data_siswa", "POST", payload, {
        "Prefer": "return=representation,resolution=merge-duplicates"
    });
    if (res) return { berhasil: payload.length, duplikat: 0, errorList: [] };
    return { berhasil: 0, duplikat: 0, errorList: ["Gagal upload massal ke Supabase."] };
}

async function getSemuaSiswa() {
    const data = await fetchSupabase("/rest/v1/data_siswa?order=kelas,nama_siswa", "GET") || [];
    return data.map(s => ({ id: s.id, nisn: s.nisn, nama: s.nama_siswa, kelas: s.kelas }));
}

async function getDaftarKelasUnik() {
    const data = await fetchSupabase("/rest/v1/data_siswa?select=kelas&order=kelas", "GET") || [];
    const unik = {};
    data.forEach(d => { unik[d.kelas] = true; });
    return Object.keys(unik).sort();
}

async function tambahSiswa(nisn, nama, kelas) {
    if (!nisn || !nama || !kelas) return { success: false, message: 'NISN, Nama, dan Kelas wajib diisi.' };
    const existing = await fetchSupabase("/rest/v1/data_siswa?nisn=eq." + encodeURIComponent(nisn), "GET");
    if (existing && existing.length > 0) return { success: false, message: 'NISN ' + nisn + ' sudah terdaftar.' };
    const payload = { nisn: String(nisn).trim(), nama_siswa: String(nama).trim(), kelas: String(kelas).trim(), status_aktif: true };
    const res = await fetchSupabase("/rest/v1/data_siswa", "POST", payload);
    if (res) return { success: true };
    return { success: false, message: 'Gagal menyimpan.' };
}

async function editSiswa(id, nisn, nama, kelas) {
    if (!id) return { success: false, message: 'ID siswa tidak valid.' };
    const payload = { nisn: String(nisn).trim(), nama_siswa: String(nama).trim(), kelas: String(kelas).trim() };
    const res = await fetchSupabase("/rest/v1/data_siswa?id=eq." + id, "PATCH", payload);
    if (res !== null) return { success: true };
    return { success: false, message: 'Gagal mengupdate.' };
}

async function hapusSiswaById(idSiswa) {
    await fetchSupabase("/rest/v1/data_presensi?siswa_id=eq." + idSiswa, "DELETE");
    await fetchSupabase("/rest/v1/log_keaktifan?siswa_id=eq." + idSiswa, "DELETE");
    await fetchSupabase("/rest/v1/buku_nilai_rekap?siswa_id=eq." + idSiswa, "DELETE");
    await fetchSupabase("/rest/v1/data_siswa?id=eq." + idSiswa, "DELETE");
    return { success: true };
}

async function hapusSiswaByNisn(nisn) {
    const data = await fetchSupabase("/rest/v1/data_siswa?nisn=eq." + encodeURIComponent(nisn), "GET");
    if (!data || data.length === 0) return { success: false, message: 'Siswa tidak ditemukan.' };
    return await hapusSiswaById(data[0].id);
}

async function hapusSiswaMassal(nisnArray) {
    if (!nisnArray || nisnArray.length === 0) return { success: true, dihapus: 0 };
    let count = 0;
    for (const nisn of nisnArray) {
        const res = await hapusSiswaByNisn(nisn);
        if (res.success) count++;
    }
    return { success: true, dihapus: count };
}

async function hapusSemuaSiswa() {
    await fetchSupabase("/rest/v1/data_presensi?id=gt.0", "DELETE");
    await fetchSupabase("/rest/v1/log_keaktifan?id=gt.0", "DELETE");
    await fetchSupabase("/rest/v1/buku_nilai_rekap?id=gt.0", "DELETE");
    await fetchSupabase("/rest/v1/data_siswa?id=gt.0", "DELETE");
    return { success: true };
}

// ── PENGATURAN MENGAJAR ─────────────────────────────────────
async function getDaftarMengajar() {
    const data = await fetchSupabase("/rest/v1/pengaturan_mengajar?select=id,kelas,mata_pelajaran", "GET");
    if (!data) return [];
    const unik = {};
    data.forEach(d => { unik[d.kelas + "_" + d.mata_pelajaran] = { _id: d.id, kelas: d.kelas, mapel: d.mata_pelajaran }; });
    return Object.keys(unik).map(k => unik[k]);
}

async function tambahKelasMengajar(kelas, mapel) {
    if (!kelas || !mapel) return { success: false, message: 'Kelas dan Mata Pelajaran wajib diisi.' };
    const existing = await fetchSupabase("/rest/v1/pengaturan_mengajar?kelas=eq." + encodeURIComponent(kelas) + "&mata_pelajaran=eq." + encodeURIComponent(mapel), "GET");
    if (existing && existing.length > 0) return { success: false, message: 'Kelas ' + kelas + ' - ' + mapel + ' sudah ada.' };
    const res = await fetchSupabase("/rest/v1/pengaturan_mengajar", "POST", { kelas, mata_pelajaran: mapel });
    if (res) return { success: true };
    return { success: false, message: 'Gagal menyimpan ke database.' };
}

async function hapusKelasMengajar(id) {
    await fetchSupabase("/rest/v1/pengaturan_mengajar?id=eq." + id, "DELETE");
    return { success: true };
}

// ── PENGATURAN BOBOT ────────────────────────────────────────
async function getPengaturan() {
    const settings = await getMultipleSettings(['GS_BOBOT_BAB', 'GS_BOBOT_HDR', 'GS_BOBOT_AKTF', 'GS_BOBOT_SAS']);
    if (settings.GS_BOBOT_BAB) {
        return { bab: parseInt(settings.GS_BOBOT_BAB), hdr: parseInt(settings.GS_BOBOT_HDR || '10'), aktf: parseInt(settings.GS_BOBOT_AKTF || '10'), sas: parseInt(settings.GS_BOBOT_SAS || '30') };
    }
    return { bab: 50, hdr: 10, aktf: 10, sas: 30 };
}

async function simpanPengaturan(bobot) {
    await setMultipleSettings({
        GS_BOBOT_BAB: String(bobot.bab || 50),
        GS_BOBOT_HDR: String(bobot.hdr || 10),
        GS_BOBOT_AKTF: String(bobot.aktf || 10),
        GS_BOBOT_SAS: String(bobot.sas || 30)
    });
    return { success: true };
}

// ── PRESENSI ────────────────────────────────────────────────
async function getDataPresensiByKelas(kelasTarget) {
    const results = await fetchSupabaseParallel([
        "/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelasTarget),
        "/rest/v1/data_presensi?kelas=eq." + encodeURIComponent(kelasTarget) + "&order=tanggal.asc"
    ]);
    const siswa = results[0] || [];
    const presensi = results[1] || [];

    const idMap = {}, hasilMap = {};
    siswa.forEach(s => {
        idMap[s.id] = s.nisn;
        hasilMap[s.nisn] = { id_siswa: s.nisn, nama: s.nama_siswa, tm: {}, tanggal: {} };
    });

    const tmCounter = {};
    presensi.forEach(p => {
        const nisn = idMap[p.siswa_id];
        if (nisn && hasilMap[nisn]) {
            if (!tmCounter[nisn]) tmCounter[nisn] = 1;
            const tm = tmCounter[nisn];
            hasilMap[nisn].tm[tm] = p.status_hadir;
            hasilMap[nisn].tanggal[tm] = p.tanggal;
            tmCounter[nisn]++;
        }
    });
    return Object.keys(hasilMap).map(k => hasilMap[k]);
}

async function simpanPresensiTMSatuKelas(kelas, tm, tanggalTM, dataPerTM) {
    const siswa = await fetchSupabase("/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas), "GET") || [];
    const idMap = {};
    siswa.forEach(s => { idMap[s.nisn] = s.id; });

    await fetchSupabase("/rest/v1/data_presensi?kelas=eq." + encodeURIComponent(kelas) + "&tanggal=eq." + encodeURIComponent(tanggalTM), "DELETE");

    const payload = [];
    dataPerTM.forEach(s => {
        const db_id = idMap[s.id_siswa];
        if (!db_id || !s.status) return;
        payload.push({ tanggal: tanggalTM, siswa_id: db_id, kelas: kelas, status_hadir: s.status });
    });
    if (payload.length > 0) {
        await fetchSupabase("/rest/v1/data_presensi", "POST", payload);
    }
    return { success: true };
}

async function getPersentaseKehadiranByKelas(kelas) {
    const data = await getDataPresensiByKelas(kelas);
    return data.map(row => {
        let tmB = 0, tmH = 0;
        const keys = Object.keys(row.tm || {});
        keys.forEach(k => { if (row.tm[k]) { tmB++; if (row.tm[k] === 'H' || row.tm[k] === 'I') tmH++; } });
        return { nama: row.nama, persen_hadir: tmB > 0 ? Math.round((tmH / tmB) * 100) : 0 };
    });
}

// ── KEAKTIFAN ───────────────────────────────────────────────
async function simpanKeaktifanMassal(kelas, tanggal, daftarAktivitas) {
    if (!daftarAktivitas || daftarAktivitas.length === 0) return { success: true, disimpan: 0 };
    const siswa = await fetchSupabase("/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas), "GET") || [];
    const nameToIdMap = {};
    siswa.forEach(s => { nameToIdMap[s.nama_siswa.toLowerCase()] = s.id; });

    const payload = [];
    daftarAktivitas.forEach(a => {
        const db_id = nameToIdMap[String(a.nama_siswa).toLowerCase().trim()];
        if (db_id) {
            payload.push({ tanggal, siswa_id: db_id, kelas, poin_keaktifan: parseFloat(a.poin) || 0, catatan: a.aktivitas });
        }
    });
    if (payload.length > 0) await fetchSupabase("/rest/v1/log_keaktifan", "POST", payload);
    return { success: true, disimpan: payload.length };
}

async function getRekapKeaktifan(kelas, tanggalMulai, tanggalAkhir) {
    const results = await fetchSupabaseParallel([
        "/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas),
        "/rest/v1/log_keaktifan?kelas=eq." + encodeURIComponent(kelas) + "&tanggal=gte." + tanggalMulai + "&tanggal=lte." + tanggalAkhir
    ]);
    const siswa = results[0] || [];
    const logs = results[1] || [];

    const idToName = {};
    siswa.forEach(s => { idToName[s.id] = s.nama_siswa; });

    const rekap = {};
    logs.forEach(row => {
        const nama = idToName[row.siswa_id];
        if (!nama) return;
        if (!rekap[nama]) rekap[nama] = { nama, bertanya: 0, menjawab: 0, maju: 0, tidur: 0, gaduh: 0, total_poin: 0 };
        const akt = String(row.catatan).toLowerCase();
        if (akt === 'bertanya') rekap[nama].bertanya++;
        else if (akt === 'menjawab') rekap[nama].menjawab++;
        else if (akt === 'maju') rekap[nama].maju++;
        else if (akt === 'tidur') rekap[nama].tidur++;
        else if (akt === 'gaduh') rekap[nama].gaduh++;
        rekap[nama].total_poin += (row.poin_keaktifan || 0);
    });

    const hasil = Object.keys(rekap).map(k => rekap[k]);
    hasil.sort((a, b) => b.total_poin - a.total_poin);
    return hasil;
}

async function getSiswaDanKeaktifanHariIni(kelas, tanggal) {
    const tglStr = String(tanggal).substring(0, 10);
    const results = await fetchSupabaseParallel([
        "/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas),
        "/rest/v1/log_keaktifan?kelas=eq." + encodeURIComponent(kelas) + "&tanggal=eq." + tglStr
    ]);
    const siswaRaw = results[0] || [];
    const logs = results[1] || [];

    const idToName = {};
    siswaRaw.forEach(s => { idToName[s.id] = s.nama_siswa; });
    const siswa = siswaRaw.map(s => ({ id_siswa: s.nisn, nama: s.nama_siswa }));

    const rekap = {};
    logs.forEach(row => {
        const nama = idToName[row.siswa_id];
        if (!nama) return;
        if (!rekap[nama]) rekap[nama] = { nama, bertanya: 0, menjawab: 0, maju: 0, tidur: 0, gaduh: 0, total_poin: 0 };
        const akt = String(row.catatan).toLowerCase();
        if (akt === 'bertanya') rekap[nama].bertanya++;
        else if (akt === 'menjawab') rekap[nama].menjawab++;
        else if (akt === 'maju') rekap[nama].maju++;
        else if (akt === 'tidur') rekap[nama].tidur++;
        else if (akt === 'gaduh') rekap[nama].gaduh++;
        rekap[nama].total_poin += (row.poin_keaktifan || 0);
    });
    return { siswa, logHariIni: rekap };
}

async function getPersentaseKeaktifanByKelas(kelas) {
    const today = new Date().toISOString().split('T')[0];
    const awal = today.substring(0, 4) + '-01-01';
    const rekap = await getRekapKeaktifan(kelas, awal, today);
    if (!rekap || rekap.length === 0) return [];
    let maxPoin = 0;
    rekap.forEach(s => { if (s.total_poin > maxPoin) maxPoin = s.total_poin; });
    return rekap.map(s => ({ nama: s.nama, persen_keaktifan: maxPoin > 0 ? Math.round((s.total_poin / maxPoin) * 100) : 0 }));
}

async function importRekapHdrDanAktf(kelas) {
    const [hadir, aktf] = await Promise.all([getPersentaseKehadiranByKelas(kelas), getPersentaseKeaktifanByKelas(kelas)]);
    const mapHadir = {}, mapAktf = {};
    hadir.forEach(s => { mapHadir[s.nama] = s.persen_hadir; });
    aktf.forEach(s => { mapAktf[s.nama] = s.persen_keaktifan; });
    return { kehadiran: mapHadir, keaktifan: mapAktf };
}

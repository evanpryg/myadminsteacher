// ============================================================
// JADWAL SEKOLAH — akses data (tabel jadwal_sekolah)
// ============================================================

const JS_PERIODE_KEY = 'GS_JADWAL_PERIODE';

let _jsCache = null;          // seluruh slot (dipakai lintas tampilan)
let _jsPeriode = '';

async function jsMuatSemua(paksa) {
    if (_jsCache && !paksa) return _jsCache;
    const data = await fetchSupabase('/rest/v1/jadwal_sekolah?select=*&order=hari_idx,jam_mulai', 'GET');
    _jsCache = jsSilangkanKelas(data || []);
    try { _jsPeriode = await getAppSetting(JS_PERIODE_KEY, ''); } catch (e) { _jsPeriode = ''; }
    return _jsCache;
}

function jsPeriodeAktif() { return _jsPeriode; }

/**
 * Pemulihan silang guru <-> kelas.
 *
 * Di PDF jadwal guru, blok "Elective Courses"/"SEP" dicetak aSc sebagai satu
 * sel lebar berisi SEMUA guru & kelas sekaligus, sehingga nama kelas milik
 * guru ybs ikut tercemar teks tetangganya (ditandai jenis 'paralel').
 * PDF jadwal kelas menyimpan jawaban pastinya: kelas mana saja yang diajar
 * kode guru itu pada hari & jam yang sama. Begitu pula sebaliknya untuk slot
 * kelas yang kode gurunya tidak terbaca.
 *
 * Hanya memperbaiki nilai tampilan di memori; baris di database tidak diubah.
 */
function jsSilangkanKelas(semua) {
    const kunci = s => s.hari_idx + '|' + s.jam_mulai;

    const perKode = {};   // kode guru -> hari|jam -> daftar kelas
    semua.forEach(s => {
        if (s.sumber !== 'kelas' || !s.kode_guru || !jsAdalahKelas(s.pemilik)) return;
        const p = perKode[s.kode_guru] || (perKode[s.kode_guru] = {});
        (p[kunci(s)] = p[kunci(s)] || []).push(s.pemilik);
    });

    semua.forEach(s => {
        if (s.sumber !== 'guru' || s.jenis === 'piket') return;
        if (s.jenis !== 'paralel' && s.kelas) return;
        const k = (perKode[s.pemilik] || {})[kunci(s)];
        if (!k || !k.length) return;
        s.kelas = k.join(', ');
        if (s.jenis === 'paralel') s.jenis = k.length > 1 ? 'paralel' : 'mengajar';
        s.silang = true;
    });

    const perKelas = {};  // nama kelas -> hari|jam -> kode guru
    semua.forEach(s => {
        if (s.sumber !== 'guru' || s.jenis === 'piket' || !s.kelas) return;
        s.kelas.split(/[,/]/).forEach(nm => {
            nm = nm.trim();
            if (!nm) return;
            const p = perKelas[nm] || (perKelas[nm] = {});
            if (!p[kunci(s)]) p[kunci(s)] = s.pemilik;
        });
    });

    semua.forEach(s => {
        if (s.sumber !== 'kelas' || s.kode_guru || s.jenis === 'piket') return;
        const kode = (perKelas[s.pemilik] || {})[kunci(s)];
        if (!kode) return;
        s.kode_guru = kode;
        s.silang = true;
    });

    return semua;
}

// Ganti seluruh jadwal utk satu sumber ('guru'/'kelas') dgn data baru.
// Dikirim bertahap supaya ribuan baris tidak menabrak batas payload.
async function jsGantiJadwal(sumber, slot, periode, onProgress) {
    await fetchSupabase('/rest/v1/jadwal_sekolah?sumber=eq.' + encodeURIComponent(sumber), 'DELETE');
    let terkirim = 0;
    for (let i = 0; i < slot.length; i += 200) {
        const bagian = slot.slice(i, i + 200).map(s => ({
            sumber: s.sumber, pemilik: s.pemilik, pemilik_nama: s.pemilik_nama || '',
            hari: s.hari, hari_idx: s.hari_idx, jam_ke: s.jam_ke || '',
            jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai,
            mapel: s.mapel || '', kode_guru: s.kode_guru || '', kelas: s.kelas || '',
            jenis: s.jenis || 'mengajar', periode: periode || ''
        }));
        const res = await fetchSupabase('/rest/v1/jadwal_sekolah', 'POST', bagian);
        if (res === null) throw new Error('Gagal menyimpan jadwal: ' + (_lastSupabaseError || 'unknown'));
        terkirim += bagian.length;
        if (onProgress) onProgress(terkirim, slot.length);
    }
    if (periode) await setAppSetting(JS_PERIODE_KEY, periode);
    _jsCache = null;
    return terkirim;
}

// ---------- Turunan yang dipakai tampilan ----------

// PDF "jadwal kelas" dari sekolah juga memuat jadwal RUANGAN (RA1E, RB2, 1B,
// OFFICE, ...) di halaman yang sama. Rombel asli selalu diawali X / XI / XII.
function jsAdalahKelas(nama) {
    return /^XII\b|^XI\b|^X\b|^X\d/i.test(String(nama || '').trim());
}

function jsDaftarKelas(semua, ikutRuangan) {
    return [...new Set(semua.filter(s => s.sumber === 'kelas').map(s => s.pemilik))]
        .filter(n => ikutRuangan || jsAdalahKelas(n))
        .sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }));
}

function jsDaftarGuru(semua) {
    const map = {};
    semua.filter(s => s.sumber === 'guru').forEach(s => {
        if (!map[s.pemilik]) map[s.pemilik] = { kode: s.pemilik, nama: s.pemilik_nama || '' };
        else if (!map[s.pemilik].nama && s.pemilik_nama) map[s.pemilik].nama = s.pemilik_nama;
    });
    return Object.values(map).sort((a, b) =>
        (a.nama || a.kode).localeCompare(b.nama || b.kode, 'id', { sensitivity: 'base' }));
}

// Semua blok waktu unik (utk pemilih jam)
function jsDaftarJam(semua) {
    const map = {};
    semua.forEach(s => { map[s.jam_mulai + '-' + s.jam_selesai] = { mulai: s.jam_mulai, selesai: s.jam_selesai, jam_ke: s.jam_ke }; });
    return Object.values(map).sort((a, b) => a.mulai.localeCompare(b.mulai));
}

function jsHariIniIdx() {
    const d = new Date().getDay();          // 0=Minggu
    return d === 0 ? -1 : d - 1;            // 0=Senin..5=Sabtu, -1 = Minggu
}

function jsJamSekarang() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function jsSlotBerlangsung(semua, hariIdx, jam) {
    return semua.filter(s => s.hari_idx === hariIdx && s.jam_mulai <= jam && jam < s.jam_selesai);
}

/**
 * Guru yang TIDAK ada jadwal pada hari+jam tsb.
 * Guru yang sedang piket ditandai agar tidak dianggap benar-benar bebas.
 */
function jsGuruAvailable(semua, hariIdx, jamMulai, jamSelesai) {
    const guru = jsDaftarGuru(semua);
    const bentrok = {};
    semua.filter(s => s.sumber === 'guru' && s.hari_idx === hariIdx)
        .forEach(s => {
            // tumpang tindih waktu
            if (s.jam_mulai < jamSelesai && jamMulai < s.jam_selesai) {
                (bentrok[s.pemilik] = bentrok[s.pemilik] || []).push(s);
            }
        });
    const bebas = [], piket = [], sibuk = [];
    guru.forEach(g => {
        const b = bentrok[g.kode];
        if (!b || b.length === 0) bebas.push(g);
        else if (b.every(x => x.jenis === 'piket')) piket.push(Object.assign({}, g, { info: b[0].mapel + (b[0].kelas ? ' · ' + b[0].kelas : '') }));
        else sibuk.push(Object.assign({}, g, { info: b.map(x => (x.mapel || '') + (x.kelas ? ' (' + x.kelas + ')' : '')).join(', ') }));
    });
    return { bebas: bebas, piket: piket, sibuk: sibuk };
}

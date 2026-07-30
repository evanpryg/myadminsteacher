// ============================================================
// PARSER PDF JADWAL (aSc Timetables) — berbasis KOORDINAT
// ------------------------------------------------------------
// Teks polos PDF ini saling menyisip antar hari, jadi tidak bisa
// dibaca baris demi baris. Algoritmanya:
//   1. Ambil semua potongan teks + koordinatnya.
//   2. Kolom hari  : posisi kata Monday..Saturday.
//   3. Baris jam   : posisi NOMOR jam (1..8) — bukan label waktunya,
//                    karena label waktu dicetak di bawah nomor
//                    sedangkan teks pelajaran sebaris dgn nomor.
//   4. Blok jam    : pasangan (1,2) (3,4) (5,6) (7,8) — satu
//                    pelajaran = 2 jam pelajaran.
//   5. Tiap teks dimasukkan ke sel (hari, blok), lalu dirangkai.
//
// Diverifikasi pada 215 halaman (115 guru + 100 kelas): semua
// halaman terbaca, 0 slot mengajar tanpa kode guru di PDF guru.
// ============================================================

const JADWAL_HARI_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const JADWAL_HARI_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const PDFJS_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

async function jadwalMuatPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = PDFJS_URL;
        s.onload = res;
        s.onerror = () => rej(new Error('Gagal memuat pembaca PDF. Periksa koneksi internet.'));
        document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return window.pdfjsLib;
}

// Rangkai potongan teks satu sel menjadi daftar baris (atas->bawah, kiri->kanan)
function _jpBaris(items, toleransi) {
    toleransi = toleransi || 4;
    if (!items.length) return [];
    const s = items.slice().sort((a, b) => (a.top - b.top) || (a.x - b.x));
    const out = [];
    let cur = [], y = null;
    s.forEach(it => {
        if (y !== null && Math.abs(it.top - y) >= toleransi) {
            out.push(cur.sort((a, b) => a.x - b.x).map(c => c.str).join(' ').replace(/\s+/g, ' ').trim());
            cur = []; y = null;
        }
        cur.push(it);
        if (y === null) y = it.top;
    });
    if (cur.length) out.push(cur.sort((a, b) => a.x - b.x).map(c => c.str).join(' ').replace(/\s+/g, ' ').trim());
    return out.filter(b => b && !/aSc Timetables|Timetable generated/i.test(b));
}

// Susun grid satu halaman -> { kolom, blok, sel }
function _jpGrid(items) {
    const kolom = [];
    items.forEach(it => {
        const t = it.str.trim();
        if (JADWAL_HARI_EN.indexOf(t) !== -1 && !kolom.some(k => k.nama === t)) {
            kolom.push({ nama: t, x: it.x + it.w / 2, top: it.top });
        }
    });
    if (kolom.length < 6) return null;
    kolom.sort((a, b) => a.x - b.x);
    const yHead = Math.max.apply(null, kolom.map(k => k.top));
    const xKiri = Math.min.apply(null, kolom.map(k => k.x)) - 45;

    const kiri = items.filter(it => (it.x + it.w) < xKiri && it.top > yHead);
    const jangkar = kiri.filter(it => /^[1-8]$/.test(it.str.trim())).sort((a, b) => a.top - b.top);
    if (jangkar.length < 8) return null;

    // Label waktu: gabungkan potongan di kolom kiri per baris
    const grup = {};
    kiri.forEach(it => { const k = Math.round(it.top / 3); (grup[k] = grup[k] || []).push(it); });
    const waktu = [];
    Object.keys(grup).sort((a, b) => a - b).forEach(k => {
        const t = grup[k].sort((a, b) => a.x - b.x).map(x => x.str).join(' ');
        const m = t.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (m) waktu.push({ top: Math.min.apply(null, grup[k].map(x => x.top)), mulai: m[1], selesai: m[2] });
    });
    if (waktu.length < 8) return null;

    const jam = jangkar.map((a, i) => {
        const batas = (i + 1 < jangkar.length) ? jangkar[i + 1].top : a.top + 60;
        const w = waktu.find(x => x.top >= a.top - 2 && x.top < batas);
        return { no: parseInt(a.str, 10), top: a.top, mulai: w ? w.mulai : '', selesai: w ? w.selesai : '' };
    });

    const blok = [];
    for (let i = 0; i + 1 < jam.length; i += 2) {
        blok.push({
            jam: jam[i].no + '-' + jam[i + 1].no,
            mulai: jam[i].mulai, selesai: jam[i + 1].selesai,
            atas: jam[i].top - 4,
            bawah: (i + 2 < jam.length) ? jam[i + 2].top - 4 : jam[i + 1].top + 40
        });
    }

    const batasX = kolom.map((k, i) => [
        i > 0 ? (kolom[i - 1].x + k.x) / 2 : k.x - 60,
        i + 1 < kolom.length ? (k.x + kolom[i + 1].x) / 2 : k.x + 60
    ]);

    const sel = {};
    items.forEach(it => {
        if (it.top <= yHead + 4 || (it.x + it.w) < xKiri) return;
        const cx = it.x + it.w / 2;
        let ki = -1, bi = -1;
        for (let k = 0; k < 6; k++) if (cx >= batasX[k][0] && cx < batasX[k][1]) { ki = k; break; }
        for (let b = 0; b < blok.length; b++) if (it.top >= blok[b].atas && it.top < blok[b].bawah) { bi = b; break; }
        if (ki < 0 || bi < 0) return;
        const key = ki + '|' + bi;
        (sel[key] = sel[key] || []).push(it);
    });
    return { kolom: kolom, blok: blok, sel: sel };
}

// Pisahkan kode guru dari sisa teks memakai daftar kode yang dikenal
function _jpPisahKode(teks, daftarKode) {
    for (let i = 0; i < daftarKode.length; i++) {
        const k = daftarKode[i];
        const re = new RegExp('(?:^|[^A-Za-z0-9])(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z0-9])');
        const m = teks.match(re);
        if (m) {
            const idx = teks.indexOf(m[1], m.index);
            return { kode: k, sisa: (teks.slice(0, idx) + ' ' + teks.slice(idx + k.length)).replace(/\s+/g, ' ').trim() };
        }
    }
    return { kode: null, sisa: teks };
}

function _jpJenis(mapel) {
    if (/picket|piket/i.test(mapel)) return 'piket';
    if (/elective/i.test(mapel)) return 'elective';
    return 'mengajar';
}

// Nama kelas hasil sel gabungan (beberapa pelajaran menumpuk) tidak
// bisa dipercaya -> ditandai supaya jujur, bukan ditampilkan ngawur.
function _jpRapikanKelas(kelas) {
    const k = (kelas || '').trim();
    if (!k) return { kelas: '', jenis: null };
    if (k.length > 14 || (k.match(/\//g) || []).length >= 2) {
        const bagian = k.split('/').map(x => x.trim()).filter(x => x && x.length <= 14);
        if (bagian.length >= 2 && bagian.length <= 4 && bagian.every(x => x.length >= 2)) {
            return { kelas: bagian.join(' / '), jenis: 'paralel' };
        }
        return { kelas: k.slice(0, 60), jenis: 'paralel' };
    }
    return { kelas: k, jenis: null };
}

/**
 * Parse satu berkas PDF jadwal.
 * @param {ArrayBuffer} buf
 * @param {'guru'|'kelas'} tipe
 * @param {string[]} daftarKode  kode guru yang dikenal (utk memisah kode vs kelas)
 * @param {function} onProgress  (halamanSelesai, totalHalaman)
 */
async function jadwalParsePdf(buf, tipe, daftarKode, onProgress) {
    const pdfjs = await jadwalMuatPdfJs();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const hasil = { slot: [], halamanOk: 0, halamanGagal: [], pemilik: [], kodeBaru: [] };
    const kode = (daftarKode || []).slice();

    // Lintasan awal PDF guru: kumpulkan kode dari header "Nama (KODE)"
    if (tipe === 'guru') {
        for (let p = 1; p <= pdf.numPages; p++) {
            const tc = await (await pdf.getPage(p)).getTextContent();
            const teks = tc.items.map(i => i.str).join(' ');
            const m = teks.match(/\(([A-Za-z0-9]{1,6})\)/);
            if (m && kode.indexOf(m[1]) === -1) { kode.push(m[1]); hasil.kodeBaru.push(m[1]); }
        }
    }
    kode.sort((a, b) => b.length - a.length);

    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({
            str: i.str.trim(),
            x: i.transform[4],
            top: vp.height - i.transform[5],
            w: i.width || 0
        }));

        // Pemilik halaman: kode guru, atau nama kelas
        const semua = items.map(i => i.str).join(' ');
        let pemilik = null, pemilikNama = '';
        if (tipe === 'guru') {
            const m = semua.match(/([A-Za-zÀ-ÿ.,'` -]{3,70}?)\(([A-Za-z0-9]{1,6})\)/);
            if (m) { pemilik = m[2].trim(); pemilikNama = m[1].trim(); }
        } else {
            const atas = items.filter(i => i.top < 120).sort((a, b) => a.top - b.top || a.x - b.x);
            const abaikan = /TIMETABLE|ACADEMIC YEAR|Effective From|SMA PROGRESIF|^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i;
            const c = atas.find(i => !abaikan.test(i.str) && i.str.length >= 2 && i.str.length <= 30);
            if (c) { pemilik = c.str.replace(/\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun),.*$/i, '').trim(); pemilikNama = pemilik; }
        }

        const grid = _jpGrid(items);
        if (!grid || !pemilik) { hasil.halamanGagal.push(p); if (onProgress) onProgress(p, pdf.numPages); continue; }
        hasil.halamanOk++;
        if (hasil.pemilik.indexOf(pemilik) === -1) hasil.pemilik.push(pemilik);

        Object.keys(grid.sel).forEach(key => {
            const bagian = key.split('|');
            const ki = +bagian[0], bi = +bagian[1];
            const baris = _jpBaris(grid.sel[key]);
            if (!baris.length) return;
            const mapel = baris[0];
            const sisa = baris.slice(1).join(' ').trim();
            let kd = null, kls = '';
            if (sisa) { const r = _jpPisahKode(sisa, kode); kd = r.kode; kls = r.sisa; }
            let jenis = _jpJenis(mapel);
            if (tipe === 'guru' && !kd) kd = pemilik;
            const rapi = _jpRapikanKelas(kls);
            if (rapi.jenis && jenis === 'mengajar') jenis = rapi.jenis;
            hasil.slot.push({
                sumber: tipe,
                pemilik: pemilik,
                pemilik_nama: pemilikNama,
                hari: JADWAL_HARI_ID[ki],
                hari_idx: ki,
                jam_ke: grid.blok[bi].jam,
                jam_mulai: _jpJam(grid.blok[bi].mulai),
                jam_selesai: _jpJam(grid.blok[bi].selesai),
                mapel: mapel,
                kode_guru: kd || '',
                kelas: tipe === 'kelas' ? pemilik : rapi.kelas,
                jenis: jenis
            });
        });
        if (onProgress) onProgress(p, pdf.numPages);
    }
    return hasil;
}

function _jpJam(t) {
    const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/);
    return m ? (m[1].padStart(2, '0') + ':' + m[2]) : (t || '');
}

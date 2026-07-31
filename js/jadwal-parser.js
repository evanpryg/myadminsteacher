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
//   4. Batas sel   : diambil dari GAMBAR halaman, bukan ditebak.
//                    PDF guru menandai pelajaran dengan kotak
//                    berwarna, PDF kelas dengan garis pembatas per
//                    kolom -> keduanya dibaca dari operator list.
//   5. Tiap teks dimasukkan ke selnya, lalu tepi atas & bawah sel
//      dipetakan ke nomor jam -> panjang pelajaran didapat apa
//      adanya (1, 2, 3, atau 4 JP).
//
// CATATAN: versi awal mengunci "1 pelajaran = 2 JP" (pasangan 1-2,
// 3-4, ...). Itu salah: pada PDF sekolah ini 171 sel berdurasi 1 JP,
// 9 sel 3 JP, dan 35 sel 4 JP.
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

// Geometri halaman: kotak berwarna (sel terisi) + garis pembatas.
// Diambil dari operator list karena teks saja tidak memberi tahu
// sampai mana satu pelajaran membentang.
async function _jpBentuk(page, vp) {
    const L = window.pdfjsLib, OPS = L.OPS, U = L.Util;
    const ol = await page.getOperatorList();
    const IDENT = [1, 0, 0, 1, 0, 0];
    let ctm = IDENT.slice();
    const tumpuk = [];
    const isi = [], garis = [];
    let bb = null;

    for (let i = 0; i < ol.fnArray.length; i++) {
        const fn = ol.fnArray[i];
        if (fn === OPS.save) { tumpuk.push(ctm.slice()); continue; }
        if (fn === OPS.restore) { ctm = tumpuk.pop() || IDENT.slice(); continue; }
        if (fn === OPS.transform) { ctm = U.transform(ctm, Array.from(ol.argsArray[i])); continue; }
        if (fn === OPS.constructPath) {
            const c = ol.argsArray[i][1] || [];
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (let k = 0; k + 1 < c.length; k += 2) {
                const p = U.applyTransform([c[k], c[k + 1]], ctm);
                if (p[0] < x0) x0 = p[0];
                if (p[0] > x1) x1 = p[0];
                if (p[1] < y0) y0 = p[1];
                if (p[1] > y1) y1 = p[1];
            }
            // y PDF dihitung dari bawah; disamakan dgn koordinat teks
            bb = (x0 <= x1) ? { x0: x0, x1: x1, atas: vp.height - y1, bawah: vp.height - y0 } : null;
            continue;
        }
        if (!bb) continue;
        const tinggi = bb.bawah - bb.atas, lebar = bb.x1 - bb.x0;
        if (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.fillStroke || fn === OPS.eoFillStroke) {
            if (tinggi > 4 && lebar > 20) isi.push(bb);
        }
        if (fn === OPS.stroke || fn === OPS.fillStroke || fn === OPS.eoFillStroke) {
            if (tinggi < 2 && lebar > 20) garis.push({ y: (bb.atas + bb.bawah) / 2, x0: bb.x0, x1: bb.x1 });
        }
    }
    return { isi: isi, garis: garis };
}

// Susun grid satu halaman -> { kolom, jam, sel }
function _jpGrid(items, bentuk) {
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

    // Tinggi 1 JP = jarak terkecil antar nomor jam berurutan (jarak
    // terbesar adalah jeda istirahat, jadi bukan itu yang dipakai).
    let jp = Infinity;
    for (let i = 1; i < jam.length; i++) jp = Math.min(jp, jam[i].top - jam[i - 1].top);
    if (!isFinite(jp) || jp < 5) return null;

    // Nomor jam dicetak sedikit di bawah garis pembatas barisnya.
    // Selisihnya diukur dari gambar, tidak ditebak.
    const semuaY = bentuk.garis.map(g => g.y);
    bentuk.isi.forEach(r => { semuaY.push(r.atas); semuaY.push(r.bawah); });
    let off = jp * 0.08;
    const dekat = semuaY.filter(y => Math.abs(y - jam[0].top) < jp * 0.4);
    if (dekat.length) {
        const t = dekat.reduce((a, b) => Math.abs(b - jam[0].top) < Math.abs(a - jam[0].top) ? b : a);
        off = jam[0].top - t;
    }
    const tepiBaris = (i) => jam[i].top - off;
    const gridAtas = tepiBaris(0);
    const gridBawah = tepiBaris(jam.length - 1) + jp;

    // Tepi sel -> indeks jam terdekat
    const idxJam = (y) => {
        let best = 0, d = Infinity;
        for (let i = 0; i < jam.length; i++) {
            const dd = Math.abs(tepiBaris(i) - y);
            if (dd < d) { d = dd; best = i; }
        }
        return best;
    };

    const batasX = kolom.map((k, i) => [
        i > 0 ? (kolom[i - 1].x + k.x) / 2 : k.x - 60,
        i + 1 < kolom.length ? (k.x + kolom[i + 1].x) / 2 : k.x + 60
    ]);

    // Batas mendatar tiap kolom hari, dari kotak & garis yang benar-benar
    // melintasi kolom itu. Inilah yang menentukan panjang pelajaran.
    kolom.forEach((k) => {
        const cx = k.x;
        const ys = [gridAtas, gridBawah];
        bentuk.garis.forEach(g => { if (g.x0 <= cx - 5 && g.x1 >= cx + 5) ys.push(g.y); });

        // Kotak berwarna = satu pelajaran utuh. aSc tetap menggambar
        // garis pemisah baris di bawahnya, jadi garis yang jatuh DI DALAM
        // kotak harus dibuang -- kalau tidak, pelajaran 2 JP terbelah
        // menjadi dua pelajaran 1 JP.
        const kotak = bentuk.isi.filter(r => r.x0 <= cx && r.x1 >= cx &&
            r.bawah > gridAtas - 2 && r.atas < gridBawah + 2);
        kotak.forEach(r => { ys.push(r.atas); ys.push(r.bawah); });

        k.batas = ys
            .filter(y => y >= gridAtas - 2 && y <= gridBawah + 2)
            .filter(y => !kotak.some(r => y > r.atas + 2 && y < r.bawah - 2))
            .sort((a, b) => a - b)
            .filter((y, i, a) => i === 0 || y - a[i - 1] > 2);
    });

    const sel = {};
    items.forEach(it => {
        if (it.top <= yHead + 4 || (it.x + it.w) < xKiri) return;
        const cx = it.x + it.w / 2;
        let ki = -1;
        for (let k = 0; k < 6; k++) if (cx >= batasX[k][0] && cx < batasX[k][1]) { ki = k; break; }
        if (ki < 0) return;
        const b = kolom[ki].batas;
        let ci = -1;
        for (let j = 0; j + 1 < b.length; j++) if (it.top >= b[j] - 1 && it.top < b[j + 1] - 1) { ci = j; break; }
        if (ci < 0) return;
        const key = ki + '|' + ci;
        if (!sel[key]) {
            const dari = idxJam(b[ci]);
            let sampai = idxJam(b[ci + 1] - jp);
            if (sampai < dari) sampai = dari;
            sel[key] = { items: [], dari: dari, sampai: sampai };
        }
        sel[key].items.push(it);
    });
    return { kolom: kolom, jam: jam, sel: sel };
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
    const hasil = { slot: [], halamanOk: 0, halamanGagal: [], pemilik: [], kodeBaru: [], jam: [] };
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

        const bentuk = await _jpBentuk(page, vp);
        const grid = _jpGrid(items, bentuk);
        if (!grid || !pemilik) { hasil.halamanGagal.push(p); if (onProgress) onProgress(p, pdf.numPages); continue; }
        hasil.halamanOk++;
        if (hasil.pemilik.indexOf(pemilik) === -1) hasil.pemilik.push(pemilik);
        // Tabel jam sekolah (jam ke-1..8 beserta waktunya). Diambil sekali
        // saja; tanpa ini tampilan tidak tahu jam ke-2 mulai pukul berapa,
        // karena hampir semua pelajaran 2 JP sehingga jam ke-2 tidak pernah
        // menjadi awal pelajaran manapun.
        if (!hasil.jam.length) {
            hasil.jam = grid.jam.map(j => ({ no: j.no, mulai: _jpJam(j.mulai), selesai: _jpJam(j.selesai) }));
        }

        Object.keys(grid.sel).forEach(key => {
            const ki = +key.split('|')[0];
            const s = grid.sel[key];
            const jamDari = grid.jam[s.dari], jamSampai = grid.jam[s.sampai];
            const baris = _jpBaris(s.items);
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
                jam_ke: jamDari.no === jamSampai.no ? String(jamDari.no) : (jamDari.no + '-' + jamSampai.no),
                jam_mulai: _jpJam(jamDari.mulai),
                jam_selesai: _jpJam(jamSampai.selesai),
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

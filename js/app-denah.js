// ============================================================
// DENAH SEKOLAH (halaman tersendiri di sidebar)
// ------------------------------------------------------------
// Model data sengaja TIDAK memakai koordinat/piksel, karena denah
// sekolah jarang rapi. Yang dipakai:
//
//   Gedung -> Lantai -> Sisi -> daftar ITEM berurutan
//
// - Sisi punya "posisi" (atas/bawah/kiri/kanan) -> membentuk U/L/I
// - ITEM = ruangan ATAU tangga, ditulis berurutan sesuai kenyataan.
//   Tangga cukup disisipkan di antara ruangan; SEGMEN terbentuk
//   sendiri, jadi tidak perlu didefinisikan manual.
// - Ruangan punya "ukuran" relatif (1-4). Lebar digambar
//   proporsional, sehingga sisi berisi 3 ruang besar dan sisi lain
//   berisi 4 ruang kecil sama-sama pas tanpa ukuran meter.
// - Satu ruangan bisa ditempati LEBIH DARI SATU kelas (field
//   `kelas: []`). Kalau field itu kosong, nama ruangan sendiri yang
//   dicocokkan ke data kelas -- perilaku denah lama tetap jalan.
//
// Disimpan sebagai JSON di app_settings (tanpa migration baru).
// ============================================================

const DENAH_KEY = 'GS_DENAH_SEKOLAH';

const DENAH_UKURAN = [
    { v: 1, label: 'Kecil' },
    { v: 2, label: 'Sedang' },
    { v: 3, label: 'Besar' },
    { v: 4, label: 'Sangat Besar' }
];

const DENAH_JENIS = {
    kelas:     { label: 'Ruang Kelas',    cls: 'bg-indigo-100 border-indigo-300 text-indigo-900' },
    lab:       { label: 'Laboratorium',   cls: 'bg-emerald-100 border-emerald-300 text-emerald-900' },
    kantor:    { label: 'Kantor / Guru',  cls: 'bg-amber-100 border-amber-300 text-amber-900' },
    ibadah:    { label: 'Ibadah',         cls: 'bg-teal-100 border-teal-300 text-teal-900' },
    fasilitas: { label: 'Fasilitas Lain', cls: 'bg-slate-200 border-slate-300 text-slate-700' }
};

const DENAH_POSISI = [
    { v: 'atas',  label: 'Atas — menghadap selatan' },
    { v: 'bawah', label: 'Bawah — menghadap utara' },
    { v: 'kiri',  label: 'Kiri — menghadap timur' },
    { v: 'kanan', label: 'Kanan — menghadap barat' }
];

let _denah = null;
let _denahG = 0;              // index gedung aktif
let _denahL = 0;              // index lantai aktif
let _denahMode = 'lihat';     // lihat | edit
let _denahBelumSimpan = false;
let _denahKelasInfo = {};     // nama kelas (lowercase) -> { total_siswa, nama_wali }
let _denahDaftarKelas = [];

// ── Kelas penghuni ruangan ──────────────────────────────────
// Daftar kelas yang menempati satu ruangan. Data lama tidak punya
// field `kelas`, jadi nama ruangan dipakai sebagai penggantinya.
function _denahKelasRuang(it) {
    const arr = Array.isArray(it.kelas)
        ? it.kelas.map(x => String(x || '').trim()).filter(Boolean) : [];
    if (arr.length) return arr;
    const nm = String(it.nama || '').trim();
    return (nm && _denahInfoKelas(nm)) ? [nm] : [];
}

function _denahInfoKelas(nama) {
    return _denahKelasInfo[String(nama || '').toLowerCase().trim()] || null;
}

// ── Muat & simpan ───────────────────────────────────────────
async function initHalamanDenah() {
    const canvas = document.getElementById('denah-canvas');
    if (canvas) canvas.innerHTML = '<div class="py-12 text-center text-indigo-500 animate-pulse font-semibold text-sm">Memuat denah...</div>';
    try {
        const raw = await getAppSetting(DENAH_KEY, '');
        _denah = raw ? JSON.parse(raw) : null;
    } catch (e) { _denah = null; }

    // Info kelas utk ditautkan ke ruangan (nama ruang = nama kelas)
    try {
        const [wali, kelas] = await Promise.all([
            getDataWaliKelas().catch(() => []),
            getDaftarKelasUnik().catch(() => [])
        ]);
        _denahKelasInfo = {};
        (wali || []).forEach(w => { _denahKelasInfo[String(w.kelas || '').toLowerCase().trim()] = w; });
        _denahDaftarKelas = kelas || [];
    } catch (e) { /* opsional */ }

    _denahG = 0; _denahL = 0; _denahMode = 'lihat'; _denahBelumSimpan = false;
    renderDenah();
}

async function simpanDenah() {
    const btn = document.getElementById('denah-btn-simpan');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
        await setAppSetting(DENAH_KEY, JSON.stringify(_denah));
        _denahBelumSimpan = false;
        renderDenah();
        alert('✅ Denah tersimpan.');
    } catch (err) {
        alert('Gagal menyimpan: ' + (err.message || err));
    }
    if (btn) { btn.disabled = false; }
}

function _denahUbah() { _denahBelumSimpan = true; renderDenah(); }

// ── Kerangka otomatis (sesuai kondisi sekolah) ──────────────
function buatKerangkaDenah() {
    if (_denah && !confirm('Denah lama akan diganti kerangka baru. Lanjutkan?')) return;
    const R = (kode) => ({ t: 'ruang', nama: kode, jenis: 'kelas', ukuran: 2 });
    const T = (nama) => ({ t: 'tangga', nama: nama });

    const gedungA = { nama: 'Gedung A', lantai: [] };
    for (let L = 1; L <= 4; L++) {
        let n = 0;
        const kode = () => 'A' + L + String(++n).padStart(2, '0');
        gedungA.lantai.push({
            no: L,
            sisi: [
                { nama: 'Menghadap Selatan', posisi: 'atas', items: [
                    R(kode()), R(kode()), T('Tangga 1'),
                    R(kode()), R(kode()), T('Tangga 2'),
                    R(kode()), R(kode())
                ] },
                { nama: 'Menghadap Timur', posisi: 'kiri', items: [R(kode()), R(kode()), R(kode()), R(kode())] },
                { nama: 'Menghadap Barat', posisi: 'kanan', items: [R(kode()), R(kode()), R(kode())] }
            ]
        });
    }

    const gedungB = { nama: 'Gedung B', lantai: [] };
    for (let L = 1; L <= 3; L++) {
        let n = 0;
        const kode = () => 'B' + L + String(++n).padStart(2, '0');
        gedungB.lantai.push({
            no: L,
            sisi: [
                { nama: 'Menghadap Selatan', posisi: 'atas', items: [
                    R(kode()), R(kode()), R(kode()), T('Tangga'),
                    R(kode()), R(kode()), R(kode())
                ] }
            ]
        });
    }

    _denah = { gedung: [gedungA, gedungB] };
    _denahG = 0; _denahL = 0; _denahMode = 'edit';
    _denahUbah();
}

// ── Pintasan data aktif ─────────────────────────────────────
function _gAktif() { return _denah && _denah.gedung ? _denah.gedung[_denahG] : null; }
function _lAktif() { const g = _gAktif(); return g && g.lantai ? g.lantai[_denahL] : null; }

// ── Render utama ────────────────────────────────────────────
function renderDenah() {
    const toolbar = document.getElementById('denah-toolbar');
    const canvas = document.getElementById('denah-canvas');
    const editor = document.getElementById('denah-editor');
    const info = document.getElementById('denah-info');
    if (!canvas) return;
    if (info) info.innerHTML = '';

    if (!_denah || !_denah.gedung || _denah.gedung.length === 0) {
        if (toolbar) toolbar.innerHTML = '';
        if (editor) editor.innerHTML = '';
        canvas.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <div class="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto"><i data-lucide="map" class="w-7 h-7 text-indigo-500"></i></div>
            <p class="font-bold text-slate-800">Belum ada denah sekolah</p>
            <p class="text-xs text-slate-500 max-w-md mx-auto">Mulai dari kerangka siap pakai: <b>Gedung A</b> (4 lantai · sayap selatan dengan 2 tangga · sayap timur &amp; barat) dan <b>Gedung B</b> (3 lantai · 1 tangga di tengah). Setelah itu Anda tinggal mengganti nama ruangan, ukuran, dan jumlahnya.</p>
            <button onclick="buatKerangkaDenah()" class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm"><i data-lucide="wand-2" class="w-4 h-4"></i>Buat Kerangka Otomatis</button>
        </div>`;
        lucide.createIcons();
        return;
    }

    if (_denahG >= _denah.gedung.length) _denahG = 0;
    const g = _gAktif();
    if (!g.lantai || g.lantai.length === 0) g.lantai = [{ no: 1, sisi: [] }];
    if (_denahL >= g.lantai.length) _denahL = 0;

    // Toolbar: pilih gedung + aksi. Lantai TIDAK dipilih di mode lihat
    // (semua lantai tergambar bertumpuk sekaligus), hanya saat mengelola.
    if (toolbar) {
        const tabGedung = _denah.gedung.map((gd, i) =>
            `<button onclick="denahPilihGedung(${i})" class="px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${i === _denahG ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}">${_esc(gd.nama)}</button>`).join('');
        const chipLantai = g.lantai.map((lt, i) =>
            `<button onclick="denahPilihLantai(${i})" class="w-9 h-9 text-xs font-black rounded-xl transition-all ${i === _denahL ? 'bg-slate-800 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'}">${_esc(lt.no)}</button>`).join('');
        toolbar.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap no-print">
            <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">${tabGedung}</div>
                ${_denahMode === 'edit' ? `<div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kelola Lantai</span>
                    ${chipLantai}
                    <button onclick="denahTambahLantai()" title="Tambah lantai" class="w-9 h-9 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-400"><i data-lucide="plus" class="w-4 h-4 mx-auto"></i></button>
                </div>` : ''}
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                ${_denahBelumSimpan ? '<span class="text-[10px] font-bold text-amber-600">⚠ Belum disimpan</span>' : ''}
                ${_denahMode === 'edit'
                    ? `<button onclick="denahSalinLantai()" class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl"><i data-lucide="copy" class="w-3.5 h-3.5"></i>Salin dari Lantai Lain</button>
                       <button id="denah-btn-simpan" onclick="simpanDenah()" class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"><i data-lucide="save" class="w-3.5 h-3.5"></i>Simpan</button>
                       <button onclick="denahSetMode('lihat')" class="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-2 rounded-xl border">Selesai</button>`
                    : `<button onclick="cetakDenah()" class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl"><i data-lucide="printer" class="w-3.5 h-3.5"></i>Cetak / PDF</button>
                       <button id="denah-btn-png" onclick="unduhDenahPNG()" class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl"><i data-lucide="image-down" class="w-3.5 h-3.5"></i>Unduh Gambar</button>
                       <button onclick="denahSetMode('edit')" class="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Kelola Denah</button>`}
            </div>
        </div>`;
    }

    canvas.innerHTML = _denahGambarGedung(g);
    if (editor) editor.innerHTML = _denahMode === 'edit' ? _denahPanelEditor(_lAktif()) : '';
    lucide.createIcons();
}

function denahPilihGedung(i) { _denahG = i; _denahL = 0; renderDenah(); }
function denahPilihLantai(i) { _denahL = i; renderDenah(); }
function denahSetMode(m) { _denahMode = m; renderDenah(); }

// ── Menggambar denah (SEMUA lantai bertumpuk sekaligus) ─────
// Aturan tumpukan: lantai 1 selalu paling DEKAT halaman, lantai
// berikutnya menjauh. Jadi guru langsung melihat seluruh gedung
// tanpa perlu mengeklik tombol lantai satu per satu.
function _denahBlok(it, li, si, ii, vertikal) {
    if (it.t === 'tangga') {
        // Tangga menempati sel grid tersendiri -> penuhi selnya supaya
        // lurus sejajar dari lantai 1 sampai lantai teratas.
        return `<div title="${_esc(it.nama || 'Tangga')}"
            class="w-full h-full rounded-md border border-dashed border-slate-400 bg-slate-200 flex flex-col items-center justify-center text-slate-500">
            <i data-lucide="chevrons-up" class="w-3 h-3"></i>
            <span class="text-[7px] font-black uppercase leading-none">Tangga</span>
        </div>`;
    }
    const j = DENAH_JENIS[it.jenis] || DENAH_JENIS.fasilitas;
    const u = Math.max(1, Math.min(4, parseInt(it.ukuran, 10) || 2));
    // Ukuran diatur oleh sel segmen (px tetap), blok cukup mengisi
    // proporsional -> ruangan berukuran sama tampil sama besar,
    // baik di sayap mendatar maupun sayap tegak.
    const gaya = `flex:${u} 1 0;min-width:0;min-height:0;`;
    const kls = _denahKelasRuang(it);
    let isi;
    if (kls.length > 1) {
        // Satu ruangan dipakai beberapa kelas -> kotaknya dibagi, supaya
        // langsung terbaca "ruang ini isinya dua rombel", bukan dua ruang.
        const bagi = kls.map(n => {
            const k = _denahInfoKelas(n);
            return `<div class="flex-1 min-w-0 flex flex-col items-center justify-center border border-dashed border-slate-400/60 rounded-sm px-0.5">
                <span class="text-[9px] font-black leading-tight truncate w-full text-center">${_esc(n)}</span>
                ${k ? `<span class="text-[7px] font-bold opacity-70 leading-none">${k.total_siswa}</span>` : ''}
            </div>`;
        }).join('');
        isi = `${it.nama ? `<span class="text-[7px] font-black uppercase opacity-60 leading-none truncate w-full text-center">${_esc(it.nama)}</span>` : ''}
            <div class="w-full flex-1 min-h-0 flex ${vertikal ? 'flex-col' : 'flex-row'} items-stretch gap-0.5 mt-0.5">${bagi}</div>`;
    } else {
        const judul = it.nama || kls[0] || '—';
        const k = _denahInfoKelas(kls[0] || it.nama);
        isi = `<span class="text-[10px] font-black leading-tight truncate w-full">${_esc(judul)}</span>
            ${kls[0] && kls[0] !== judul ? `<span class="text-[8px] font-bold opacity-80 leading-none truncate w-full">${_esc(kls[0])}</span>` : ''}
            ${k ? `<span class="text-[7px] font-bold opacity-70 leading-none">${k.total_siswa} siswa</span>` : ''}`;
    }
    return `<div onclick="denahKlikRuang(${li},${si},${ii})" style="${gaya}"
        class="rounded-md border ${j.cls} px-1 py-1 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all flex flex-col items-center justify-center text-center overflow-hidden">
        ${isi}
    </div>`;
}

// ── Penyelarasan tangga antar lantai ────────────────────────
// Tangga itu bangunan fisik: posisinya TIDAK boleh bergeser antar
// lantai walau jumlah/ukuran ruangan tiap lantai berbeda. Caranya:
// pecah tiap sisi jadi segmen (dipisah tangga), lalu semua lantai
// memakai template grid yang SAMA — lebar tiap segmen diambil dari
// lantai yang paling "berat", sehingga kolom tangga selalu lurus.
const DENAH_TANGGA_PX = 44;   // panjang kolom/baris tangga
const DENAH_DEPTH = 74;       // ketebalan bangunan (seragam utk semua sayap)
const DENAH_UNIT = 44;        // panjang per satuan ukuran ruangan (seragam)

function _pecahSegmen(items) {
    const segs = [{ items: [] }];
    const tangga = [];
    (items || []).forEach((it, ii) => {
        if (it.t === 'tangga') { tangga.push({ it: it, ii: ii }); segs.push({ items: [] }); }
        else segs[segs.length - 1].items.push({ it: it, ii: ii });
    });
    return { segs: segs, tangga: tangga };
}

function _bobotSegmen(seg) {
    return (seg ? seg.items : []).reduce((a, x) =>
        a + Math.max(1, Math.min(4, parseInt(x.it.ukuran, 10) || 2)), 0);
}

function _denahTemplate(lantai, p) {
    const perLantai = lantai.map(l => {
        const s = (l.sisi || []).find(x => x.posisi === p);
        return s ? _pecahSegmen(s.items) : null;
    });
    const isi = perLantai.filter(Boolean);
    const nSeg = isi.length ? Math.max.apply(null, isi.map(x => x.segs.length)) : 1;
    const bobot = [];
    for (let k = 0; k < nSeg; k++) {
        let m = 0;
        isi.forEach(x => { const w = _bobotSegmen(x.segs[k]); if (w > m) m = w; });
        bobot.push(m || 1);
    }
    // Ukuran segmen dalam PIKSEL TETAP (bukan fr) supaya ruangan
    // berukuran sama selalu tampil sama besar; kalau jumlah ruangan
    // antar lantai tidak sama, hanya lantai yg lebih sedikit itu yang
    // ruangannya melebar mengisi segmen.
    const kol = [];
    bobot.forEach((b, k) => { if (k > 0) kol.push(DENAH_TANGGA_PX + 'px'); kol.push((b * DENAH_UNIT) + 'px'); });
    const total = bobot.reduce((a, b) => a + b, 0);
    const panjang = total * DENAH_UNIT + (nSeg - 1) * DENAH_TANGGA_PX + (nSeg * 2 - 1) * 4;
    return { nSeg: nSeg, template: kol.join(' '), panjang: panjang };
}

// Satu strip = satu sisi pada satu lantai, memakai template bersama
function _denahStrip(s, si, li, no, vertikal, tpl, disorot) {
    const pecah = _pecahSegmen(s.items);
    const sel = [];
    for (let k = 0; k < tpl.nSeg; k++) {
        if (k > 0) {
            const t = pecah.tangga[k - 1];
            sel.push(t ? _denahBlok(t.it, li, si, t.ii, vertikal) : '<div></div>');
        }
        const seg = pecah.segs[k];
        sel.push(`<div class="flex ${vertikal ? 'flex-col w-full h-full' : 'flex-row h-full'} gap-1">${
            seg && seg.items.length ? seg.items.map(x => _denahBlok(x.it, li, si, x.ii, vertikal)).join('') : ''
        }</div>`);
    }
    const sorot = disorot ? 'ring-2 ring-indigo-400' : '';
    const badge = `<span class="text-[9px] font-black text-white bg-slate-600 rounded px-1.5 py-0.5">L${_esc(no)}</span>`;
    if (vertikal) {
        return `<div class="bg-slate-50 border border-slate-200 rounded-lg p-1 flex flex-col gap-1 ${sorot}" style="width:${DENAH_DEPTH + 10}px">
            <div class="flex justify-center">${badge}</div>
            <div class="grid gap-1" style="grid-template-rows:${tpl.template};height:${tpl.panjang}px;">${sel.join('')}</div>
        </div>`;
    }
    return `<div class="bg-slate-50 border border-slate-200 rounded-lg p-1 flex items-stretch gap-1.5 ${sorot}" style="width:max-content;height:${DENAH_DEPTH + 10}px">
        <div class="flex items-center justify-center shrink-0" style="width:24px">${badge}</div>
        <div class="grid gap-1" style="grid-template-columns:${tpl.template};width:${tpl.panjang}px;">${sel.join('')}</div>
    </div>`;
}

// Denah gabungan: SEMUA lantai dalam satu gambar.
// Sayap selatan hanya membentang di kolom TENGAH, sedangkan sayap
// timur & barat direnggangkan ke samping — sehingga sudut antara
// tengah dgn timur/barat dibiarkan KOSONG dan sayap samping tidak
// lagi tampak menutupi muka gedung selatan.
function _denahGambarGedung(g) {
    const lantai = g.lantai || [];
    const punya = (p) => lantai.some(l => (l.sisi || []).some(s => s.posisi === p));

    // Template grid bersama per posisi -> tangga lurus antar lantai
    const tpl = { atas: _denahTemplate(lantai, 'atas'), bawah: _denahTemplate(lantai, 'bawah'),
                  kiri: _denahTemplate(lantai, 'kiri'), kanan: _denahTemplate(lantai, 'kanan') };

    // Lantai 1 paling dekat halaman: atas & kiri dibalik, bawah & kanan normal
    const blokPosisi = (p) => {
        const vertikal = (p === 'kiri' || p === 'kanan');
        let urut = lantai.map((l, i) => ({ l, i }));
        if (p === 'atas' || p === 'kiri') urut = urut.slice().reverse();
        return urut.map(({ l, i }) => (l.sisi || [])
            .map((s, si) => ({ s, si }))
            .filter(x => x.s.posisi === p)
            .map(x => _denahStrip(x.s, x.si, i, l.no, vertikal, tpl[p], _denahMode === 'edit' && i === _denahL))
            .join('')
        ).join('');
    };

    const namaSisi = (p) => {
        for (const l of lantai) for (const s of (l.sisi || [])) if (s.posisi === p) return s.nama;
        return '';
    };
    const judulBlok = (p) => `<p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 truncate">${_esc(namaSisi(p))}</p>`;

    const atas = punya('atas'), bawah = punya('bawah'), kiri = punya('kiri'), kanan = punya('kanan');
    const nL = lantai.length || 1;
    const lebarSisi = nL * (DENAH_DEPTH + 14);
    // Kolom tengah HARUS selebar isinya (max-content), kalau tidak sayap
    // selatan melimpah menabrak sayap samping.
    const kolom = (kiri ? lebarSisi + 'px ' : '') + 'minmax(max-content,1fr)' + (kanan ? ' ' + lebarSisi + 'px' : '');
    const lebarTengah = Math.max(280, (atas ? tpl.atas.panjang : 0), (bawah ? tpl.bawah.panjang : 0)) + 44;
    const lebarMin = (kiri ? lebarSisi : 0) + (kanan ? lebarSisi : 0) + lebarTengah;
    const sudutKosong = '<div></div>';

    return `<div id="denah-print-area" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
                <p class="text-sm font-black text-slate-800">Denah ${_esc(g.nama)}</p>
                <p class="text-[10px] text-slate-400 font-semibold">Seluruh ${lantai.length} lantai · <b>L1 = baris paling dekat halaman</b>, lantai berikutnya menjauh</p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
                <span class="flex items-center gap-1 text-[9px] font-bold text-slate-400"><i data-lucide="compass" class="w-3.5 h-3.5"></i>Atas = Utara</span>
                ${Object.keys(DENAH_JENIS).map(k => `<span class="flex items-center gap-1 text-[9px] font-bold text-slate-500"><span class="w-2.5 h-2.5 rounded border ${DENAH_JENIS[k].cls}"></span>${DENAH_JENIS[k].label}</span>`).join('')}
            </div>
        </div>
        <div class="grid gap-y-4" style="grid-template-columns:${kolom};column-gap:28px;min-width:${lebarMin}px;">
            ${atas ? `${kiri ? sudutKosong : ''}
                      <div>${judulBlok('atas')}<div class="space-y-1">${blokPosisi('atas')}</div></div>
                      ${kanan ? sudutKosong : ''}` : ''}
            ${kiri ? `<div>${judulBlok('kiri')}<div class="flex gap-1 items-stretch">${blokPosisi('kiri')}</div></div>` : ''}
            <div class="border-2 border-dashed border-slate-200 rounded-xl min-h-[140px] flex items-center justify-center">
                <span class="text-[11px] font-black text-slate-300 uppercase tracking-widest">Halaman</span>
            </div>
            ${kanan ? `<div>${judulBlok('kanan')}<div class="flex gap-1 items-stretch">${blokPosisi('kanan')}</div></div>` : ''}
            ${bawah ? `${kiri ? sudutKosong : ''}
                       <div>${judulBlok('bawah')}<div class="space-y-1">${blokPosisi('bawah')}</div></div>
                       ${kanan ? sudutKosong : ''}` : ''}
        </div>
    </div>`;
}

// ── Cetak & unduh ───────────────────────────────────────────
function cetakDenah() {
    document.body.classList.add('mode-cetak-denah');
    window.print();
    setTimeout(() => document.body.classList.remove('mode-cetak-denah'), 800);
}

async function unduhDenahPNG() {
    const btn = document.getElementById('denah-btn-png');
    const el = document.getElementById('denah-print-area');
    if (!el) return;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Menyiapkan...'; }
    let bungkus = null;
    try {
        if (typeof html2canvas === 'undefined') {
            await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = res;
                s.onerror = () => rej(new Error('Gagal memuat library gambar. Periksa koneksi internet.'));
                document.head.appendChild(s);
            });
        }
        // Denah biasanya lebih lebar dari layar dan di dalam kotak
        // ber-scroll, sehingga tangkapan langsung selalu terpotong.
        // Solusi: KLONING ke wadah di luar layar dgn lebar penuh,
        // lalu tangkap wadah itu.
        const lebarIsi = [...el.querySelectorAll('.grid')].reduce((m, gr) =>
            Math.max(m, gr.scrollWidth, gr.getBoundingClientRect().width), 0);
        const lebar = Math.ceil(Math.max(el.scrollWidth, lebarIsi + 36)) + 4;

        bungkus = document.createElement('div');
        bungkus.style.cssText = 'position:absolute;left:-99999px;top:0;z-index:-1;background:#ffffff;width:' + lebar + 'px;';
        const klon = el.cloneNode(true);
        klon.removeAttribute('id');
        klon.style.width = lebar + 'px';
        klon.style.maxWidth = 'none';
        klon.style.overflow = 'visible';
        klon.style.boxShadow = 'none';
        bungkus.appendChild(klon);
        document.body.appendChild(bungkus);
        // beri waktu layout menghitung ulang
        await new Promise(r => setTimeout(r, 60));

        const canvas = await html2canvas(bungkus, {
            backgroundColor: '#ffffff', scale: 2,
            width: bungkus.scrollWidth, height: bungkus.scrollHeight,
            windowWidth: lebar + 200, scrollX: 0, scrollY: 0
        });
        canvas.toBlob(function (blob) {
            const nama = 'Denah-' + String(_gAktif().nama).replace(/[\\/:*?"<>|\s]+/g, '-') + '.png';
            if (typeof lpDownloadBlob === 'function') lpDownloadBlob(blob, nama);
            else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob); a.download = nama;
                document.body.appendChild(a); a.click(); a.remove();
            }
        });
    } catch (err) {
        alert('Gagal membuat gambar: ' + (err.message || err) + '\n\nAlternatif: gunakan tombol "Cetak / PDF" lalu pilih "Save as PDF".');
    } finally {
        if (bungkus && bungkus.parentNode) bungkus.parentNode.removeChild(bungkus);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="image-down" class="w-3.5 h-3.5"></i>Unduh Gambar'; lucide.createIcons(); }
}

// ── Klik ruangan -> info ────────────────────────────────────
function denahKlikRuang(li, si, ii) {
    const lantai = _gAktif().lantai[li];
    const it = lantai.sisi[si].items[ii];
    const info = document.getElementById('denah-info');
    if (!info || !it) return;
    const j = DENAH_JENIS[it.jenis] || DENAH_JENIS.fasilitas;
    const u = (DENAH_UKURAN.find(x => x.v === (parseInt(it.ukuran, 10) || 2)) || {}).label || '-';
    const kls = _denahKelasRuang(it);
    const daftar = kls.map(n => {
        const k = _denahInfoKelas(n);
        return `<p class="text-[11px] font-bold mt-1 ${k ? 'text-indigo-600' : 'text-slate-400'}">Kelas ${_esc(n)}${
            k ? ` · ${k.total_siswa} siswa · Wali: ${_esc(k.nama_wali || '-')}` : ' · belum ada di data wali kelas'}</p>`;
    }).join('');
    info.innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl border ${j.cls} flex items-center justify-center shrink-0"><i data-lucide="door-open" class="w-5 h-5"></i></div>
        <div class="flex-1 min-w-0">
            <p class="font-black text-slate-800 text-sm">${_esc(it.nama || kls.join(' & ') || '—')}</p>
            <p class="text-[11px] text-slate-500 font-semibold">${j.label} · Ukuran ${u} · ${_esc(lantai.sisi[si].nama)} · Lantai ${_esc(lantai.no)}${
                kls.length > 1 ? ` · <span class="text-violet-600 font-bold">ditempati ${kls.length} kelas</span>` : ''}</p>
            ${daftar || `<p class="text-[10px] text-slate-400 mt-1">Belum terhubung ke data kelas. Isi kolom <b>Kelas</b> pada ruangan ini lewat "Kelola Denah" (boleh lebih dari satu kelas).</p>`}
        </div>
        <button onclick="document.getElementById('denah-info').innerHTML=''" class="text-slate-300 hover:text-rose-500"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>`;
    lucide.createIcons();
}

// ── Panel editor ────────────────────────────────────────────
function _denahPanelEditor(lantai) {
    if (!lantai) return '';
    const opsiUkuran = (v) => DENAH_UKURAN.map(u => `<option value="${u.v}" ${u.v === (parseInt(v, 10) || 2) ? 'selected' : ''}>${u.label}</option>`).join('');
    const opsiJenis = (v) => Object.keys(DENAH_JENIS).map(k => `<option value="${k}" ${k === v ? 'selected' : ''}>${DENAH_JENIS[k].label}</option>`).join('');
    const opsiPosisi = (v) => DENAH_POSISI.map(p => `<option value="${p.v}" ${p.v === v ? 'selected' : ''}>${p.label}</option>`).join('');
    const inp = 'border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400';

    const sisiHtml = (lantai.sisi || []).map((s, si) => {
        const baris = (s.items || []).map((it, ii) => it.t === 'tangga'
            ? `<div class="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2 py-1.5">
                 <i data-lucide="stairs" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
                 <input type="text" value="${_esc(it.nama || 'Tangga')}" onchange="denahSetField(${si},${ii},'nama',this.value)" class="${inp} flex-1 min-w-0">
                 <span class="text-[9px] font-black text-slate-400 uppercase px-1">Tangga</span>
                 ${_denahTombolUrut(si, ii)}
               </div>`
            : `<div class="bg-white border border-slate-100 rounded-lg px-2 py-1.5 space-y-1.5">
                 <div class="flex items-center gap-1.5 flex-wrap">
                   <input type="text" value="${_esc(it.nama || '')}" list="denah-dl-kelas" placeholder="Nama ruang" onchange="denahSetField(${si},${ii},'nama',this.value)" class="${inp} flex-1 min-w-[120px]">
                   <select onchange="denahSetField(${si},${ii},'jenis',this.value)" class="${inp} bg-white">${opsiJenis(it.jenis)}</select>
                   <select onchange="denahSetField(${si},${ii},'ukuran',this.value)" class="${inp} bg-white">${opsiUkuran(it.ukuran)}</select>
                 </div>
                 <div class="flex items-center gap-1.5 pl-0.5 flex-wrap">
                   <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider shrink-0">Kelas</span>
                   ${_denahSlotKelas(it, si, ii, inp)}
                   <button onclick="denahTambahSlotKelas(${si},${ii})" title="Tambah kelas di ruangan ini" class="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
                   <div class="ml-auto">${_denahTombolUrut(si, ii)}</div>
                 </div>
               </div>`).join('');
        return `<div class="border border-slate-200 rounded-xl p-3 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
                <input type="text" value="${_esc(s.nama)}" onchange="denahSetSisi(${si},'nama',this.value)" class="${inp} font-bold w-44">
                <select onchange="denahSetSisi(${si},'posisi',this.value)" class="${inp} bg-white">${opsiPosisi(s.posisi)}</select>
                <div class="flex-1"></div>
                <button onclick="denahTambahItem(${si},'ruang')" class="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">+ Ruangan</button>
                <button onclick="denahTambahItem(${si},'tangga')" class="text-[11px] font-bold text-slate-600 hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">+ Tangga</button>
                <button onclick="denahHapusSisi(${si})" title="Hapus sisi" class="p-1 rounded-lg text-slate-300 hover:text-rose-500"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
            <div class="space-y-1.5">${baris || '<p class="text-[11px] text-slate-400 px-1">Belum ada ruangan.</p>'}</div>
        </div>`;
    }).join('');

    return `<div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <datalist id="denah-dl-kelas">${_denahDaftarKelas.map(k => `<option value="${_esc(k)}">`).join('')}</datalist>
        <div class="flex items-center justify-between gap-2 flex-wrap">
            <div>
                <p class="text-xs font-black text-slate-700">Kelola Lantai ${_esc(lantai.no)} — ${_esc(_gAktif().nama)}</p>
                <p class="text-[10px] text-slate-400">Tulis ruangan berurutan sesuai kenyataan. Sisipkan <b>Tangga</b> di antaranya — segmen terbentuk sendiri. Kolom <b>Kelas</b> boleh diisi lebih dari satu bila ruangan itu ditempati beberapa rombel.</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="denahTambahSisi()" class="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">+ Sisi Bangunan</button>
                <button onclick="denahHapusLantai()" class="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">Hapus Lantai</button>
            </div>
        </div>
        ${sisiHtml || '<p class="text-xs text-slate-400 text-center py-4">Belum ada sisi bangunan. Klik "+ Sisi Bangunan".</p>'}
    </div>`;
}

// Kotak isian kelas penghuni ruangan. Selalu ada minimal dua kotak
// supaya kasus "satu ruangan dua kelas" bisa langsung diisi tanpa
// mencari tombol dulu.
function _denahSlotKelas(it, si, ii, inp) {
    const arr = Array.isArray(it.kelas) ? it.kelas.slice() : [];
    while (arr.length < 2) arr.push('');
    return arr.map((n, ki) =>
        `<input type="text" value="${_esc(n)}" list="denah-dl-kelas" placeholder="${ki === 0 ? 'Kelas penghuni' : '(kelas ke-' + (ki + 1) + ', opsional)'}"
                onchange="denahSetKelas(${si},${ii},${ki},this.value)" class="${inp} flex-1 min-w-0">`).join('');
}

function _denahTombolUrut(si, ii) {
    return `<div class="flex items-center gap-0.5 shrink-0">
        <button onclick="denahGeser(${si},${ii},-1)" title="Geser maju" class="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><i data-lucide="chevron-left" class="w-3.5 h-3.5"></i></button>
        <button onclick="denahGeser(${si},${ii},1)" title="Geser mundur" class="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button>
        <button onclick="denahHapusItem(${si},${ii})" title="Hapus" class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
    </div>`;
}

// ── Operasi edit ────────────────────────────────────────────
function denahSetField(si, ii, field, val) {
    const it = _lAktif().sisi[si].items[ii];
    it[field] = (field === 'ukuran') ? (parseInt(val, 10) || 2) : val;
    _denahUbah();
}
function denahSetKelas(si, ii, ki, val) {
    const it = _lAktif().sisi[si].items[ii];
    const arr = Array.isArray(it.kelas) ? it.kelas.slice() : [];
    while (arr.length <= ki) arr.push('');
    arr[ki] = String(val || '').trim();
    // Buang yang kosong supaya urutannya rapat; hapus fieldnya kalau
    // ruangan ini memang tidak ditempati kelas.
    const bersih = arr.filter(Boolean);
    if (bersih.length) it.kelas = bersih; else delete it.kelas;
    _denahUbah();
}

function denahTambahSlotKelas(si, ii) {
    const it = _lAktif().sisi[si].items[ii];
    const arr = Array.isArray(it.kelas) ? it.kelas.slice() : [];
    if (arr.length < 2) { alert('Isi dulu dua kotak kelas yang sudah tersedia.'); return; }
    it.kelas = arr.concat('');
    _denahUbah();
}

function denahSetSisi(si, field, val) { _lAktif().sisi[si][field] = val; _denahUbah(); }
function denahTambahItem(si, tipe) {
    const items = _lAktif().sisi[si].items;
    items.push(tipe === 'tangga' ? { t: 'tangga', nama: 'Tangga' } : { t: 'ruang', nama: '', jenis: 'kelas', ukuran: 2 });
    _denahUbah();
}
function denahHapusItem(si, ii) { _lAktif().sisi[si].items.splice(ii, 1); _denahUbah(); }
function denahGeser(si, ii, arah) {
    const items = _lAktif().sisi[si].items;
    const j = ii + arah;
    if (j < 0 || j >= items.length) return;
    const tmp = items[ii]; items[ii] = items[j]; items[j] = tmp;
    _denahUbah();
}
function denahTambahSisi() {
    _lAktif().sisi.push({ nama: 'Sisi Baru', posisi: 'atas', items: [] });
    _denahUbah();
}
function denahHapusSisi(si) {
    if (!confirm('Hapus sisi bangunan ini beserta ruangannya?')) return;
    _lAktif().sisi.splice(si, 1);
    _denahUbah();
}
function denahTambahLantai() {
    const g = _gAktif();
    const no = g.lantai.length ? Math.max(...g.lantai.map(l => parseInt(l.no, 10) || 0)) + 1 : 1;
    g.lantai.push({ no: no, sisi: [] });
    _denahL = g.lantai.length - 1;
    _denahUbah();
}
function denahHapusLantai() {
    const g = _gAktif();
    if (g.lantai.length <= 1) { alert('Minimal harus ada satu lantai.'); return; }
    if (!confirm('Hapus lantai ini beserta seluruh ruangannya?')) return;
    g.lantai.splice(_denahL, 1);
    if (_denahL >= g.lantai.length) _denahL = g.lantai.length - 1;
    _denahUbah();
}
function denahSalinLantai() {
    const g = _gAktif();
    const pilihan = g.lantai.map((l, i) => i === _denahL ? null : (i + 1) + '. Lantai ' + l.no).filter(Boolean);
    if (pilihan.length === 0) { alert('Belum ada lantai lain untuk disalin.'); return; }
    const jwb = prompt('Salin susunan ruangan dari lantai mana?\n\n' + pilihan.join('\n') + '\n\nKetik nomor urutannya:');
    const idx = parseInt(jwb, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= g.lantai.length || idx === _denahL) return;
    g.lantai[_denahL].sisi = JSON.parse(JSON.stringify(g.lantai[idx].sisi));
    _denahUbah();
}

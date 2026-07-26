// ============================================================
// DENAH SEKOLAH (tab di menu Data)
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

// ── Muat & simpan ───────────────────────────────────────────
async function initTabDenah() {
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

    // Toolbar: pilih gedung, lantai, mode
    if (toolbar) {
        const tabGedung = _denah.gedung.map((gd, i) =>
            `<button onclick="denahPilihGedung(${i})" class="px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${i === _denahG ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}">${_esc(gd.nama)}</button>`).join('');
        const chipLantai = g.lantai.map((lt, i) =>
            `<button onclick="denahPilihLantai(${i})" class="w-9 h-9 text-xs font-black rounded-xl transition-all ${i === _denahL ? 'bg-slate-800 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'}">${_esc(lt.no)}</button>`).join('');
        toolbar.innerHTML = `
        <div class="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-3 flex-wrap">
                <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">${tabGedung}</div>
                <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lantai</span>
                    ${chipLantai}
                    ${_denahMode === 'edit' ? `<button onclick="denahTambahLantai()" title="Tambah lantai" class="w-9 h-9 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-400"><i data-lucide="plus" class="w-4 h-4 mx-auto"></i></button>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                ${_denahBelumSimpan ? '<span class="text-[10px] font-bold text-amber-600">⚠ Belum disimpan</span>' : ''}
                ${_denahMode === 'edit'
                    ? `<button onclick="denahSalinLantai()" class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl"><i data-lucide="copy" class="w-3.5 h-3.5"></i>Salin dari Lantai Lain</button>
                       <button id="denah-btn-simpan" onclick="simpanDenah()" class="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"><i data-lucide="save" class="w-3.5 h-3.5"></i>Simpan</button>
                       <button onclick="denahSetMode('lihat')" class="text-xs font-bold text-slate-500 hover:bg-slate-100 px-3 py-2 rounded-xl border">Selesai</button>`
                    : `<button onclick="denahSetMode('edit')" class="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Kelola Denah</button>`}
            </div>
        </div>`;
    }

    canvas.innerHTML = _denahGambar(_lAktif());
    if (editor) editor.innerHTML = _denahMode === 'edit' ? _denahPanelEditor(_lAktif()) : '';
    lucide.createIcons();
}

function denahPilihGedung(i) { _denahG = i; _denahL = 0; renderDenah(); }
function denahPilihLantai(i) { _denahL = i; renderDenah(); }
function denahSetMode(m) { _denahMode = m; renderDenah(); }

// ── Menggambar denah ────────────────────────────────────────
function _denahBlok(it, si, ii, vertikal) {
    if (it.t === 'tangga') {
        const gaya = vertikal ? 'height:44px;flex:0 0 auto;' : 'width:52px;flex:0 0 auto;';
        return `<div style="${gaya}" title="${_esc(it.nama || 'Tangga')}"
            class="rounded-lg border border-slate-300 bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_4px,#f8fafc_4px,#f8fafc_8px)] flex flex-col items-center justify-center text-slate-500">
            <i data-lucide="stairs" class="w-3.5 h-3.5"></i>
            <span class="text-[8px] font-black uppercase leading-none mt-0.5">Tangga</span>
        </div>`;
    }
    const j = DENAH_JENIS[it.jenis] || DENAH_JENIS.fasilitas;
    const u = Math.max(1, Math.min(4, parseInt(it.ukuran, 10) || 2));
    const gaya = vertikal ? `flex:${u} 1 0;min-height:${34 + u * 12}px;` : `flex:${u} 1 0;min-width:${44 + u * 16}px;`;
    const kelas = _denahKelasInfo[String(it.nama || '').toLowerCase().trim()];
    return `<div onclick="denahKlikRuang(${si},${ii})" style="${gaya}"
        class="rounded-lg border ${j.cls} px-1.5 py-1.5 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all flex flex-col items-center justify-center text-center overflow-hidden">
        <span class="text-[11px] font-black leading-tight truncate w-full">${_esc(it.nama || '—')}</span>
        ${kelas ? `<span class="text-[8px] font-bold opacity-70 leading-none mt-0.5">${kelas.total_siswa} siswa</span>` : ''}
    </div>`;
}

function _denahSisiHtml(sisi, si) {
    const vertikal = sisi.posisi === 'kiri' || sisi.posisi === 'kanan';
    const isi = (sisi.items || []).map((it, ii) => _denahBlok(it, si, ii, vertikal)).join('');
    const arah = vertikal ? 'flex-col' : 'flex-row';
    return `<div class="bg-slate-50 border border-slate-200 rounded-xl p-1.5 h-full">
        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1 px-0.5 truncate">${_esc(sisi.nama)}</p>
        <div class="flex ${arah} gap-1 ${vertikal ? 'h-[calc(100%-14px)]' : ''}">${isi || '<span class="text-[9px] text-slate-400 px-1">kosong</span>'}</div>
    </div>`;
}

function _denahGambar(lantai) {
    if (!lantai) return '';
    const sisi = lantai.sisi || [];
    const cari = (p) => sisi.map((s, i) => ({ s, i })).filter(x => x.s.posisi === p);
    const blokPosisi = (p) => cari(p).map(x => _denahSisiHtml(x.s, x.i)).join('');

    const atas = blokPosisi('atas'), bawah = blokPosisi('bawah');
    const kiri = blokPosisi('kiri'), kanan = blokPosisi('kanan');
    const adaKiri = kiri !== '', adaKanan = kanan !== '';

    const kolom = (adaKiri ? '150px ' : '') + '1fr' + (adaKanan ? ' 150px' : '');
    const spanPenuh = 1 + (adaKiri ? 1 : 0) + (adaKanan ? 1 : 0);

    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p class="text-xs font-black text-slate-700">${_esc(_gAktif().nama)} · Lantai ${_esc(lantai.no)}</p>
            <div class="flex items-center gap-3 flex-wrap">
                <span class="flex items-center gap-1 text-[9px] font-bold text-slate-400"><i data-lucide="compass" class="w-3.5 h-3.5"></i>Atas = Utara</span>
                ${Object.keys(DENAH_JENIS).map(k => `<span class="flex items-center gap-1 text-[9px] font-bold text-slate-500"><span class="w-2.5 h-2.5 rounded border ${DENAH_JENIS[k].cls}"></span>${DENAH_JENIS[k].label}</span>`).join('')}
            </div>
        </div>
        <div class="min-w-[640px] grid gap-2" style="grid-template-columns:${kolom};">
            ${atas ? `<div style="grid-column:span ${spanPenuh};" class="space-y-2">${atas}</div>` : ''}
            ${adaKiri ? `<div class="space-y-2">${kiri}</div>` : ''}
            <div class="border-2 border-dashed border-slate-200 rounded-xl min-h-[110px] flex items-center justify-center">
                <span class="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Halaman / Void</span>
            </div>
            ${adaKanan ? `<div class="space-y-2">${kanan}</div>` : ''}
            ${bawah ? `<div style="grid-column:span ${spanPenuh};" class="space-y-2">${bawah}</div>` : ''}
        </div>
    </div>`;
}

// ── Klik ruangan -> info ────────────────────────────────────
function denahKlikRuang(si, ii) {
    const lantai = _lAktif();
    const it = lantai.sisi[si].items[ii];
    const info = document.getElementById('denah-info');
    if (!info || !it) return;
    const j = DENAH_JENIS[it.jenis] || DENAH_JENIS.fasilitas;
    const u = (DENAH_UKURAN.find(x => x.v === (parseInt(it.ukuran, 10) || 2)) || {}).label || '-';
    const k = _denahKelasInfo[String(it.nama || '').toLowerCase().trim()];
    info.innerHTML = `<div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl border ${j.cls} flex items-center justify-center shrink-0"><i data-lucide="door-open" class="w-5 h-5"></i></div>
        <div class="flex-1 min-w-0">
            <p class="font-black text-slate-800 text-sm">${_esc(it.nama || '—')}</p>
            <p class="text-[11px] text-slate-500 font-semibold">${j.label} · Ukuran ${u} · ${_esc(lantai.sisi[si].nama)} · Lantai ${_esc(lantai.no)}</p>
            ${k ? `<p class="text-[11px] text-indigo-600 font-bold mt-1">Kelas ${_esc(k.kelas)} · ${k.total_siswa} siswa · Wali: ${_esc(k.nama_wali || '-')}</p>`
                : `<p class="text-[10px] text-slate-400 mt-1">Tidak terhubung ke data kelas (beri nama ruangan sama dengan nama kelas agar otomatis terhubung).</p>`}
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
            : `<div class="flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-2 py-1.5">
                 <input type="text" value="${_esc(it.nama || '')}" list="denah-dl-kelas" placeholder="Nama ruang" onchange="denahSetField(${si},${ii},'nama',this.value)" class="${inp} flex-1 min-w-0">
                 <select onchange="denahSetField(${si},${ii},'jenis',this.value)" class="${inp} bg-white">${opsiJenis(it.jenis)}</select>
                 <select onchange="denahSetField(${si},${ii},'ukuran',this.value)" class="${inp} bg-white">${opsiUkuran(it.ukuran)}</select>
                 ${_denahTombolUrut(si, ii)}
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
                <p class="text-[10px] text-slate-400">Tulis ruangan berurutan sesuai kenyataan. Sisipkan <b>Tangga</b> di antaranya — segmen terbentuk sendiri.</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="denahTambahSisi()" class="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">+ Sisi Bangunan</button>
                <button onclick="denahHapusLantai()" class="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">Hapus Lantai</button>
            </div>
        </div>
        ${sisiHtml || '<p class="text-xs text-slate-400 text-center py-4">Belum ada sisi bangunan. Klik "+ Sisi Bangunan".</p>'}
    </div>`;
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

// ============================================================
// HALAMAN JADWAL SEKOLAH
// Tab: Jadwal Kelas · Jadwal Guru · Guru Available · Impor PDF
// ============================================================

const _jsState = { tab: 'kelas', semua: [], kelas: '', guru: '', namaGuru: {}, impor: {} };

async function initHalamanJadwalSekolah() {
    const loader = document.getElementById('js-loader');
    if (loader) loader.classList.remove('hidden');
    try {
        _jsState.semua = await jsMuatSemua(true);
        // peta kode -> nama guru (gabungan tabel guru + header PDF)
        _jsState.namaGuru = {};
        try {
            (await getDataGuru()).forEach(g => { if (g.kode_guru) _jsState.namaGuru[g.kode_guru] = g.nama; });
        } catch (e) { /* opsional */ }
        _jsState.semua.forEach(s => {
            if (s.sumber === 'guru' && s.pemilik_nama && !_jsState.namaGuru[s.pemilik]) {
                _jsState.namaGuru[s.pemilik] = s.pemilik_nama;
            }
        });
    } catch (e) { console.error(e); _jsState.semua = []; }
    if (loader) loader.classList.add('hidden');
    jsTampilkanTab(_jsState.semua.length === 0 ? 'impor' : _jsState.tab);
}

function jsNama(kode) { return _jsState.namaGuru[kode] || ''; }

function jsTampilkanTab(tab) {
    _jsState.tab = tab;
    ['kelas', 'guru', 'available', 'impor'].forEach(t => {
        const p = document.getElementById('js-panel-' + t);
        const b = document.getElementById('js-tab-' + t);
        if (p) p.classList.toggle('hidden', t !== tab);
        if (b) {
            b.classList.toggle('bg-indigo-600', t === tab);
            b.classList.toggle('text-white', t === tab);
            b.classList.toggle('shadow-sm', t === tab);
            b.classList.toggle('text-slate-500', t !== tab);
        }
    });
    if (tab === 'kelas') jsRenderTabKelas();
    if (tab === 'guru') jsRenderTabGuru();
    if (tab === 'available') jsRenderTabAvailable();
    if (tab === 'impor') jsRenderTabImpor();
    lucide.createIcons();
}

// ── Grid mingguan (dipakai tab kelas & guru) ────────────────
function _jsGrid(slot, mode) {
    const jamList = jsDaftarJam(_jsState.semua);
    if (!jamList.length) return '<p class="text-sm text-slate-400 text-center py-8">Belum ada data jadwal.</p>';

    const warna = {
        mengajar: 'bg-indigo-100 border-indigo-300 text-indigo-900',
        piket: 'bg-amber-100 border-amber-300 text-amber-900',
        elective: 'bg-emerald-100 border-emerald-300 text-emerald-900',
        paralel: 'bg-violet-100 border-violet-300 text-violet-900'
    };
    const hariIni = jsHariIniIdx();
    const jamKini = jsJamSekarang();

    let html = `<div class="overflow-x-auto"><div class="min-w-[860px] grid gap-1" style="grid-template-columns:96px repeat(6,1fr);">
        <div></div>` +
        JADWAL_HARI_ID.map((h, i) => `<div class="text-center px-2 py-2 rounded-lg text-xs font-black ${i === hariIni ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}">${h}</div>`).join('');

    jamList.forEach(j => {
        html += `<div class="flex flex-col items-center justify-center bg-slate-50 rounded-lg py-2">
            <span class="text-[10px] font-black text-slate-500">${lpEscape(j.jam_ke || '')}</span>
            <span class="text-[9px] font-bold text-slate-400">${lpEscape(j.mulai)}</span>
            <span class="text-[9px] text-slate-400">${lpEscape(j.selesai)}</span>
        </div>`;
        for (let d = 0; d < 6; d++) {
            const isi = slot.filter(s => s.hari_idx === d && s.jam_mulai === j.mulai && s.jam_selesai === j.selesai);
            const sedang = d === hariIni && j.mulai <= jamKini && jamKini < j.selesai;
            if (!isi.length) {
                html += `<div class="rounded-lg border border-dashed border-slate-200 min-h-[54px] ${sedang ? 'ring-2 ring-rose-300' : ''}"></div>`;
                continue;
            }
            html += isi.map(s => {
                const w = warna[s.jenis] || warna.mengajar;
                const baris2 = mode === 'kelas'
                    ? (s.kode_guru ? lpEscape(s.kode_guru) + (jsNama(s.kode_guru) ? ' · ' + lpEscape(jsNama(s.kode_guru).split(',')[0]) : '') : '—')
                    : lpEscape(s.kelas || '—');
                return `<div onclick="jsKlikSlot(${_jsState.semua.indexOf(s)})"
                    class="rounded-lg border ${w} px-2 py-1.5 min-h-[54px] cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all ${sedang ? 'ring-2 ring-rose-400' : ''}">
                    <p class="text-[11px] font-black leading-tight line-clamp-2">${lpEscape(s.mapel || '—')}</p>
                    <p class="text-[9px] font-bold opacity-80 leading-tight truncate">${baris2}</p>
                </div>`;
            }).join('');
        }
    });
    html += '</div></div>';
    return html;
}

function jsKlikSlot(idx) {
    const s = _jsState.semua[idx];
    if (!s) return;
    const nama = jsNama(s.kode_guru);
    // Panel kelas & guru sama-sama punya kotak detail; keduanya tetap ada di
    // DOM saat tersembunyi, jadi id-nya dibedakan per tab.
    const box = document.getElementById('js-detail-' + _jsState.tab);
    if (!box) return;
    box.innerHTML = `<div class="bg-white rounded-2xl border border-indigo-200 p-4 flex items-start gap-3">
        <div class="w-11 h-11 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center shrink-0">
            <i data-lucide="user-round" class="w-5 h-5 text-indigo-700"></i>
        </div>
        <div class="flex-1 min-w-0">
            <p class="font-black text-slate-800 text-sm">${lpEscape(nama || (s.kode_guru ? 'Kode ' + s.kode_guru : 'Guru tidak tercantum'))}</p>
            <p class="text-[11px] text-slate-500 font-semibold">${lpEscape(s.mapel || '')}${s.kode_guru ? ' · kode ' + lpEscape(s.kode_guru) : ''}</p>
            <p class="text-[11px] text-indigo-600 font-bold mt-0.5">${lpEscape(s.hari)} · jam ${lpEscape(s.jam_ke)} (${lpEscape(s.jam_mulai)}–${lpEscape(s.jam_selesai)}) · ${lpEscape(s.sumber === 'kelas' ? s.pemilik : (s.kelas || '-'))}</p>
            ${s.jenis === 'paralel' ? '<p class="text-[10px] text-violet-600 font-bold mt-1">Kelas gabungan/paralel — guru ini mengajar beberapa kelas sekaligus di jam yang sama.</p>' : ''}
            ${s.silang ? '<p class="text-[10px] text-slate-400 font-semibold mt-1">Dicocokkan silang dengan PDF jadwal ' + (s.sumber === 'guru' ? 'kelas' : 'guru') + '.</p>' : ''}
            ${s.jenis === 'elective' ? '<p class="text-[10px] text-emerald-700 font-bold mt-1">Elective Courses — banyak guru mengajar bersamaan; lihat tab Jadwal Guru.</p>' : ''}
            ${s.kode_guru ? `<button onclick="jsBukaJadwalGuru('${lpEscape(s.kode_guru)}')" class="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg"><i data-lucide="calendar-search" class="w-3.5 h-3.5"></i>Lihat jadwal guru ini</button>` : ''}
        </div>
        <button onclick="document.getElementById('js-detail-${_jsState.tab}').innerHTML=''" class="text-slate-300 hover:text-rose-500"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>`;
    lucide.createIcons();
}

function jsBukaJadwalGuru(kode) {
    _jsState.guru = kode;
    jsTampilkanTab('guru');
}

// ── Tab: Jadwal Kelas ───────────────────────────────────────
function jsRenderTabKelas() {
    const wrap = document.getElementById('js-panel-kelas');
    if (!wrap) return;
    const daftar = jsDaftarKelas(_jsState.semua, _jsState.ruangan);
    if (!daftar.length) { wrap.innerHTML = _jsKosong('jadwal kelas'); return; }
    if (!_jsState.kelas || daftar.indexOf(_jsState.kelas) === -1) _jsState.kelas = daftar[0];
    const slot = _jsState.semua.filter(s => s.sumber === 'kelas' && s.pemilik === _jsState.kelas);
    wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
        <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kelas</span>
        <select onchange="_jsState.kelas=this.value; jsRenderTabKelas();"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold w-56 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            ${daftar.map(k => `<option value="${lpEscape(k)}" ${k === _jsState.kelas ? 'selected' : ''}>${lpEscape(k)}</option>`).join('')}
        </select>
        <label class="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer">
            <input type="checkbox" ${_jsState.ruangan ? 'checked' : ''} onchange="_jsState.ruangan=this.checked; jsRenderTabKelas();" class="rounded border-slate-300">
            Tampilkan ruangan
        </label>
        <span class="text-[11px] text-slate-400 font-semibold">${daftar.length} ${_jsState.ruangan ? 'kelas & ruang' : 'kelas'} · klik kartu untuk melihat guru pengajarnya</span>
    </div>
    <div id="js-detail-kelas" class="mt-3"></div>
    <div class="bg-white rounded-2xl border border-slate-200 p-3 mt-3">${_jsGrid(slot, 'kelas')}</div>`;
    lucide.createIcons();
}

// ── Tab: Jadwal Guru ────────────────────────────────────────
function jsRenderTabGuru() {
    const wrap = document.getElementById('js-panel-guru');
    if (!wrap) return;
    const daftar = jsDaftarGuru(_jsState.semua);
    if (!daftar.length) { wrap.innerHTML = _jsKosong('jadwal guru'); return; }
    if (!_jsState.guru || !daftar.some(g => g.kode === _jsState.guru)) _jsState.guru = daftar[0].kode;
    const g = daftar.find(x => x.kode === _jsState.guru) || daftar[0];
    const slot = _jsState.semua.filter(s => s.sumber === 'guru' && s.pemilik === _jsState.guru);
    const mengajar = slot.filter(s => s.jenis !== 'piket').length;
    const piket = slot.filter(s => s.jenis === 'piket').length;
    wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
        <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Guru</span>
        <select onchange="_jsState.guru=this.value; jsRenderTabGuru();"
                class="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold w-72 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            ${daftar.map(x => `<option value="${lpEscape(x.kode)}" ${x.kode === _jsState.guru ? 'selected' : ''}>${lpEscape(x.nama || '(tanpa nama)')} — ${lpEscape(x.kode)}</option>`).join('')}
        </select>
        <span class="text-[11px] text-slate-400 font-semibold">${mengajar} slot mengajar · ${piket} piket</span>
    </div>
    <div id="js-detail-guru" class="mt-3"></div>
    <div class="bg-white rounded-2xl border border-slate-200 p-3 mt-3">
        <p class="text-xs font-black text-slate-700 mb-2">${lpEscape(g.nama || '')} <span class="text-slate-400">(${lpEscape(g.kode)})</span></p>
        ${_jsGrid(slot, 'guru')}
    </div>`;
    lucide.createIcons();
}

// ── Tab: Guru Available ─────────────────────────────────────
function jsRenderTabAvailable() {
    const wrap = document.getElementById('js-panel-available');
    if (!wrap) return;
    const jamList = jsDaftarJam(_jsState.semua);
    if (!jamList.length) { wrap.innerHTML = _jsKosong('jadwal guru'); return; }
    const st = _jsState;
    if (st.avHari === undefined) { const h = jsHariIniIdx(); st.avHari = h < 0 ? 0 : h; }
    if (!st.avJam) {
        const now = jsJamSekarang();
        const k = jamList.find(j => j.mulai <= now && now < j.selesai) || jamList[0];
        st.avJam = k.mulai + '|' + k.selesai;
    }
    const [m, sl] = st.avJam.split('|');
    const hasil = jsGuruAvailable(_jsState.semua, st.avHari, m, sl);
    const cari = (st.avCari || '').toLowerCase();
    const saring = arr => arr.filter(g => !cari || (g.nama || '').toLowerCase().includes(cari) || g.kode.toLowerCase().includes(cari));

    const kartu = (g, warna, info) => `<div class="border ${warna} rounded-xl px-3 py-2">
        <p class="text-xs font-bold text-slate-800 truncate">${lpEscape(g.nama || '(tanpa nama)')}</p>
        <p class="text-[10px] font-black text-slate-400">${lpEscape(g.kode)}${info ? ' · ' + lpEscape(info) : ''}</p>
    </div>`;

    const bebas = saring(hasil.bebas), piket = saring(hasil.piket), sibuk = saring(hasil.sibuk);
    wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-slate-200 p-3 flex items-end gap-3 flex-wrap">
        <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Hari</label>
            <select onchange="_jsState.avHari=+this.value; jsRenderTabAvailable();" class="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                ${JADWAL_HARI_ID.map((h, i) => `<option value="${i}" ${i === st.avHari ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
        </div>
        <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Jam</label>
            <select onchange="_jsState.avJam=this.value; jsRenderTabAvailable();" class="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                ${jamList.map(j => { const v = j.mulai + '|' + j.selesai; return `<option value="${v}" ${v === st.avJam ? 'selected' : ''}>Jam ${lpEscape(j.jam_ke)} · ${lpEscape(j.mulai)}–${lpEscape(j.selesai)}</option>`; }).join('')}
            </select>
        </div>
        <button onclick="jsAvailableSekarang()" class="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm"><i data-lucide="clock" class="w-3.5 h-3.5"></i>Sekarang</button>
        <input type="text" value="${lpEscape(st.avCari || '')}" oninput="_jsState.avCari=this.value; jsRenderTabAvailable();" placeholder="Cari nama / kode..."
               class="flex-1 min-w-[160px] border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <div class="bg-white rounded-2xl border border-emerald-200 p-3">
            <p class="text-xs font-black text-emerald-700 mb-2 flex items-center gap-1.5"><i data-lucide="check-circle-2" class="w-4 h-4"></i>Bebas — bisa menggantikan (${bebas.length})</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">${bebas.map(g => kartu(g, 'border-emerald-200 bg-emerald-50', '')).join('') || '<p class="text-[11px] text-slate-400">Tidak ada.</p>'}</div>
        </div>
        <div class="bg-white rounded-2xl border border-amber-200 p-3">
            <p class="text-xs font-black text-amber-700 mb-2 flex items-center gap-1.5"><i data-lucide="shield" class="w-4 h-4"></i>Sedang piket (${piket.length})</p>
            <div class="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto">${piket.map(g => kartu(g, 'border-amber-200 bg-amber-50', g.info)).join('') || '<p class="text-[11px] text-slate-400">Tidak ada.</p>'}</div>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 p-3">
            <p class="text-xs font-black text-slate-600 mb-2 flex items-center gap-1.5"><i data-lucide="book-open" class="w-4 h-4"></i>Sedang mengajar (${sibuk.length})</p>
            <div class="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto">${sibuk.map(g => kartu(g, 'border-slate-200 bg-slate-50', g.info)).join('') || '<p class="text-[11px] text-slate-400">Tidak ada.</p>'}</div>
        </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-3 mt-3">
        <p class="text-xs font-black text-slate-700 mb-2">Kelas yang sedang berlangsung — ${lpEscape(JADWAL_HARI_ID[st.avHari])} ${lpEscape(m)}–${lpEscape(sl)}</p>
        <div class="overflow-x-auto"><table class="w-full text-left border-collapse" style="min-width:560px">
            <thead><tr class="bg-slate-50 text-[10px] font-black text-slate-400 uppercase"><th class="py-2 px-3">Kelas</th><th class="py-2 px-3">Mapel</th><th class="py-2 px-3">Kode</th><th class="py-2 px-3">Guru</th></tr></thead>
            <tbody class="text-xs divide-y divide-slate-100">${
                _jsState.semua.filter(s => s.sumber === 'kelas' && jsAdalahKelas(s.pemilik) && s.hari_idx === st.avHari && s.jam_mulai === m && s.jam_selesai === sl)
                    .sort((a, b) => a.pemilik.localeCompare(b.pemilik, 'id', { numeric: true }))
                    .map(s => `<tr class="hover:bg-slate-50"><td class="py-2 px-3 font-bold text-slate-700">${lpEscape(s.pemilik)}</td><td class="py-2 px-3">${lpEscape(s.mapel || '-')}</td><td class="py-2 px-3 font-mono font-bold text-indigo-600">${lpEscape(s.kode_guru || '-')}</td><td class="py-2 px-3 font-semibold text-slate-700">${lpEscape(jsNama(s.kode_guru) || '-')}</td></tr>`).join('')
                || '<tr><td colspan="4" class="py-6 text-center text-slate-400 font-semibold">Tidak ada kelas berlangsung pada jam ini.</td></tr>'
            }</tbody>
        </table></div>
    </div>`;
    lucide.createIcons();
}

function jsAvailableSekarang() {
    const h = jsHariIniIdx();
    if (h < 0) { alert('Hari ini Minggu — tidak ada jadwal. Pilih hari secara manual.'); return; }
    const jamList = jsDaftarJam(_jsState.semua);
    const now = jsJamSekarang();
    const k = jamList.find(j => j.mulai <= now && now < j.selesai);
    _jsState.avHari = h;
    if (k) _jsState.avJam = k.mulai + '|' + k.selesai;
    else alert('Di luar jam pelajaran (' + now + '). Menampilkan jam terdekat.');
    jsRenderTabAvailable();
}

function _jsKosong(apa) {
    return `<div class="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
        <div class="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto"><i data-lucide="calendar-off" class="w-7 h-7 text-indigo-500"></i></div>
        <p class="font-bold text-slate-800">Belum ada data ${lpEscape(apa)}</p>
        <p class="text-xs text-slate-500">Unggah PDF jadwal dari sekolah lewat tab <b>Impor PDF</b>.</p>
        <button onclick="jsTampilkanTab('impor')" class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm"><i data-lucide="upload" class="w-4 h-4"></i>Buka Impor PDF</button>
    </div>`;
}

// ── Tab: Impor PDF ──────────────────────────────────────────
function jsRenderTabImpor() {
    const wrap = document.getElementById('js-panel-impor');
    if (!wrap) return;
    const p = jsPeriodeAktif();
    const jml = s => _jsState.semua.filter(x => x.sumber === s).length;
    const kotak = (tipe, judul, ket) => `
    <div class="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div>
            <p class="text-sm font-black text-slate-800">${judul}</p>
            <p class="text-[11px] text-slate-500">${ket}</p>
            <p class="text-[11px] font-bold ${jml(tipe) ? 'text-emerald-600' : 'text-slate-400'} mt-1">
                ${jml(tipe) ? jml(tipe) + ' slot tersimpan' : 'belum ada data'}</p>
        </div>
        <label class="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-400 transition-colors">
            <i data-lucide="file-up" class="w-7 h-7 text-slate-400 mx-auto mb-1"></i>
            <span class="text-xs font-bold text-slate-600 block">Pilih berkas PDF</span>
            <input type="file" accept=".pdf" class="hidden" onchange="jsPilihPdf(this,'${tipe}')">
        </label>
        <p id="js-status-${tipe}" class="text-xs font-semibold text-center"></p>
        <div id="js-pratinjau-${tipe}"></div>
    </div>`;

    wrap.innerHTML = `
    <div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
        <i data-lucide="info" class="w-5 h-5 text-indigo-600 shrink-0 mt-0.5"></i>
        <div>
            <p class="text-sm font-bold text-indigo-800">Impor jadwal dari PDF sekolah</p>
            <p class="text-xs text-indigo-700 mt-0.5">Unggah PDF asli dari kurikulum (format aSc Timetables). Hasil pembacaan ditampilkan lebih dulu — data lama baru diganti setelah Anda menekan Simpan.${p ? ' Periode tersimpan saat ini: <b>' + lpEscape(p) + '</b>.' : ''}</p>
        </div>
    </div>
    <div class="mt-3">
        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Label periode berlaku (opsional)</label>
        <input type="text" id="js-periode" value="${lpEscape(p)}" placeholder="mis. 27 Juli - 17 Agustus 2026"
               class="w-full max-w-md border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400">
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        ${kotak('guru', 'PDF Jadwal Guru', 'Satu halaman per guru. Memberi nama+kode guru, jadwal mengajar, dan jadwal piket.')}
        ${kotak('kelas', 'PDF Jadwal Kelas', 'Satu halaman per kelas. Dipakai untuk tampilan Jadwal Kelas.')}
    </div>`;
    lucide.createIcons();
}

async function jsPilihPdf(input, tipe) {
    const file = input.files && input.files[0];
    if (!file) return;
    const st = document.getElementById('js-status-' + tipe);
    const pv = document.getElementById('js-pratinjau-' + tipe);
    if (pv) pv.innerHTML = '';
    if (st) st.innerHTML = '<span class="text-indigo-600 animate-pulse">Membaca PDF...</span>';
    try {
        const buf = await file.arrayBuffer();
        let kode = [...new Set(_jsState.semua.map(s => s.kode_guru).filter(Boolean))];
        if (kode.length === 0) {
            try { kode = (await getDataGuru()).map(g => g.kode_guru).filter(Boolean); } catch (e) { kode = []; }
        }
        const hasil = await jadwalParsePdf(buf, tipe, kode, (p, t) => {
            if (st) st.innerHTML = '<span class="text-indigo-600">Membaca halaman ' + p + ' dari ' + t + '...</span>';
        });
        _jsState.impor[tipe] = hasil;
        const jenis = {};
        hasil.slot.forEach(s => { jenis[s.jenis] = (jenis[s.jenis] || 0) + 1; });
        const tanpaKode = hasil.slot.filter(s => s.jenis === 'mengajar' && !s.kode_guru).length;
        if (st) st.innerHTML = `<span class="text-emerald-600 font-bold">${hasil.halamanOk} halaman terbaca</span>`
            + (hasil.halamanGagal.length ? ` · <span class="text-rose-600 font-bold">${hasil.halamanGagal.length} gagal</span>` : '');
        if (pv) {
            pv.innerHTML = `
            <div class="border border-slate-200 rounded-xl p-3 space-y-2">
                <div class="flex flex-wrap gap-2 text-[10px] font-bold">
                    <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">${hasil.slot.length} slot</span>
                    ${Object.keys(jenis).map(k => `<span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">${k}: ${jenis[k]}</span>`).join('')}
                    <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">${hasil.pemilik.length} ${tipe === 'guru' ? 'guru' : 'kelas'}</span>
                    ${tanpaKode ? `<span class="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">${tanpaKode} tanpa kode guru</span>` : ''}
                </div>
                <div class="max-h-40 overflow-y-auto text-[10px] font-mono text-slate-500 bg-slate-50 rounded-lg p-2">
                    ${hasil.slot.slice(0, 12).map(s => `${lpEscape(s.pemilik)} · ${lpEscape(s.hari)} ${lpEscape(s.jam_mulai)} · ${lpEscape(s.mapel)} · ${lpEscape(s.kode_guru || '-')} · ${lpEscape(s.kelas || '-')}`).join('<br>')}
                    ${hasil.slot.length > 12 ? '<br>… dan ' + (hasil.slot.length - 12) + ' lainnya' : ''}
                </div>
                <button onclick="jsSimpanImpor('${tipe}')" class="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm">
                    <i data-lucide="save" class="w-4 h-4"></i>Simpan & ganti jadwal ${tipe}
                </button>
            </div>`;
            lucide.createIcons();
        }
    } catch (err) {
        console.error(err);
        if (st) st.innerHTML = '<span class="text-rose-600 font-bold">Gagal: ' + lpEscape(err.message || err) + '</span>';
    }
    input.value = '';
}

async function jsSimpanImpor(tipe) {
    const hasil = _jsState.impor[tipe];
    if (!hasil || !hasil.slot.length) { alert('Belum ada hasil pembacaan untuk disimpan.'); return; }
    if (!confirm('Simpan ' + hasil.slot.length + ' slot?\n\nSeluruh jadwal "' + tipe + '" yang lama akan diganti.')) return;
    const st = document.getElementById('js-status-' + tipe);
    const periode = (document.getElementById('js-periode') || {}).value || '';
    try {
        await jsGantiJadwal(tipe, hasil.slot, periode, (n, t) => {
            if (st) st.innerHTML = '<span class="text-indigo-600">Menyimpan ' + n + '/' + t + '...</span>';
        });
        alert('✅ Jadwal ' + tipe + ' tersimpan (' + hasil.slot.length + ' slot).');
        delete _jsState.impor[tipe];
        await initHalamanJadwalSekolah();
    } catch (err) {
        alert('Gagal menyimpan: ' + (err.message || err));
    }
}

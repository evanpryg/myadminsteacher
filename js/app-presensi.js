// =========================================================
// PRESENSI - Direct Supabase version
// =========================================================
let dataPresensiAktif = [];
let jumlahTMAktif = 32;
let kelasPresensiAktif = '';
let tabPresensiAktif = 'input';
let tmInputAktif = 1;
let tanggalInputAktif = '';
let adaPerubahanPresensi = false;

function initHalamanPresensi() {
    const selectNilai = document.getElementById('select-kelas-nilai');
    const selectInput = document.getElementById('select-kelas-presensi-input');
    const selectRekap = document.getElementById('select-kelas-presensi-rekap');
    const selectTM = document.getElementById('select-tm-presensi');

    if (selectNilai && selectNilai.innerHTML.trim()) {
        const opts = selectNilai.innerHTML;
        if (selectInput) selectInput.innerHTML = '<option value="">— Pilih Kelas —</option>' + opts;
        if (selectRekap) selectRekap.innerHTML = '<option value="">— Pilih Kelas —</option>' + opts;
    }

    if (selectTM) {
        let tmOpts = '';
        for (let i = 1; i <= jumlahTMAktif; i++) tmOpts += `<option value="${i}">Pertemuan ${i}</option>`;
        selectTM.innerHTML = tmOpts;
    }

    const tglInput = document.getElementById('tanggal-presensi-input');
    if (tglInput && !tglInput.value) tglInput.value = new Date().toISOString().split('T')[0];

    if (selectInput) selectInput.onchange = function() { muatDataPresensi(this.value); };
    if (selectTM) selectTM.onchange = function() { tmInputAktif = parseInt(this.value); renderTabelInputHarian(); };
    if (tglInput) tglInput.onchange = function() { tanggalInputAktif = this.value; adaPerubahanPresensi = true; updateStatusSimpanPresensi(); };
    if (selectRekap) selectRekap.onchange = function() { muatDataPresensi(this.value); };

    tampilkanTabPresensi(tabPresensiAktif);
}

function tampilkanTabPresensi(tab) {
    tabPresensiAktif = tab;
    const panelInput = document.getElementById('panel-presensi-input');
    const panelRekap = document.getElementById('panel-presensi-rekap');
    const btnInput = document.getElementById('tab-btn-presensi-input');
    const btnRekap = document.getElementById('tab-btn-presensi-rekap');
    const aktif = 'px-5 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition-all';
    const inaktif = 'px-5 py-2.5 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-100 transition-all';

    if (tab === 'input') {
        panelInput.classList.remove('hidden'); panelRekap.classList.add('hidden');
        btnInput.className = aktif; btnRekap.className = inaktif;
        renderTabelInputHarian();
    } else {
        panelInput.classList.add('hidden'); panelRekap.classList.remove('hidden');
        btnInput.className = inaktif; btnRekap.className = aktif;
        renderTabelRekapPresensi();
    }
}

async function muatDataPresensi(kelasValue) {
    if (!kelasValue) { renderPesanKosongPresensi('Pilih kelas untuk menampilkan data.'); return; }
    kelasPresensiAktif = kelasValue;
    adaPerubahanPresensi = false;
    updateStatusSimpanPresensi();
    renderPesanKosongPresensi('<span class="animate-pulse text-indigo-500">Memuat data presensi...</span>');

    try {
        const data = await getDataPresensiByKelas(kelasValue);
        dataPresensiAktif = data || [];
        let maxTM = 0;
        dataPresensiAktif.forEach(s => { if (s.tanggal) Object.keys(s.tanggal).forEach(k => { if (parseInt(k) > maxTM) maxTM = parseInt(k); }); });
        jumlahTMAktif = Math.max(32, maxTM + 2);

        const stm = document.getElementById('select-tm-presensi');
        if (stm) { let o = ''; for (let i = 1; i <= jumlahTMAktif; i++) o += `<option value="${i}">Pertemuan ${i}</option>`; stm.innerHTML = o; }

        if (tabPresensiAktif === 'input') {
            tmInputAktif = 1;
            if (dataPresensiAktif.length > 0) {
                for (let tm = jumlahTMAktif; tm >= 1; tm--) { if (dataPresensiAktif[0].tanggal[tm]) { tmInputAktif = tm + 1; break; } }
                if (tmInputAktif > jumlahTMAktif) tmInputAktif = jumlahTMAktif;
            }
            if (stm) stm.value = tmInputAktif;
            renderTabelInputHarian();
        } else {
            renderTabelRekapPresensi();
        }
    } catch (err) {
        renderPesanKosongPresensi(`<span class="text-rose-500 font-bold">Gagal: ${err.message}</span>`);
    }
}

function renderPesanKosongPresensi(pesan) {
    const tr = `<tr><td colspan="20" class="py-10 text-center text-slate-400 font-semibold">${pesan}</td></tr>`;
    const i = document.getElementById('body-tabel-presensi-input');
    const r = document.getElementById('body-tabel-presensi-rekap');
    if (i) i.innerHTML = tr; if (r) r.innerHTML = tr;
}

function renderTabelInputHarian() {
    const tbody = document.getElementById('body-tabel-presensi-input');
    if (!tbody || !kelasPresensiAktif || !dataPresensiAktif.length) { renderPesanKosongPresensi('Pilih kelas.'); return; }
    const tglServer = dataPresensiAktif[0]?.tanggal?.[tmInputAktif];
    const inputTgl = document.getElementById('tanggal-presensi-input');
    if (tglServer && inputTgl) { inputTgl.value = tglServer.substring(0, 10); tanggalInputAktif = inputTgl.value; }
    else if (inputTgl) tanggalInputAktif = inputTgl.value;

    let html = '';
    dataPresensiAktif.forEach((siswa, i) => {
        let status = siswa.tm?.[tmInputAktif] || '';
        if (status === '' && !dataPresensiAktif[0].tanggal[tmInputAktif]) { status = 'H'; if (!siswa.tm) siswa.tm = {}; siswa.tm[tmInputAktif] = 'H'; adaPerubahanPresensi = true; }
        
        // Colored dropdown style based on status
        const colorMap = { H: 'bg-emerald-100 border-emerald-400 text-emerald-800', I: 'bg-sky-100 border-sky-400 text-sky-800', S: 'bg-amber-100 border-amber-400 text-amber-800', A: 'bg-rose-100 border-rose-400 text-rose-800' };
        const dropdownColor = colorMap[status] || 'bg-slate-50 border-slate-200 text-slate-600';
        
        html += `<tr class="hover:bg-slate-50/80 border-b border-slate-100">
            <td class="py-2.5 px-3 text-center text-slate-400 text-xs">${i + 1}</td>
            <td class="py-2.5 px-3 font-bold text-slate-700 text-sm">${siswa.nama}</td>
            <td class="py-2.5 px-3 text-center">
                <select onchange="pilihStatusHarian(${i}, this.value)" class="rounded-lg border-2 px-3 py-1.5 text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all ${dropdownColor}" id="sel-presensi-${i}">
                    <option value="H" ${status === 'H' ? 'selected' : ''}>✅ Hadir</option>
                    <option value="I" ${status === 'I' ? 'selected' : ''}>📋 Ijin</option>
                    <option value="S" ${status === 'S' ? 'selected' : ''}>🤒 Sakit</option>
                    <option value="A" ${status === 'A' ? 'selected' : ''}>❌ Alfa</option>
                </select>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
    updateStatusSimpanPresensi();
}

function _btnH(idx, kode, cur) {
    const map = { H: ['Hadir', 'bg-emerald-100 text-emerald-700'], I: ['Ijin', 'bg-sky-100 text-sky-700'], S: ['Sakit', 'bg-amber-100 text-amber-700'], A: ['Alfa', 'bg-rose-100 text-rose-700'] };
    const [label, cls] = map[kode];
    const active = cur === kode;
    return `<button type="button" onclick="pilihStatusHarian(${idx},'${kode}')" class="px-4 py-2 transition-all ${active ? cls : 'hover:bg-slate-50 text-slate-500 border-l border-slate-200'}">${label}</button>`;
}

function pilihStatusHarian(idx, kode) {
    dataPresensiAktif[idx].tm[tmInputAktif] = kode;
    adaPerubahanPresensi = true;
    
    // Update dropdown color immediately without full re-render
    const sel = document.getElementById('sel-presensi-' + idx);
    if (sel) {
        const colorMap = { H: 'bg-emerald-100 border-emerald-400 text-emerald-800', I: 'bg-sky-100 border-sky-400 text-sky-800', S: 'bg-amber-100 border-amber-400 text-amber-800', A: 'bg-rose-100 border-rose-400 text-rose-800' };
        sel.className = 'rounded-lg border-2 px-3 py-1.5 text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all ' + (colorMap[kode] || 'bg-slate-50 border-slate-200 text-slate-600');
    }
    updateStatusSimpanPresensi();
}

function renderTabelRekapPresensi() {
    const tbody = document.getElementById('body-tabel-presensi-rekap');
    const trHead = document.getElementById('header-baris-presensi-rekap');
    if (!tbody || !trHead || !dataPresensiAktif.length) return;

    let h = `<th class="py-3 px-3 text-center sticky left-0 bg-slate-50 z-10 border-r w-8">No</th><th class="py-3 px-4 sticky left-8 bg-slate-50 z-10 border-r min-w-[180px]">Nama</th>`;
    for (let tm = 1; tm <= jumlahTMAktif; tm++) {
        let tgl = dataPresensiAktif[0]?.tanggal?.[tm] || '';
        if (tgl) { try { const d = new Date(tgl); tgl = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; } catch(e){} }
        h += `<th class="py-2 px-1 text-center border-l min-w-[40px]"><div class="text-[10px]">T${tm}</div><div class="text-[9px] text-slate-400">${tgl || '-'}</div></th>`;
    }
    h += `<th class="py-3 px-3 text-center border-l bg-emerald-50 min-w-[80px] sticky right-0"><div class="text-[11px] text-emerald-700">% Hadir</div></th>`;
    trHead.innerHTML = h;

    let b = '';
    dataPresensiAktif.forEach((s, i) => {
        const persen = _hitungPersen(s);
        const pc = persen === null ? 'text-slate-400' : persen >= 75 ? 'text-emerald-600' : persen >= 50 ? 'text-amber-600' : 'text-rose-600';
        b += `<tr class="hover:bg-slate-50/80 border-b border-slate-100"><td class="py-2 px-3 text-center text-slate-400 text-xs sticky left-0 bg-white border-r">${i+1}</td><td class="py-2 px-4 font-semibold text-slate-700 text-sm sticky left-8 bg-white border-r truncate">${s.nama}</td>`;
        for (let tm = 1; tm <= jumlahTMAktif; tm++) {
            const st = s.tm?.[tm] || '';
            const style = st === 'H' ? 'bg-emerald-100 text-emerald-700' : st === 'I' ? 'bg-sky-100 text-sky-700' : st === 'S' ? 'bg-amber-100 text-amber-700' : st === 'A' ? 'bg-rose-100 text-rose-700' : '';
            b += `<td class="py-2 px-1 text-center border-l"><div class="mx-auto w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold ${style}">${st || '-'}</div></td>`;
        }
        b += `<td class="py-2 px-3 text-center sticky right-0 bg-white border-l"><span class="text-sm font-bold ${pc}">${persen !== null ? persen+'%' : '-'}</span></td></tr>`;
    });
    tbody.innerHTML = b;
}

function _hitungPersen(siswa) {
    if (!siswa.tm) return null;
    let max = 0;
    if (dataPresensiAktif[0]?.tanggal) Object.keys(dataPresensiAktif[0].tanggal).forEach(k => { if (dataPresensiAktif[0].tanggal[k]) max++; });
    if (max === 0) return null;
    let hadir = 0;
    for (let tm = 1; tm <= max; tm++) { const s = siswa.tm[tm]; if (s === 'H' || s === 'I') hadir++; }
    return Math.round((hadir / max) * 100);
}

function updateStatusSimpanPresensi() {
    const btn = document.getElementById('btn-simpan-presensi');
    const st = document.getElementById('status-simpan-presensi');
    if (!btn) return;
    if (adaPerubahanPresensi) {
        btn.disabled = false;
        btn.className = 'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm animate-pulse';
        if (st) { st.textContent = '⚠️ Belum disimpan'; st.className = 'text-xs font-semibold text-amber-600'; }
    } else {
        btn.disabled = true;
        btn.className = 'inline-flex items-center gap-2 bg-slate-200 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed';
        if (st) { st.textContent = dataPresensiAktif.length ? '✅ Tersimpan' : ''; st.className = 'text-xs font-semibold text-emerald-600'; }
    }
}

async function simpanPresensiSekarang() {
    if (!adaPerubahanPresensi || !kelasPresensiAktif) return;
    const btn = document.getElementById('btn-simpan-presensi');
    const inputTgl = document.getElementById('tanggal-presensi-input');
    const tanggal = inputTgl ? inputTgl.value : tanggalInputAktif;
    btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-circle" class="w-3.5 h-3.5 animate-spin inline mr-1"></i>Menyimpan...'; lucide.createIcons();

    const payload = dataPresensiAktif.map(s => ({ id_siswa: s.id_siswa, status: s.tm[tmInputAktif] || '' }));
    try {
        await simpanPresensiTMSatuKelas(kelasPresensiAktif, tmInputAktif, tanggal, payload);
        dataPresensiAktif.forEach(s => { if (!s.tanggal) s.tanggal = {}; s.tanggal[tmInputAktif] = tanggal; });
        adaPerubahanPresensi = false; updateStatusSimpanPresensi();
        btn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 inline mr-1"></i>Simpan'; lucide.createIcons();
        const notif = document.getElementById('notif-presensi');
        if (notif) { notif.innerText = `✅ TM ${tmInputAktif} tersimpan!`; notif.classList.remove('hidden'); setTimeout(() => notif.classList.add('hidden'), 3500); }
    } catch (err) {
        btn.disabled = false; btn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 inline mr-1"></i>Simpan'; lucide.createIcons();
        alert('Gagal: ' + (err.message || err));
    }
}

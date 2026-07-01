// ============================================================
// APP-NILAI.JS — Halaman Penilaian (async/await version)
// Replaces google.script.run calls with direct async API calls
// ============================================================

let jumlahTugasAktif = 1;
let dataSiswaAktif = [];
let jumlahBabAktif = 2;
let babColors = ['indigo','sky','violet','teal','pink','orange','cyan','lime'];

// =========================================================
// INISIALISASI
// =========================================================
async function muatDaftarKelasDanMapel() {
    muatPengaturan();
    try {
        const data = await getDaftarMengajar();
        const selectNilai = document.getElementById('select-kelas-nilai');
        if (!data || data.length === 0) return;
        let htmlOptions = '';
        data.forEach(item => htmlOptions += `<option value="${item.kelas}">${item.kelas} - ${item.mapel}</option>`);
        if (selectNilai) selectNilai.innerHTML = htmlOptions;
        tarikDataSiswaAsli();
        if (selectNilai) selectNilai.addEventListener('change', tarikDataSiswaAsli);
    } catch (err) {
        console.error('Gagal memuat daftar kelas:', err);
    }

    ['bobot-bab', 'bobot-hdr', 'bobot-aktf', 'bobot-sas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', validasiBobot);
            el.addEventListener('input', simpanBobotOtomatis);
        }
    });
}

function validasiBobot() {
    let total = ['bobot-bab','bobot-hdr','bobot-aktf','bobot-sas'].reduce((s, id) => s + (parseFloat(document.getElementById(id).value) || 0), 0);
    let statusEl = document.getElementById('status-bobot') || buatStatusBobot();
    if (total !== 100) {
        statusEl.innerHTML = `⚠️ Total: ${total}% (Harus 100%)`;
        statusEl.className = "text-[10px] font-bold text-rose-600 animate-pulse";
    } else {
        statusEl.innerHTML = `✅ Total: 100%`;
        statusEl.className = "text-[10px] font-bold text-emerald-600";
    }
    hitungSASdanRapor();
}

function buatStatusBobot() {
    let container = document.querySelector('.flex.flex-wrap.items-center.gap-3.bg-slate-50');
    let div = document.createElement('div');
    div.id = 'status-bobot';
    if (container) container.appendChild(div);
    return div;
}

async function muatPengaturan() {
    try {
        const bobot = await getPengaturan();
        document.getElementById('bobot-bab').value = bobot.bab;
        document.getElementById('bobot-hdr').value = bobot.hdr;
        document.getElementById('bobot-aktf').value = bobot.aktf;
        document.getElementById('bobot-sas').value = bobot.sas;
        validasiBobot();
    } catch (err) {
        console.error('Gagal memuat pengaturan:', err);
    }
}

async function simpanBobotOtomatis() {
    const bobot = {
        bab: document.getElementById('bobot-bab').value,
        hdr: document.getElementById('bobot-hdr').value,
        aktf: document.getElementById('bobot-aktf').value,
        sas: document.getElementById('bobot-sas').value
    };
    try {
        await simpanPengaturan(bobot);
    } catch (err) {
        console.error('Gagal simpan bobot:', err);
    }
}

// =========================================================
// DATA FETCHING
// =========================================================
async function tarikDataSiswaAsli() {
    const kelasDipilih = document.getElementById('select-kelas-nilai').value;
    if (!kelasDipilih) return;
    document.getElementById('body-tabel-rekap').innerHTML = '<tr><td colspan="20" class="py-8 text-center text-indigo-500 font-semibold animate-pulse">Memuat data...</td></tr>';

    try {
        const dataDariSheet = await getSiswaUntukPenilaian(kelasDipilih);
        dataSiswaAktif = dataDariSheet || [];
        // Inisialisasi struktur bab per siswa jika belum ada
        dataSiswaAktif.forEach(function(s) {
            if (!s.babs) s.babs = [];
            // Migrasi dari format lama ke array babs
            if (s.babs.length === 0 && (s.tugas.length > 0 || s.uh_asli !== '')) {
                s.babs.push({ tugas: s.tugas || [], uh_asli: s.uh_asli || '', uh_remed: s.uh_remed || '', uh_katrol: s.uh_katrol || '' });
            }
            // Pastikan minimal ada sejumlah jumlahBabAktif
            while (s.babs.length < jumlahBabAktif) {
                s.babs.push({ tugas: [], uh_asli: '', uh_remed: '', uh_katrol: '' });
            }
        });
        renderBtnBab();
        renderHeaderRekap();
        renderTabelUtama();
    } catch (err) {
        document.getElementById('body-tabel-rekap').innerHTML = `<tr><td colspan="20" class="py-8 text-center text-rose-500 font-bold">Gagal: ${err.message}</td></tr>`;
    }
}

// =========================================================
// RENDER TOMBOL BAB (DINAMIS)
// =========================================================
function renderBtnBab() {
    const container = document.getElementById('container-btn-bab');
    if (!container) return;
    let html = '';
    for (let i = 1; i <= jumlahBabAktif; i++) {
        let color = babColors[(i - 1) % babColors.length];
        html += `<button onclick="bukaModalDetail(${i})" class="bg-${color}-50 hover:bg-${color}-100 text-${color}-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors border border-${color}-200"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Bab ${i}</button>`;
    }
    html += `<button onclick="tambahBabBaru()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors border border-indigo-200"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Tambah Bab</button>`;
    html += `<button onclick="bukaModalSAS()" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors border border-emerald-200"><i data-lucide="user-check" class="w-3.5 h-3.5"></i> Input SAS & Non-Akad</button>`;
    container.innerHTML = html;
    lucide.createIcons();
}

function tambahBabBaru() {
    jumlahBabAktif++;
    dataSiswaAktif.forEach(function(s) {
        if (!s.babs) s.babs = [];
        while (s.babs.length < jumlahBabAktif) {
            s.babs.push({ tugas: [], uh_asli: '', uh_remed: '', uh_katrol: '' });
        }
    });
    renderBtnBab();
    renderHeaderRekap();
    renderTabelUtama();
}

function hapusBabTerakhir() {
    if (jumlahBabAktif <= 1) { alert('Minimal harus ada 1 bab.'); return; }
    if (!confirm(`Hapus Bab ${jumlahBabAktif}? Data nilai bab ini akan hilang.`)) return;
    dataSiswaAktif.forEach(function(s) { if (s.babs && s.babs.length >= jumlahBabAktif) s.babs.pop(); });
    jumlahBabAktif--;
    renderBtnBab(); renderHeaderRekap(); renderTabelUtama();
}

// =========================================================
// RENDER HEADER & TABEL REKAP DINAMIS
// =========================================================
function renderHeaderRekap() {
    const tr = document.getElementById('header-tabel-rekap');
    if (!tr) return;
    let html = `<th class="py-3 px-4 text-center w-12">No</th><th class="py-3 px-4 min-w-[150px]">Nama Siswa</th>`;
    for (let i = 1; i <= jumlahBabAktif; i++) {
        let color = babColors[(i - 1) % babColors.length];
        html += `<th class="py-3 px-3 text-center bg-${color}-50/30 text-${color}-700 border-x">B${i}_Tgs</th>`;
        html += `<th class="py-3 px-3 text-center bg-${color}-50/30 text-${color}-700 border-r">B${i}_UH</th>`;
    }
    html += `<th class="py-3 px-3 text-center border-r">Hdr (%)</th>`;
    html += `<th class="py-3 px-3 text-center border-r">Aktf</th>`;
    html += `<th class="py-3 px-3 text-center bg-amber-50/30 text-amber-700 border-r">SAS</th>`;
    html += `<th class="py-3 px-3 text-center bg-amber-50/30 text-amber-700 border-r">SAS_Rmd</th>`;
    html += `<th class="py-3 px-4 text-center bg-slate-900 text-white border-r">N_Rapor</th>`;
    html += `<th class="py-3 px-4 text-center">Status</th>`;
    tr.innerHTML = html;
}

function renderTabelUtama() {
    const bodyTabel = document.getElementById('body-tabel-rekap');
    if (!bodyTabel) return;
    if (dataSiswaAktif.length === 0) {
        bodyTabel.innerHTML = '<tr><td colspan="20" class="py-8 text-center text-slate-400 font-semibold">Pilih kelas untuk menampilkan data.</td></tr>';
        return;
    }

    hitungSASdanRapor(false);
    let htmlRows = '';
    dataSiswaAktif.forEach((s) => {
        htmlRows += `<tr class="hover:bg-slate-50/80 transition-colors">`;
        htmlRows += `<td class="py-3 px-4 text-center text-slate-400">${s.no}</td>`;
        htmlRows += `<td class="py-3 px-4 font-semibold text-slate-700">${s.nama}</td>`;
        for (let i = 0; i < jumlahBabAktif; i++) {
            let bab = (s.babs && s.babs[i]) || { tugas: [], uh_katrol: '' };
            let color = babColors[i % babColors.length];
            let avgTgs = '-';
            if (bab.tugas && bab.tugas.length > 0) {
                let sum = 0, cnt = 0;
                bab.tugas.forEach(t => { if (t !== '' && t !== undefined) { sum += parseFloat(t); cnt++; } });
                avgTgs = cnt > 0 ? Math.round(sum / cnt) : '-';
            }
            htmlRows += `<td class="py-3 px-3 text-center bg-${color}-50/10 border-x">${avgTgs}</td>`;
            htmlRows += `<td class="py-3 px-3 text-center bg-${color}-50/10 border-r font-bold text-${color}-700">${bab.uh_katrol || '-'}</td>`;
        }
        htmlRows += `<td class="py-3 px-3 text-center border-r">${s.hdr !== '' ? s.hdr + '%' : '-'}</td>`;
        htmlRows += `<td class="py-3 px-3 text-center border-r">${s.aktf !== '' ? s.aktf + '%' : '-'}</td>`;
        htmlRows += `<td class="py-3 px-3 text-center bg-amber-50/10 border-r">${s.sas_asli || '-'}</td>`;
        htmlRows += `<td class="py-3 px-3 text-center bg-amber-50/10 border-r">${s.sas_katrol || '-'}</td>`;
        let raporColor = s.status === 'TUNTAS' ? 'text-emerald-600' : (s.status === 'TIDAK TUNTAS' ? 'text-rose-500' : 'text-slate-400');
        htmlRows += `<td class="py-3 px-4 text-center bg-slate-50 font-bold ${raporColor} border-r text-base">${s.rapor || '-'}</td>`;
        htmlRows += `<td class="py-3 px-4 text-center text-[10px] font-bold ${s.status === 'TUNTAS' ? 'text-emerald-600' : 'text-rose-500'}">${s.status || '-'}</td>`;
        htmlRows += `</tr>`;
    });
    bodyTabel.innerHTML = htmlRows;
}

// =========================================================
// MODAL DETAIL BAB (Input tugas + UH per bab)
// =========================================================
let babSedangDiedit = 1;

function bukaModalDetail(nomorBab) {
    if (dataSiswaAktif.length === 0) return;
    babSedangDiedit = nomorBab;
    document.getElementById('judul-modal-bab').innerHTML = `<i data-lucide="edit" class="w-5 h-5 text-indigo-600"></i> Input Nilai - Bab ${nomorBab}`;
    document.getElementById('modal-detail-bab').classList.remove('hidden');
    // Set jumlah tugas dari data bab ini
    let maxTugas = 1;
    dataSiswaAktif.forEach(function(s) {
        if (s.babs[nomorBab - 1] && s.babs[nomorBab - 1].tugas.length > maxTugas) maxTugas = s.babs[nomorBab - 1].tugas.length;
    });
    jumlahTugasAktif = Math.max(1, maxTugas);
    renderHeaderTabelDetail();
    renderDataTabelDetail();
    hitungKatrolSistem();
    lucide.createIcons();
}

async function tutupModalDetail() {
    const drp = document.getElementById('select-kelas-nilai');
    document.body.style.cursor = 'wait';
    try {
        await simpanDataNilaiBab(drp.value, drp.options[drp.selectedIndex].text.split(' - ')[1], 'Bab ' + babSedangDiedit, dataSiswaAktif);
        document.body.style.cursor = 'default';
        document.getElementById('modal-detail-bab').classList.add('hidden');
        tarikDataSiswaAsli();
    } catch (err) {
        document.body.style.cursor = 'default';
        alert('Gagal menyimpan: ' + (err.message || err));
    }
}

function tambahKolomTugas() { jumlahTugasAktif++; renderHeaderTabelDetail(); renderDataTabelDetail(); }

function renderHeaderTabelDetail() {
    let html = `<th class="py-3 px-4 w-12 text-center">No</th><th class="py-3 px-4 min-w-[200px]">Nama Siswa</th>`;
    for (let i = 1; i <= jumlahTugasAktif; i++) html += `<th class="py-3 px-3 text-center border-l border-slate-200">Tugas ${i}</th>`;
    html += `<th class="py-3 px-3 text-center bg-indigo-50 text-indigo-700 border-l border-indigo-100">UH Asli</th>`;
    html += `<th class="py-3 px-3 text-center bg-rose-50 text-rose-700 border-l border-rose-100">Status Remed</th>`;
    html += `<th class="py-3 px-3 text-center bg-emerald-50 text-emerald-700 border-l border-emerald-100">UH Katrol</th>`;
    document.getElementById('header-baris-detail').innerHTML = html;
}

function renderDataTabelDetail() {
    let htmlRows = '';
    dataSiswaAktif.forEach((s, index) => {
        let bab = s.babs[babSedangDiedit - 1] || { tugas: [], uh_asli: '', uh_remed: '', uh_katrol: '' };
        let isRemed = bab.uh_asli !== "" && bab.uh_asli < 75;
        let statusRemed = isRemed ? '' : 'disabled';
        let clInput = isRemed ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-100 border-transparent text-slate-400';

        htmlRows += `<tr class="hover:bg-slate-50 transition-colors ${isRemed ? 'bg-rose-50/20' : ''}">`;
        htmlRows += `<td class="py-2 px-4 text-center text-slate-400">${s.no}</td>`;
        htmlRows += `<td class="py-2 px-4 font-semibold text-slate-700">${s.nama}</td>`;
        for (let i = 0; i < jumlahTugasAktif; i++) {
            let val = (bab.tugas && bab.tugas[i] !== undefined) ? bab.tugas[i] : '';
            htmlRows += `<td class="py-2 px-2 border-l border-slate-100"><input type="number" value="${val}" onchange="updateTugas(${index},${i},this.value)" class="w-16 text-center p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-medium bg-white"></td>`;
        }
        htmlRows += `<td class="py-2 px-2 border-l border-slate-100 bg-indigo-50/30 text-center"><input type="number" value="${bab.uh_asli}" onchange="updateUhAsli(${index},this.value)" class="w-16 text-center p-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700 bg-white"></td>`;
        htmlRows += `<td class="py-2 px-2 border-l border-slate-100 bg-rose-50/40 text-center"><input type="text" placeholder="Tiket" value="${bab.uh_remed || ''}" onchange="updateUhRemed(${index},this.value)" ${statusRemed} class="w-20 text-center p-2 border rounded-lg text-[11px] focus:ring-2 focus:ring-rose-500 font-bold ${clInput}"></td>`;
        htmlRows += `<td class="py-2 px-4 border-l border-slate-100 bg-emerald-50/30 text-center font-bold text-emerald-600 text-base">${bab.uh_katrol || ''}</td>`;
        htmlRows += `</tr>`;
    });
    document.getElementById('body-tabel-detail').innerHTML = htmlRows;
}

function updateTugas(index, idx, val) {
    let bab = dataSiswaAktif[index].babs[babSedangDiedit - 1];
    if (!bab.tugas) bab.tugas = [];
    bab.tugas[idx] = val;
}

function updateUhAsli(index, val) {
    let bab = dataSiswaAktif[index].babs[babSedangDiedit - 1];
    bab.uh_asli = val === "" ? "" : parseFloat(val);
    if (bab.uh_asli >= 75) bab.uh_remed = "";
    hitungKatrolSistem();
}

function updateUhRemed(index, val) {
    dataSiswaAktif[index].babs[babSedangDiedit - 1].uh_remed = val;
    hitungKatrolSistem();
}

function hitungKatrolSistem() {
    let nAsliArr = dataSiswaAktif.map(s => parseFloat(s.babs[babSedangDiedit - 1].uh_asli)).filter(n => !isNaN(n));
    if (nAsliArr.length > 0) {
        let nMin = Math.min(...nAsliArr), nMax = Math.max(...nAsliArr);
        dataSiswaAktif.forEach(s => {
            let bab = s.babs[babSedangDiedit - 1];
            let nAsli = parseFloat(bab.uh_asli);
            if (isNaN(nAsli)) { bab.uh_katrol = ""; }
            else if (nAsli < 75 && String(bab.uh_remed).trim() === "") { bab.uh_katrol = nAsli; }
            else { bab.uh_katrol = (nMax === nMin) ? Math.max(80, nAsli) : Math.round(80 + ((nAsli - nMin) / (nMax - nMin)) * 20); }
        });
    }
    renderHeaderTabelDetail();
    renderDataTabelDetail();
}

// =========================================================
// MODAL SAS & NON-AKADEMIK
// =========================================================
async function bukaModalSAS() {
    if (dataSiswaAktif.length === 0) return;
    document.getElementById('modal-detail-sas').classList.remove('hidden');
    renderDataTabelSAS();
    hitungSASdanRapor();
    lucide.createIcons();

    const btnImport = document.getElementById('btn-import-hdr-aktf');
    if (btnImport) btnImport.classList.remove('hidden');

    // Auto-import kehadiran jika ada yang kosong
    const adaHdrKosong = dataSiswaAktif.some(s => s.hdr === '' || s.hdr === null || s.hdr === undefined);
    if (adaHdrKosong) {
        const kelas = document.getElementById('select-kelas-nilai')?.value;
        if (kelas) {
            try {
                const dataHadir = await getPersentaseKehadiranByKelas(kelas);
                const mapHadir = {};
                (dataHadir || []).forEach(d => { mapHadir[d.nama] = d.persen_hadir; });
                let diisi = 0;
                dataSiswaAktif.forEach(s => {
                    if ((s.hdr === '' || s.hdr === null || s.hdr === undefined) && mapHadir[s.nama] !== undefined) { s.hdr = mapHadir[s.nama]; diisi++; }
                });
                if (diisi > 0) { renderDataTabelSAS(); hitungSASdanRapor(); }
            } catch (err) {
                console.error('Gagal auto-import kehadiran:', err);
            }
        }
    }
}

async function tutupModalSAS() {
    const drp = document.getElementById('select-kelas-nilai');
    document.body.style.cursor = 'wait';
    try {
        await simpanDataNilaiSAS(drp.value, drp.options[drp.selectedIndex].text.split(' - ')[1], dataSiswaAktif);
        document.body.style.cursor = 'default';
        document.getElementById('modal-detail-sas').classList.add('hidden');
        tarikDataSiswaAsli();
    } catch (err) {
        document.body.style.cursor = 'default';
        alert('Gagal menyimpan: ' + (err.message || err));
    }
}

function renderDataTabelSAS() {
    let htmlRows = '';
    dataSiswaAktif.forEach((s, index) => {
        let isRemed = s.sas_asli !== "" && s.sas_asli < 75;
        let statusRemed = isRemed ? '' : 'disabled';
        let clInput = isRemed ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-100 border-transparent text-slate-400';
        htmlRows += `<tr class="hover:bg-slate-50 transition-colors">
            <td class="py-2 px-4 text-center text-slate-400">${s.no}</td>
            <td class="py-2 px-4 font-semibold text-slate-700">${s.nama}</td>
            <td class="py-2 px-2 border-l text-center"><div class="flex items-center gap-1 justify-center"><input type="number" value="${s.hdr}" onchange="updateSASField(${index},'hdr',this.value)" class="w-16 text-center p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"><span class="text-[10px] text-slate-400">%</span></div></td>
            <td class="py-2 px-2 border-l text-center"><div class="flex items-center gap-1 justify-center"><input type="number" value="${s.aktf}" onchange="updateSASField(${index},'aktf',this.value)" class="w-16 text-center p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"><span class="text-[10px] text-slate-400">%</span></div></td>
            <td class="py-2 px-2 border-l bg-amber-50/30 text-center"><input type="number" value="${s.sas_asli}" onchange="updateSASField(${index},'sas_asli',this.value)" class="w-16 text-center p-2 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 font-bold text-amber-700 bg-white"></td>
            <td class="py-2 px-2 border-l bg-rose-50/40 text-center"><input type="text" placeholder="Tiket" value="${s.sas_remed || ''}" onchange="updateSASField(${index},'sas_remed',this.value)" ${statusRemed} class="w-20 text-center p-2 border rounded-lg text-[11px] focus:ring-2 focus:ring-rose-500 font-bold ${clInput}"></td>
            <td class="py-2 px-4 border-l bg-emerald-50/30 text-center font-bold text-emerald-600 text-base">${s.sas_katrol || ''}</td>
        </tr>`;
    });
    document.getElementById('body-tabel-sas').innerHTML = htmlRows;
}

async function importDataHdrAktf() {
    const kelas = document.getElementById('select-kelas-nilai')?.value;
    if (!kelas || dataSiswaAktif.length === 0) return;
    const btnImport = document.getElementById('btn-import-hdr-aktf');
    if (btnImport) { btnImport.disabled = true; btnImport.innerHTML = '<i data-lucide="loader-circle" class="w-3.5 h-3.5 animate-spin inline mr-1"></i>Memuat...'; lucide.createIcons(); }

    try {
        const hasil = await importRekapHdrDanAktf(kelas);
        const mapHadir = hasil.kehadiran || {}, mapAktf = hasil.keaktifan || {};
        dataSiswaAktif.forEach(s => {
            if (mapHadir[s.nama] !== undefined) s.hdr = mapHadir[s.nama];
            if (mapAktf[s.nama] !== undefined) s.aktf = mapAktf[s.nama];
        });
        renderDataTabelSAS(); hitungSASdanRapor();
        if (btnImport) { btnImport.disabled = false; btnImport.innerHTML = '⬇ Import Hdr & Aktf'; }
    } catch (err) {
        if (btnImport) { btnImport.disabled = false; btnImport.innerHTML = '⬇ Import Hdr & Aktf'; }
        alert('Gagal: ' + err.message);
    }
}

function updateSASField(index, field, val) {
    dataSiswaAktif[index][field] = field === 'sas_remed' ? val : (val === "" ? "" : parseFloat(val));
    if (field === 'sas_asli' && dataSiswaAktif[index].sas_asli >= 75) dataSiswaAktif[index].sas_remed = "";
    hitungSASdanRapor();
}

// =========================================================
// HITUNG NILAI RAPOR (SUPPORT MULTI-BAB)
// =========================================================
function hitungSASdanRapor(renderUlangLayar = true) {
    // Katrol SAS
    let nAsliArr = dataSiswaAktif.map(s => parseFloat(s.sas_asli)).filter(n => !isNaN(n));
    let nMin = nAsliArr.length > 0 ? Math.min(...nAsliArr) : 0;
    let nMax = nAsliArr.length > 0 ? Math.max(...nAsliArr) : 0;

    let bbtBab = parseFloat(document.getElementById('bobot-bab').value) / 100 || 0;
    let bbtHdr = parseFloat(document.getElementById('bobot-hdr').value) / 100 || 0;
    let bbtAktf = parseFloat(document.getElementById('bobot-aktf').value) / 100 || 0;
    let bbtSas = parseFloat(document.getElementById('bobot-sas').value) / 100 || 0;

    dataSiswaAktif.forEach(s => {
        // Katrol SAS
        let nSas = parseFloat(s.sas_asli);
        if (isNaN(nSas)) { s.sas_katrol = ""; }
        else if (nSas < 75 && String(s.sas_remed || '').trim() === "") { s.sas_katrol = nSas; }
        else { s.sas_katrol = (nMax === nMin) ? Math.max(80, nSas) : Math.round(80 + ((nSas - nMin) / (nMax - nMin)) * 20); }

        // Rata-rata semua bab (UH Katrol)
        let totalBab = 0, countBab = 0;
        if (s.babs) {
            s.babs.forEach(function(bab) {
                let uh = parseFloat(bab.uh_katrol);
                if (!isNaN(uh) && uh > 0) { totalBab += uh; countBab++; }
            });
        }
        let avgBab = countBab > 0 ? totalBab / countBab : 0;

        let nHdr = parseFloat(s.hdr) || 0;
        let nAktf = parseFloat(s.aktf) || 0;
        let nSasKtrl = parseFloat(s.sas_katrol) || 0;

        if (avgBab > 0 || nHdr > 0 || nAktf > 0 || nSasKtrl > 0) {
            let rapor = (avgBab * bbtBab) + (nHdr * bbtHdr) + (nAktf * bbtAktf) + (nSasKtrl * bbtSas);
            s.rapor = Math.round(rapor * 10) / 10;
            s.status = s.rapor >= 75 ? "TUNTAS" : "TIDAK TUNTAS";
        } else { s.rapor = ""; s.status = ""; }
    });

    if (renderUlangLayar) { renderDataTabelSAS(); renderTabelUtama(); }
}

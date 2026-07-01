// ============================================================
// APP-KEAKTIFAN.JS — Halaman Keaktifan (async/await version)
// Replaces google.script.run calls with direct async API calls
// ============================================================

// =========================================================
// KONFIGURASI BOBOT AKTIVITAS
// =========================================================
const BOBOT_AKTIVITAS = {
    'Bertanya': 1,
    'Menjawab': 2,
    'Maju':     3,
    'Tidur':    -1,
    'Gaduh':    -1
};

const URUTAN_AKTIVITAS = ['Bertanya', 'Menjawab', 'Maju', 'Tidur', 'Gaduh'];

const STYLE_AKTIVITAS = {
    'Bertanya': { bg: 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700',                 badge: 'bg-sky-100 text-sky-700',    icon: '🙋' },
    'Menjawab': { bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', icon: '✅' },
    'Maju':     { bg: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700',     badge: 'bg-indigo-100 text-indigo-700',  icon: '🚀' },
    'Tidur':    { bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700',         badge: 'bg-amber-100 text-amber-700',    icon: '😴' },
    'Gaduh':    { bg: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700',             badge: 'bg-rose-100 text-rose-700',     icon: '📢' }
};

// =========================================================
// STATE KEAKTIFAN
// =========================================================
let logHariIni = {};
let logAwal    = {};
let kelasKeaktifanAktif  = '';
let tanggalKeaktifanAktif = '';
let daftarSiswaKeaktifan  = [];
let tabKeaktifanAktif     = 'input';
let siswaModalAktif       = null;
let adaPerubahanKeaktifan = false;

// =========================================================
// INISIALISASI
// =========================================================
function initHalamanKeaktifan() {
    const selectNilai       = document.getElementById('select-kelas-nilai');
    const selectInputKelas  = document.getElementById('select-kelas-keaktifan-input');
    const selectRekapKelas  = document.getElementById('select-kelas-keaktifan-rekap');

    if (selectNilai && selectNilai.innerHTML.trim()) {
        const optionsHTML = selectNilai.innerHTML;
        if (selectInputKelas) {
            selectInputKelas.innerHTML = '<option value="">— Pilih Kelas —</option>' + optionsHTML;
            selectInputKelas.onchange = function() { muatSiswaKeaktifan(); };
        }
        if (selectRekapKelas) {
            selectRekapKelas.innerHTML = '<option value="">— Pilih Kelas —</option>' + optionsHTML;
            selectRekapKelas.onchange = function() { muatRekapKeaktifan(); };
        }
    }

    const today = new Date().toISOString().split('T')[0];
    ['tanggal-keaktifan-input','tanggal-keaktifan-rekap','tanggal-keaktifan-mulai','tanggal-keaktifan-akhir'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = today;
    });

    const tglInput = document.getElementById('tanggal-keaktifan-input');
    if (tglInput) tglInput.onchange = function() { muatSiswaKeaktifan(); };

    ['tanggal-keaktifan-rekap','tanggal-keaktifan-mulai','tanggal-keaktifan-akhir'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onchange = function() { muatRekapKeaktifan(); };
    });

    tampilkanTabKeaktifan(tabKeaktifanAktif);
}

// =========================================================
// NAVIGASI TAB
// =========================================================
function tampilkanTabKeaktifan(tab) {
    tabKeaktifanAktif = tab;
    const panelInput = document.getElementById('panel-keaktifan-input');
    const panelRekap = document.getElementById('panel-keaktifan-rekap');
    const btnInput   = document.getElementById('tab-btn-keaktifan-input');
    const btnRekap   = document.getElementById('tab-btn-keaktifan-rekap');

    const aktifClass   = 'px-5 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition-all';
    const inaktifClass = 'px-5 py-2.5 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-100 transition-all';

    if (tab === 'input') {
        panelInput.classList.remove('hidden');
        panelRekap.classList.add('hidden');
        btnInput.className = aktifClass;
        btnRekap.className = inaktifClass;
    } else {
        panelInput.classList.add('hidden');
        panelRekap.classList.remove('hidden');
        btnInput.className = inaktifClass;
        btnRekap.className = aktifClass;
    }
}

// =========================================================
// TAB INPUT — Muat siswa + log hari ini
// =========================================================
async function muatSiswaKeaktifan() {
    const kelas   = document.getElementById('select-kelas-keaktifan-input').value;
    const tanggal = document.getElementById('tanggal-keaktifan-input').value;

    if (!kelas) { renderPesanKosongInput('Pilih kelas untuk menampilkan daftar siswa.'); return; }
    if (!tanggal) { renderPesanKosongInput('Pilih tanggal terlebih dahulu.'); return; }

    kelasKeaktifanAktif   = kelas;
    tanggalKeaktifanAktif = tanggal;
    adaPerubahanKeaktifan = false;
    updateStatusSimpan();

    renderPesanKosongInput('<span class="animate-pulse text-indigo-500">Memuat daftar siswa...</span>');

    try {
        const hasil = await getSiswaDanKeaktifanHariIni(kelas, tanggal);
        daftarSiswaKeaktifan = hasil.siswa || [];
        const serverLog = hasil.logHariIni || {};

        logHariIni = {};
        daftarSiswaKeaktifan.forEach(s => {
            const nama = s.nama;
            const srv  = serverLog[nama] || {};
            logHariIni[nama] = {};
            URUTAN_AKTIVITAS.forEach(a => logHariIni[nama][a] = srv[a] || 0);
        });

        logAwal = JSON.parse(JSON.stringify(logHariIni));
        renderDaftarSiswaInput();
    } catch (err) {
        renderPesanKosongInput(`<span class="text-rose-500">Gagal memuat siswa: ${err.message}</span>`);
    }
}

// =========================================================
// TAB INPUT — Render kartu nama siswa
// =========================================================
function renderDaftarSiswaInput() {
    const container = document.getElementById('container-kartu-siswa');
    if (!container) return;

    if (!daftarSiswaKeaktifan || daftarSiswaKeaktifan.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 text-slate-400">
                <i data-lucide="users" class="w-10 h-10 mx-auto mb-3 opacity-30"></i>
                <p class="font-semibold">Tidak ada siswa di kelas ini.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    let html = '';
    daftarSiswaKeaktifan.forEach((siswa, idx) => {
        const nama       = siswa.nama;
        const log        = logHariIni[nama] || {};
        const totalPoin  = hitungTotalPoin(log);
        const totalKlik  = URUTAN_AKTIVITAS.reduce((s, a) => s + (log[a] || 0), 0);
        const inisial    = nama.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const avatarColors = [
            'bg-indigo-100 text-indigo-700', 'bg-sky-100 text-sky-700',
            'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700',
            'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700',
            'bg-teal-100 text-teal-700', 'bg-orange-100 text-orange-700',
        ];
        const avatarColor = avatarColors[idx % avatarColors.length];
        const poinColor   = totalPoin > 0 ? 'text-indigo-600' : totalPoin < 0 ? 'text-rose-500' : 'text-slate-400';

        html += `
        <div onclick="bukaModalAktivitas('${escapeAttr(nama)}')"
             id="kartu-${CSS.escape(nama)}"
             class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:border-indigo-300 hover:shadow-md active:scale-[0.98] transition-all select-none">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${avatarColor}">
                ${inisial}
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-800 text-sm truncate">${escapeHtml(nama)}</p>
                <p class="text-[11px] text-slate-400 mt-0.5">${totalKlik > 0 ? totalKlik + ' aktivitas hari ini' : 'Belum ada aktivitas'}</p>
            </div>
            <div class="text-right shrink-0">
                <p id="poin-${CSS.escape(nama)}" class="text-lg font-black ${poinColor}">${totalPoin > 0 ? '+' + totalPoin : totalPoin}</p>
                <p class="text-[10px] text-slate-400 font-medium">poin</p>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    lucide.createIcons();
}

function renderPesanKosongInput(pesan) {
    const container = document.getElementById('container-kartu-siswa');
    if (container) {
        container.innerHTML = `<div class="col-span-full text-center py-16 text-slate-400 font-semibold">${pesan}</div>`;
    }
}

// =========================================================
// MODAL AKTIVITAS
// =========================================================
function bukaModalAktivitas(nama) {
    siswaModalAktif = nama;
    const log       = logHariIni[nama] || {};
    const totalPoin = hitungTotalPoin(log);
    const inisial   = nama.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const tombolAktivitas = URUTAN_AKTIVITAS.map(aktivitas => {
        const count  = log[aktivitas] || 0;
        const style  = STYLE_AKTIVITAS[aktivitas] || {};
        const bobot  = BOBOT_AKTIVITAS[aktivitas];
        const label  = bobot > 0 ? `+${bobot}` : `${bobot}`;
        return `
        <button
            onclick="catatAktivitas('${escapeAttr(nama)}', '${aktivitas}'); event.stopPropagation();"
            id="modal-btn-${CSS.escape(nama)}-${aktivitas}"
            class="flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 text-center font-semibold transition-all active:scale-95 flex-1 min-w-[80px] ${style.bg || ''}"
            title="${aktivitas} (${label} poin)"
        >
            <span class="text-2xl">${style.icon || ''}</span>
            <span class="text-xs font-bold">${aktivitas}</span>
            <span class="text-[11px] opacity-70">${label} poin</span>
            <span id="modal-count-${CSS.escape(nama)}-${aktivitas}"
                  class="mt-1 ${style.badge || 'bg-white/70'} rounded-full px-2.5 py-0.5 text-xs font-black">
                ${count}×
            </span>
        </button>`;
    }).join('');

    const modalHtml = `
    <div id="overlay-modal-aktivitas"
         onclick="tutupModalAktivitasJikaBackdrop(event)"
         class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-200"
             onclick="event.stopPropagation()">
            <div class="p-5 border-b border-slate-100 flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-lg shrink-0">
                    ${inisial}
                </div>
                <div class="flex-1">
                    <p class="font-bold text-slate-800 text-base leading-tight">${escapeHtml(nama)}</p>
                    <p class="text-xs text-slate-400">${formatTanggal(tanggalKeaktifanAktif)} · ${kelasKeaktifanAktif}</p>
                </div>
                <div class="text-right mr-2">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
                    <p id="modal-total-poin-${CSS.escape(nama)}"
                       class="text-2xl font-black ${totalPoin >= 0 ? 'text-indigo-600' : 'text-rose-500'}">
                        ${totalPoin > 0 ? '+' + totalPoin : totalPoin}
                    </p>
                </div>
                <button onclick="tutupModalAktivitas()"
                        class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-colors">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="p-5 flex flex-wrap gap-3 justify-center">
                ${tombolAktivitas}
            </div>
            <div id="modal-notif-aktivitas" class="hidden mx-5 mb-4 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-center transition-all"></div>
        </div>
    </div>`;

    const wrapper = document.getElementById('modal-aktivitas-wrapper');
    if (wrapper) { wrapper.innerHTML = modalHtml; }
    lucide.createIcons();
}

function tutupModalAktivitas() {
    const wrapper = document.getElementById('modal-aktivitas-wrapper');
    if (wrapper) wrapper.innerHTML = '';
    siswaModalAktif = null;
}

function tutupModalAktivitasJikaBackdrop(event) {
    if (event.target.id === 'overlay-modal-aktivitas') tutupModalAktivitas();
}

// =========================================================
// CATAT AKTIVITAS — LOCAL ONLY
// =========================================================
function catatAktivitas(nama, aktivitas) {
    const bobot = BOBOT_AKTIVITAS[aktivitas];
    if (bobot === undefined) return;

    if (!logHariIni[nama]) {
        logHariIni[nama] = {};
        URUTAN_AKTIVITAS.forEach(a => logHariIni[nama][a] = 0);
    }
    logHariIni[nama][aktivitas] = (logHariIni[nama][aktivitas] || 0) + 1;

    updateUIModal(nama);
    updateKartuGrid(nama);
    tampilkanNotifModal(nama, aktivitas, bobot);

    adaPerubahanKeaktifan = true;
    updateStatusSimpan();
}

function updateUIModal(nama) {
    if (siswaModalAktif !== nama) return;
    const log       = logHariIni[nama] || {};
    const totalPoin = hitungTotalPoin(log);

    const elTotal = document.getElementById('modal-total-poin-' + CSS.escape(nama));
    if (elTotal) {
        elTotal.textContent = totalPoin > 0 ? '+' + totalPoin : totalPoin;
        elTotal.className   = `text-2xl font-black ${totalPoin >= 0 ? 'text-indigo-600' : 'text-rose-500'}`;
    }

    URUTAN_AKTIVITAS.forEach(aktivitas => {
        const elCount = document.getElementById('modal-count-' + CSS.escape(nama) + '-' + aktivitas);
        if (elCount) elCount.textContent = (log[aktivitas] || 0) + '×';
    });
}

function updateKartuGrid(nama) {
    const log       = logHariIni[nama] || {};
    const totalPoin = hitungTotalPoin(log);
    const totalKlik = URUTAN_AKTIVITAS.reduce((s, a) => s + (log[a] || 0), 0);

    const elPoin = document.getElementById('poin-' + CSS.escape(nama));
    if (elPoin) {
        elPoin.textContent = totalPoin > 0 ? '+' + totalPoin : totalPoin;
        elPoin.className   = `text-lg font-black ${totalPoin > 0 ? 'text-indigo-600' : totalPoin < 0 ? 'text-rose-500' : 'text-slate-400'}`;
    }

    const kartu = document.getElementById('kartu-' + CSS.escape(nama));
    if (kartu) {
        const subtext = kartu.querySelector('p.text-\\[11px\\]');
        if (subtext) subtext.textContent = totalKlik > 0 ? totalKlik + ' aktivitas hari ini' : 'Belum ada aktivitas';
    }
}

function tampilkanNotifModal(nama, aktivitas, bobot) {
    const elNotif = document.getElementById('modal-notif-aktivitas');
    if (!elNotif) return;
    const label = bobot >= 0 ? `+${bobot}` : `${bobot}`;
    elNotif.textContent = `✓ ${aktivitas} dicatat (${label} poin) — tekan Simpan untuk menyimpan`;
    elNotif.classList.remove('hidden');
    clearTimeout(elNotif._t);
    elNotif._t = setTimeout(() => elNotif.classList.add('hidden'), 2500);

    const elBarNotif = document.getElementById('notif-keaktifan');
    if (elBarNotif) {
        elBarNotif.textContent = `📝 ${nama}: ${aktivitas} (${label} poin) dicatat`;
        elBarNotif.classList.remove('hidden');
        clearTimeout(elBarNotif._t);
        elBarNotif._t = setTimeout(() => elBarNotif.classList.add('hidden'), 2500);
    }
}

// =========================================================
// STATUS SIMPAN & TOMBOL SIMPAN
// =========================================================
function updateStatusSimpan() {
    const btnSimpan    = document.getElementById('btn-simpan-keaktifan');
    const statusSimpan = document.getElementById('status-simpan-keaktifan');

    if (!btnSimpan) return;

    if (adaPerubahanKeaktifan) {
        btnSimpan.disabled   = false;
        btnSimpan.className  = 'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm animate-pulse';
        if (statusSimpan) {
            statusSimpan.textContent = '⚠️ Ada perubahan belum disimpan';
            statusSimpan.className   = 'text-xs font-semibold text-amber-600';
        }
    } else {
        btnSimpan.disabled   = true;
        btnSimpan.className  = 'inline-flex items-center gap-2 bg-slate-200 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed';
        if (statusSimpan) {
            statusSimpan.textContent = daftarSiswaKeaktifan.length > 0 ? '✅ Semua perubahan tersimpan' : '';
            statusSimpan.className   = 'text-xs font-semibold text-emerald-600';
        }
    }
}

async function simpanKeaktifanSekarang() {
    if (!adaPerubahanKeaktifan) return;
    if (!kelasKeaktifanAktif || !tanggalKeaktifanAktif) return;

    const btnSimpan = document.getElementById('btn-simpan-keaktifan');
    if (btnSimpan) {
        btnSimpan.disabled  = true;
        btnSimpan.innerHTML = '<i data-lucide="loader-circle" class="w-3.5 h-3.5 animate-spin inline mr-1"></i>Menyimpan...';
        lucide.createIcons();
    }

    // Hitung delta
    const daftarAktivitas = [];
    daftarSiswaKeaktifan.forEach(s => {
        const nama = s.nama;
        URUTAN_AKTIVITAS.forEach(aktivitas => {
            const countSekarang = (logHariIni[nama] || {})[aktivitas] || 0;
            const countAwal     = (logAwal[nama]    || {})[aktivitas] || 0;
            const delta         = countSekarang - countAwal;
            if (delta > 0) {
                for (let i = 0; i < delta; i++) {
                    daftarAktivitas.push({
                        nama_siswa: nama,
                        aktivitas:  aktivitas,
                        poin:       BOBOT_AKTIVITAS[aktivitas]
                    });
                }
            }
        });
    });

    if (daftarAktivitas.length === 0) {
        adaPerubahanKeaktifan = false;
        updateStatusSimpan();
        if (btnSimpan) { btnSimpan.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 inline mr-1"></i>Simpan'; lucide.createIcons(); }
        return;
    }

    try {
        const res = await simpanKeaktifanMassal(kelasKeaktifanAktif, tanggalKeaktifanAktif, daftarAktivitas);
        logAwal = JSON.parse(JSON.stringify(logHariIni));
        adaPerubahanKeaktifan = false;
        updateStatusSimpan();

        if (btnSimpan) {
            btnSimpan.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 inline mr-1"></i>Simpan';
            btnSimpan.className = 'inline-flex items-center gap-2 bg-slate-200 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed';
            lucide.createIcons();
        }

        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 z-[300] bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2';
        toast.innerHTML = `✅ ${res.disimpan || daftarAktivitas.length} aktivitas berhasil disimpan!`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    } catch (err) {
        if (btnSimpan) {
            btnSimpan.disabled  = false;
            btnSimpan.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 inline mr-1"></i>Simpan';
            btnSimpan.className = 'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm';
            lucide.createIcons();
        }
        alert('Gagal menyimpan keaktifan: ' + (err.message || err));
    }
}

// =========================================================
// TAB REKAP
// =========================================================
async function muatRekapKeaktifan() {
    const kelas       = document.getElementById('select-kelas-keaktifan-rekap').value;
    const modeTanggal = document.querySelector('input[name="mode-tanggal-rekap"]:checked')?.value || 'harian';

    let tanggalMulai, tanggalAkhir;
    if (modeTanggal === 'harian') {
        tanggalMulai = tanggalAkhir = document.getElementById('tanggal-keaktifan-rekap').value;
    } else {
        tanggalMulai = document.getElementById('tanggal-keaktifan-mulai').value;
        tanggalAkhir = document.getElementById('tanggal-keaktifan-akhir').value;
    }

    if (!kelas || !tanggalMulai || !tanggalAkhir) {
        renderTabelRekapKosong('Pilih kelas dan tanggal untuk menampilkan rekap.');
        return;
    }

    renderTabelRekapKosong('<span class="animate-pulse text-indigo-500">Memuat rekap...</span>');

    try {
        const data = await getRekapKeaktifan(kelas, tanggalMulai, tanggalAkhir);
        renderTabelRekap(data || [], kelas, tanggalMulai, tanggalAkhir);
    } catch (err) {
        renderTabelRekapKosong(`<span class="text-rose-500 font-bold">Gagal memuat rekap: ${err.message}</span>`);
    }
}

function renderTabelRekap(data, kelas, tanggalMulai, tanggalAkhir) {
    const tbody       = document.getElementById('body-tabel-rekap-keaktifan');
    const infoPeriode = document.getElementById('info-periode-rekap');
    if (!tbody) return;

    if (infoPeriode) {
        const label = tanggalMulai === tanggalAkhir
            ? formatTanggal(tanggalMulai)
            : `${formatTanggal(tanggalMulai)} – ${formatTanggal(tanggalAkhir)}`;
        infoPeriode.textContent = `${kelas} · ${label}`;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-slate-400 font-semibold">Belum ada data keaktifan pada periode ini.</td></tr>`;
        return;
    }

    const maxPoin = Math.max(...data.map(s => s.total_poin), 1);
    let html = '';
    data.forEach((siswa, idx) => {
        const persen      = maxPoin > 0 ? Math.round((siswa.total_poin / maxPoin) * 100) : 0;
        const persenColor = persen >= 80 ? 'text-emerald-600' : persen >= 50 ? 'text-amber-600' : 'text-rose-500';
        const poinColor   = siswa.total_poin > 0 ? 'text-indigo-700 font-black' : siswa.total_poin < 0 ? 'text-rose-600 font-bold' : 'text-slate-400';
        const barColor    = persen >= 80 ? 'bg-emerald-500' : persen >= 50 ? 'bg-amber-400' : 'bg-rose-400';
        const badgeOrDash = (count, cls) =>
            count > 0 ? `<span class="${cls} font-bold px-2 py-0.5 rounded-lg">${count}×</span>` : `<span class="text-slate-300">-</span>`;

        html += `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
            <td class="py-3 px-4 text-slate-400 text-xs font-medium text-center">${idx + 1}</td>
            <td class="py-3 px-4 font-semibold text-slate-800 text-sm">${escapeHtml(siswa.nama)}</td>
            <td class="py-3 px-3 text-center text-xs">${badgeOrDash(siswa.bertanya, 'bg-sky-100 text-sky-700')}</td>
            <td class="py-3 px-3 text-center text-xs">${badgeOrDash(siswa.menjawab, 'bg-emerald-100 text-emerald-700')}</td>
            <td class="py-3 px-3 text-center text-xs">${badgeOrDash(siswa.maju,     'bg-indigo-100 text-indigo-700')}</td>
            <td class="py-3 px-3 text-center text-xs">${badgeOrDash(siswa.tidur,    'bg-amber-100 text-amber-700')}</td>
            <td class="py-3 px-3 text-center text-xs">${badgeOrDash(siswa.gaduh,    'bg-rose-100 text-rose-700')}</td>
            <td class="py-3 px-4 text-center"><span class="text-base ${poinColor}">${siswa.total_poin}</span></td>
            <td class="py-3 px-4 text-center min-w-[130px]">
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div class="h-full rounded-full ${barColor} transition-all" style="width:${Math.max(persen,0)}%"></div>
                    </div>
                    <span class="text-xs font-bold ${persenColor} w-10 text-right">${persen}%</span>
                </div>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

function renderTabelRekapKosong(pesan) {
    const tbody = document.getElementById('body-tabel-rekap-keaktifan');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-slate-400 font-semibold">${pesan}</td></tr>`;
}

// =========================================================
// TOGGLE MODE TANGGAL (Harian / Rentang) di Tab Rekap
// =========================================================
function toggleModeTanggalRekap() {
    const mode         = document.querySelector('input[name="mode-tanggal-rekap"]:checked')?.value || 'harian';
    const panelHarian  = document.getElementById('panel-filter-harian');
    const panelRentang = document.getElementById('panel-filter-rentang');
    if (mode === 'harian') { panelHarian.classList.remove('hidden'); panelRentang.classList.add('hidden'); }
    else { panelHarian.classList.add('hidden'); panelRentang.classList.remove('hidden'); }
    muatRekapKeaktifan();
}

// =========================================================
// INTEGRASI NILAI — Ambil % Keaktifan per kelas
// =========================================================
async function getPersentaseKeaktifanUntukNilai(kelas, callback) {
    const today = new Date().toISOString().split('T')[0];
    const awal  = today.substring(0, 4) + '-01-01';
    try {
        const rekapList = await getRekapKeaktifan(kelas, awal, today);
        const maxPoin = rekapList.length > 0 ? Math.max(...rekapList.map(s => s.total_poin), 1) : 1;
        const hasil = {};
        (rekapList || []).forEach(s => {
            hasil[s.nama] = maxPoin > 0 ? Math.round((s.total_poin / maxPoin) * 100) : 0;
        });
        callback(hasil);
    } catch (err) {
        callback({});
    }
}

// =========================================================
// HELPER
// =========================================================
function hitungTotalPoin(log) {
    let total = 0;
    URUTAN_AKTIVITAS.forEach(a => { total += (log[a] || 0) * (BOBOT_AKTIVITAS[a] || 0); });
    return total;
}

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeAttr(str) {
    return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

function formatTanggal(tgl) {
    if (!tgl) return '';
    try {
        const d = new Date(tgl + 'T00:00:00');
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch(e) { return tgl; }
}

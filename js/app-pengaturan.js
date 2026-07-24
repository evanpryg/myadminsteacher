// ============================================================
// APP-PENGATURAN.JS — Halaman Pengaturan (async/await version)
// Replaces google.script.run calls with direct async API calls
// ============================================================

// =========================================================
// STATE PENGATURAN
// =========================================================
let _pgData = null;
let _pgNisAktif = new Set();
let _pgEditJadwalRow = null;
let _pgEditLinkIdx  = null;
let _pgImportPreview = [];

// =========================================================
// INISIALISASI
// =========================================================
async function initHalamanPengaturan() {
    const loader  = document.getElementById('pg-loader');
    const content = document.getElementById('pg-content');
    if (loader)  { loader.classList.remove('hidden'); loader.textContent = 'Memuat data pengaturan...'; }
    if (content) content.classList.add('hidden');

    try {
        const data = await getPengaturanData();
        _pgData = data;
        _pgNisAktif = new Set((data.nisSiswaAktif || []));
        if (loader)  loader.classList.add('hidden');
        if (content) {
            content.classList.remove('hidden');
            _renderTabSemester();
            _renderTabJadwal();
            _renderTabLinks();
            _renderTabProfil();
        }
        lucide.createIcons();
    } catch (err) {
        if (loader) loader.innerHTML = `<span class="text-rose-600 font-bold">Gagal memuat: ${err.message || err}</span>`;
    }
}

async function muatSemesterMulai() {
    const el = document.getElementById('pg-semester-mulai');
    if (el) el.value = await getAppSetting('GS_SEMESTER_MULAI', '');
}

async function simpanSemesterMulai() {
    const el = document.getElementById('pg-semester-mulai');
    if (!el || !el.value) { alert('Pilih tanggal mulai semester terlebih dahulu.'); return; }
    await setAppSetting('GS_SEMESTER_MULAI', el.value);
    alert('Tanggal mulai semester tersimpan. Penomoran pertemuan otomatis mengikuti tanggal ini.');
}

function tampilkanTabPengaturan(tab) {
    ['semester','import','export','jadwal','profil','bank','prompt'].forEach(function(t) {
        const panel = document.getElementById('pg-panel-' + t);
        const btn   = document.getElementById('pg-tab-' + t);
        if (panel) panel.classList.add('hidden');
        if (btn)   { btn.classList.remove('bg-indigo-600','text-white','shadow-sm'); btn.classList.add('text-slate-500','hover:bg-slate-100'); }
    });
    const activePanel = document.getElementById('pg-panel-' + tab);
    const activeBtn   = document.getElementById('pg-tab-' + tab);
    if (activePanel) activePanel.classList.remove('hidden');
    if (activeBtn)   { activeBtn.classList.add('bg-indigo-600','text-white','shadow-sm'); activeBtn.classList.remove('text-slate-500','hover:bg-slate-100'); }

    if (tab === 'import') { muatDaftarSiswaLengkap(); inisialisasiImportSiswa(); }
    if (tab === 'profil') { muatKelasMengajar(); }
    if (tab === 'prompt' && typeof muatPengaturanAI === 'function') { muatPengaturanAI(); }
    if (tab === 'bank' && typeof muatPengaturanBank === 'function') { muatPengaturanBank(); }
}

// =========================================================
// TAB 1: MANAJEMEN SEMESTER
// =========================================================
function _renderTabSemester() {
    muatSemesterMulai();
    const data = _pgData;
    if (!data) return;

    const periodeAktif = data.periodeAktif || '';
    const infoAktif = data.infoAktif || {};
    const semAktifEl = document.getElementById('pg-sem-aktif-card');
    if (semAktifEl) {
        const semAktif = (data.daftarSemester || []).find(s => s.periode === periodeAktif) || {};
        semAktifEl.innerHTML = `
        <div class="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-300/30 relative overflow-hidden">
            <div class="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full pointer-events-none"></div>
            <div class="relative">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Semester Aktif</p>
                        <h3 class="text-2xl font-black">${_esc(infoAktif.tahunAjaran || '-')} · ${_esc(infoAktif.semester || '-')}</h3>
                        <p class="text-indigo-200 text-xs mt-1">Dibuat: ${_esc(semAktif.tanggalDibuat || '-')}</p>
                    </div>
                    <span class="bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 text-xs font-black px-3 py-1.5 rounded-xl">✅ Aktif</span>
                </div>
                <div class="mt-4 flex gap-2 flex-wrap">
                    <button onclick="bukaModalSemesterBaru()" class="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">
                        <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>Buat Semester Baru
                    </button>
                </div>
            </div>
        </div>`;
    }

    const listEl = document.getElementById('pg-sem-list');
    if (listEl) {
        const daftar = data.daftarSemester || [];
        if (daftar.length === 0) {
            listEl.innerHTML = `<div class="py-10 text-center text-slate-400 font-semibold text-sm">Belum ada riwayat semester.</div>`;
            return;
        }
        listEl.innerHTML = daftar.map(sem => {
            const isAktif = sem.periode === periodeAktif;
            return `
            <div class="bg-white border ${isAktif ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:shadow-md">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <h4 class="font-black text-slate-800 text-base">${_esc(sem.tahunAjaran)} · ${_esc(sem.semester)}</h4>
                        <span class="text-[10px] font-black px-2.5 py-1 rounded-lg ${isAktif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
                            ${isAktif ? '✅ Aktif' : 'Nonaktif'}
                        </span>
                    </div>
                    <p class="text-xs text-slate-400 mb-3">Dibuat: ${_esc(sem.tanggalDibuat || '-')}</p>
                </div>
                <div class="flex flex-col sm:items-end gap-2 shrink-0">
                    ${!isAktif ? `<button onclick="_gantiSemesterAktif('${_esc(sem.tahunAjaran)}','${_esc(sem.semester)}')" class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>Jadikan Aktif
                    </button>` : '<span class="text-xs text-emerald-600 font-bold">Semester Saat Ini</span>'}
                </div>
            </div>`;
        }).join('');
    }
    lucide.createIcons();
}

async function _gantiSemesterAktif(ta, sem) {
    if (!confirm(`Yakin ingin beralih ke semester ${ta} - ${sem}?\n\nSemua menu (Nilai, Presensi, Keaktifan) akan menampilkan data semester tersebut.`)) return;
    const loader = document.getElementById('pg-loader');
    if (loader) { loader.classList.remove('hidden'); loader.textContent = 'Mengganti semester aktif...'; }
    document.getElementById('pg-content').classList.add('hidden');

    try {
        const result = await gantiSemesterAktif(ta, sem);
        if (result.success) {
            initHalamanPengaturan();
            if (typeof refreshDashboardManual === 'function') refreshDashboardManual();
        } else {
            if (loader) { loader.classList.add('hidden'); }
            document.getElementById('pg-content').classList.remove('hidden');
            alert('Gagal: ' + (result.message || 'Terjadi kesalahan'));
        }
    } catch (err) {
        if (loader) { loader.classList.add('hidden'); }
        document.getElementById('pg-content').classList.remove('hidden');
        alert('Error: ' + (err.message || err));
    }
}

function bukaModalSemesterBaru() {
    document.getElementById('modal-semester-baru')?.classList.remove('hidden');
    lucide.createIcons();
}

function tutupModalSemesterBaru() {
    document.getElementById('modal-semester-baru')?.classList.add('hidden');
}

async function simpanSemesterBaru() {
    const ta  = document.getElementById('sem-baru-ta')?.value?.trim();
    const sem = document.getElementById('sem-baru-semester')?.value;
    if (!ta) { document.getElementById('sem-baru-ta')?.focus(); return; }
    const opsi = {
        salinSiswa:  document.getElementById('sem-salin-siswa')?.checked,
        salinKelas:  document.getElementById('sem-salin-kelas')?.checked,
        salinJadwal: document.getElementById('sem-salin-jadwal')?.checked,
        salinLinks:  document.getElementById('sem-salin-links')?.checked
    };
    const btn = document.querySelector('#modal-semester-baru [onclick="simpanSemesterBaru()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Membuat...'; }

    try {
        const result = await buatSemesterBaru(ta, sem, opsi);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="plus" class="w-4 h-4 inline mr-1"></i>Buat Semester'; }
        if (result.success) {
            tutupModalSemesterBaru();
            initHalamanPengaturan();
        } else {
            alert('Gagal: ' + (result.message || 'Terjadi kesalahan'));
        }
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Buat Semester'; }
        alert('Error: ' + (err.message || err));
    }
}

// =========================================================
// TAB 2: IMPORT DATA SISWA
// =========================================================
function inisialisasiImportSiswa() {
    const dropzone = document.getElementById('import-dropzone');
    if (!dropzone) return;
    dropzone.addEventListener('dragover', function(e) { e.preventDefault(); dropzone.classList.add('border-indigo-400','bg-indigo-50'); });
    dropzone.addEventListener('dragleave', function() { dropzone.classList.remove('border-indigo-400','bg-indigo-50'); });
    dropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-400','bg-indigo-50');
        const file = e.dataTransfer.files[0];
        if (file) _prosesFileImport(file);
    });
}

function _handleFileImport(input) {
    const file = input.files[0];
    if (file) _prosesFileImport(file);
}

function _prosesFileImport(file) {
    const statusEl = document.getElementById('import-status');
    if (statusEl) statusEl.textContent = 'Membaca file...';
    const ext = file.name.split('.').pop().toLowerCase();

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let rows = [];
            if (ext === 'csv') {
                const text = e.target.result;
                rows = text.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
            } else if (ext === 'xlsx' || ext === 'xls') {
                if (typeof XLSX === 'undefined') {
                    if (statusEl) statusEl.innerHTML = '<span class="text-rose-600">Library SheetJS belum dimuat. Coba refresh halaman.</span>';
                    return;
                }
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            } else {
                if (statusEl) statusEl.innerHTML = '<span class="text-rose-600">Format tidak didukung. Gunakan CSV atau Excel.</span>';
                return;
            }
            _tampilkanPreviewImport(rows);
        } catch(err) {
            if (statusEl) statusEl.innerHTML = `<span class="text-rose-600">Error membaca file: ${err.message}</span>`;
        }
    };

    if (ext === 'csv') { reader.readAsText(file); }
    else { reader.readAsBinaryString(file); }
}

function _tampilkanPreviewImport(rows) {
    if (!rows || rows.length < 2) {
        document.getElementById('import-preview-section')?.classList.add('hidden');
        document.getElementById('import-status').innerHTML = '<span class="text-amber-600">File kosong atau tidak ada data.</span>';
        return;
    }

    const header = rows[0].map(h => String(h).toLowerCase().trim());
    let iNis = header.findIndex(h => ['nis','id','id_siswa','no'].includes(h));
    let iNama = header.findIndex(h => h.includes('nama'));
    let iKelas = header.findIndex(h => h.includes('kelas'));

    if (iNis < 0)  iNis  = 0;
    if (iNama < 0) iNama = 1;
    if (iKelas < 0) iKelas = 2;

    _pgImportPreview = [];
    rows.slice(1).forEach(function(row, idx) {
        const nis   = String(row[iNis]   || '').trim();
        const nama  = String(row[iNama]  || '').trim();
        const kelas = String(row[iKelas] || '').trim();
        if (!nis && !nama) return;
        _pgImportPreview.push({ nis, nama, kelas, isDuplikat: _pgNisAktif.has(nis) });
    });

    const dupCount = _pgImportPreview.filter(d => d.isDuplikat).length;
    const validCount = _pgImportPreview.filter(d => !d.isDuplikat).length;

    const previewSection = document.getElementById('import-preview-section');
    if (previewSection) previewSection.classList.remove('hidden');

    const statusEl = document.getElementById('import-status');
    if (statusEl) statusEl.innerHTML = `
        <span class="text-emerald-600 font-bold">${validCount} siswa baru</span>
        ${dupCount > 0 ? `· <span class="text-amber-600 font-bold">${dupCount} duplikat (akan dilewati)</span>` : ''}
    `;

    const tbody = document.getElementById('import-preview-tbody');
    if (tbody) {
        tbody.innerHTML = _pgImportPreview.map((d, i) => `
        <tr class="${d.isDuplikat ? 'bg-amber-50' : ''}">
            <td class="py-2 px-3 text-center text-slate-400">${i+1}</td>
            <td class="py-2 px-3 font-mono text-xs ${d.isDuplikat ? 'text-amber-700' : 'text-slate-700'}">${_esc(d.nis)}</td>
            <td class="py-2 px-3 font-semibold text-sm ${d.isDuplikat ? 'text-amber-700' : 'text-slate-800'}">${_esc(d.nama)}</td>
            <td class="py-2 px-3 text-sm text-slate-600">${_esc(d.kelas)}</td>
            <td class="py-2 px-3 text-center">
                ${d.isDuplikat
                    ? '<span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg">⚠ Duplikat</span>'
                    : '<span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg">✓ Baru</span>'
                }
            </td>
        </tr>`).join('');
    }

    const btnImport = document.getElementById('btn-konfirmasi-import');
    if (btnImport) btnImport.disabled = validCount === 0;
    lucide.createIcons();
}

async function konfirmasiImportSiswa() {
    const toImport = _pgImportPreview.filter(d => !d.isDuplikat);
    if (toImport.length === 0) { alert('Tidak ada data baru untuk diimport.'); return; }
    if (!confirm(`Import ${toImport.length} siswa baru ke semester aktif?\n\nSiswa duplikat (${_pgImportPreview.length - toImport.length} data) akan dilewati.`)) return;

    const btn = document.getElementById('btn-konfirmasi-import');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengimport...'; }

    try {
        const result = await importDataSiswaMassal(toImport);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="upload" class="w-4 h-4 inline mr-1"></i>Import Sekarang'; }
        if (result.berhasil > 0) {
            alert(`✅ Berhasil mengimport ${result.berhasil} siswa!\n${result.duplikat > 0 ? result.duplikat + ' data dilewati (duplikat).' : ''}`);
            _pgImportPreview = [];
            document.getElementById('import-preview-section')?.classList.add('hidden');
            document.getElementById('import-status').textContent = '';
            initHalamanPengaturan();
        } else {
            alert('Gagal import: ' + (result.errorList || []).join('\n'));
        }
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Import Sekarang'; }
        alert('Error: ' + (err.message || err));
    }
}

// =========================================================
// TAB 3: EXPORT DATA
// =========================================================
async function exportData(jenis, format) {
    const statusEl = document.getElementById('export-status');
    if (statusEl) statusEl.innerHTML = `<span class="text-indigo-600 animate-pulse">⏳ Mengambil data...</span>`;

    try {
        const result = await getExportData(jenis);
        if (result.error) {
            if (statusEl) statusEl.innerHTML = `<span class="text-rose-600">Error: ${result.error}</span>`;
            return;
        }

        if (format === 'spreadsheet') {
            window.open(result.spreadsheetUrl, '_blank');
            if (statusEl) statusEl.innerHTML = `<span class="text-emerald-600">✅ Spreadsheet dibuka di tab baru.</span>`;
            return;
        }

        let dataToExport, fileName;
        if (jenis === 'semua') {
            const parts = [];
            ['siswa','nilai','presensi','keaktifan'].forEach(function(k) {
                if (result[k] && result[k].length > 0) {
                    parts.push(['=== ' + k.toUpperCase() + ' ===']);
                    result[k].forEach(r => parts.push(r));
                    parts.push([]);
                }
            });
            dataToExport = parts;
            fileName = 'TeachMate_Semua_Data';
        } else {
            dataToExport = result.data || [];
            fileName = 'TeachMate_' + jenis.charAt(0).toUpperCase() + jenis.slice(1);
        }

        if (format === 'excel') {
            _downloadExcel(dataToExport, fileName);
        } else {
            _downloadCSV(dataToExport, fileName);
        }
        if (statusEl) statusEl.innerHTML = `<span class="text-emerald-600">✅ File ${fileName}.${format === 'excel' ? 'xlsx' : 'csv'} berhasil diunduh.</span>`;
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span class="text-rose-600">Gagal: ${err.message}</span>`;
    }
}

function _downloadCSV(rows, fileName) {
    if (!rows || rows.length === 0) { alert('Tidak ada data untuk diekspor.'); return; }
    const csvContent = rows.map(row => Array.isArray(row) ? row.map(cell => {
        const s = String(cell || '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',') : String(row)).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName + '.csv';
    link.click(); URL.revokeObjectURL(url);
}

function _downloadExcel(rows, fileName) {
    if (typeof XLSX === 'undefined') {
        alert('Library SheetJS belum dimuat. Gunakan format CSV.');
        return;
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, fileName + '.xlsx');
}

// =========================================================
// TAB 4: JADWAL MENGAJAR — CRUD
// =========================================================
function _renderTabJadwal() {
    const jadwal = (_pgData && _pgData.jadwal) || [];
    const container = document.getElementById('pg-jadwal-list');
    if (!container) return;
    
    console.log('[TeachMate] Jadwal data:', jadwal.length, 'items', jadwal);

    if (jadwal.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-slate-400 font-semibold">Belum ada jadwal. Klik "+ Tambah Jadwal" untuk menambahkan.</td></tr>`;
        return;
    }

    const hariColor = { Senin: 'bg-indigo-100 text-indigo-700', Selasa: 'bg-violet-100 text-violet-700', Rabu: 'bg-sky-100 text-sky-700', Kamis: 'bg-emerald-100 text-emerald-700', Jumat: 'bg-amber-100 text-amber-700', Sabtu: 'bg-rose-100 text-rose-700' };
    container.innerHTML = jadwal.map(j => `
    <tr class="hover:bg-slate-50 transition-colors group">
        <td class="py-2.5 px-4"><span class="text-[11px] font-bold px-2.5 py-1 rounded-lg ${hariColor[j.hari] || 'bg-slate-100 text-slate-600'}">${_esc(j.hari)}</span></td>
        <td class="py-2.5 px-3 text-xs font-mono font-semibold text-slate-700">${_esc(j.jam_mulai || j.jamMulai)} – ${_esc(j.jam_selesai || j.jamSelesai)}</td>
        <td class="py-2.5 px-3 text-sm font-bold text-slate-800">${_esc(j.kelas)}</td>
        <td class="py-2.5 px-3 text-sm text-indigo-700 font-semibold">${_esc(j.mata_pelajaran || j.mapel)}</td>
        <td class="py-2.5 px-3 text-xs text-slate-500">${_esc(j.ruang) || '-'}</td>
        <td class="py-2.5 px-3">
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-lg ${j.kategori === 'Intensif' ? 'bg-amber-100 text-amber-700' : j.kategori === 'Kegiatan' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600'}">
                ${_esc(j.kategori || 'Normal')}
            </span>
        </td>
        <td class="py-2.5 px-3">
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="_editJadwal(${j.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                <button onclick="_hapusJadwal(${j.id},'${_esc(j.kelas)} - ${_esc(j.hari)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </td>
    </tr>`).join('');
    lucide.createIcons();
}

function bukaModalJadwal(rowNum) {
    _pgEditJadwalRow = rowNum || null;
    const modal = document.getElementById('modal-jadwal');
    const title = document.getElementById('modal-jadwal-title');
    if (!modal) return;

    const kelasMengajar = _pgData.mengajar || _pgData.kelas || [];
    const selKelas = document.getElementById('jadwal-kelas');
    const selMapel = document.getElementById('jadwal-mapel');
    const dlKelas = document.getElementById('jadwal-kelas-list');
    const dlMapel = document.getElementById('jadwal-mapel-list');

    // Populate datalist suggestions dari kelas mengajar + kelasUnik
    const kelasFromMengajar = kelasMengajar.map(k => k.kelas);
    const kelasFromData = _pgData.kelasUnik || [];
    const semuaKelas = [...new Set([...kelasFromMengajar, ...kelasFromData])].sort();
    
    if (dlKelas) {
        dlKelas.innerHTML = semuaKelas.map(k => `<option value="${_esc(k)}">`).join('');
    }

    const mapelUnik = [...new Set(kelasMengajar.map(k => k.mata_pelajaran || k.mapel).filter(Boolean))].sort();
    if (dlMapel) {
        dlMapel.innerHTML = mapelUnik.map(m => `<option value="${_esc(m)}">`).join('');
    }

    // Pengulangan: default berulang; saat edit, hanya seri berulang yang bisa diedit
    const pengulanganWrap = document.getElementById('jadwal-pengulangan-wrap');
    const pengulanganSel = document.getElementById('jadwal-pengulangan');
    if (pengulanganSel) pengulanganSel.value = 'mingguan';
    const tglInput = document.getElementById('jadwal-tanggal');
    if (tglInput) tglInput.value = '';
    if (pengulanganWrap) pengulanganWrap.classList.toggle('hidden', !!rowNum);
    toggleJadwalPengulangan();

    if (rowNum) {
        const j = (_pgData.jadwal || []).find(x => x.id === rowNum);
        if (j) {
            title.textContent = 'Edit Jadwal';
            document.getElementById('jadwal-hari').value      = j.hari;
            document.getElementById('jadwal-jam-mulai').value = j.jam_mulai || j.jamMulai;
            document.getElementById('jadwal-jam-selesai').value = j.jam_selesai || j.jamSelesai;
            document.getElementById('jadwal-kategori').value  = j.kategori || 'Normal';
            document.getElementById('jadwal-ruang').value     = j.ruang || '';
            if (j.kategori === 'Kegiatan') {
                document.getElementById('jadwal-nama-kegiatan').value = j.mata_pelajaran || j.mapel || '';
            } else {
                if (selKelas) selKelas.value = j.kelas;
                if (selMapel) selMapel.value = j.mata_pelajaran || j.mapel;
            }
            toggleJadwalKategori();
        }
    } else {
        title.textContent = 'Tambah Jadwal';
        document.getElementById('jadwal-hari').value = 'Senin';
        document.getElementById('jadwal-jam-mulai').value = '';
        document.getElementById('jadwal-jam-selesai').value = '';
        if (selKelas) selKelas.value = '';
        if (selMapel) selMapel.value = '';
        document.getElementById('jadwal-ruang').value = '';
        document.getElementById('jadwal-kategori').value = 'Normal';
        document.getElementById('jadwal-nama-kegiatan').value = '';
        toggleJadwalKategori();
    }
    modal.classList.remove('hidden');
    lucide.createIcons();
}

function tutupModalJadwal() { document.getElementById('modal-jadwal')?.classList.add('hidden'); }

function toggleJadwalPengulangan() {
    const sekali = document.getElementById('jadwal-pengulangan')?.value === 'sekali';
    const tglLabel = document.getElementById('jadwal-tanggal-label');
    const hariSel = document.getElementById('jadwal-hari');
    // Mingguan: tanggal = "berlaku mulai" (opsional). Sekali: tanggal wajib & hari mengikuti tanggal.
    if (tglLabel) tglLabel.textContent = sekali ? 'Tanggal' : 'Berlaku Mulai (Opsional)';
    if (hariSel) hariSel.disabled = sekali;
    if (sekali) sinkronHariDariTanggal();
}

function sinkronHariDariTanggal() {
    const tgl = document.getElementById('jadwal-tanggal')?.value;
    const hariSel = document.getElementById('jadwal-hari');
    if (!tgl || !hariSel) return;
    // Sinkron hari otomatis (utk mode sekali; utk mingguan hanya sbg bantuan awal)
    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    if (document.getElementById('jadwal-pengulangan')?.value === 'sekali' || !hariSel.dataset.touched) {
        hariSel.value = HARI[new Date(tgl + 'T00:00:00').getDay()] || 'Senin';
    }
}

function toggleJadwalKategori() {
    const kategori = document.getElementById('jadwal-kategori')?.value;
    const fieldMengajar = document.getElementById('jadwal-field-mengajar');
    const fieldKegiatan = document.getElementById('jadwal-field-kegiatan');
    if (kategori === 'Kegiatan') {
        if (fieldMengajar) fieldMengajar.classList.add('hidden');
        if (fieldKegiatan) fieldKegiatan.classList.remove('hidden');
    } else {
        if (fieldMengajar) fieldMengajar.classList.remove('hidden');
        if (fieldKegiatan) fieldKegiatan.classList.add('hidden');
    }
}

async function simpanJadwal() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const kategori = gv('jadwal-kategori');

    let jadwal;
    if (kategori === 'Kegiatan') {
        const namaKegiatan = gv('jadwal-nama-kegiatan');
        if (!namaKegiatan) { alert('Nama Kegiatan wajib diisi.'); return; }
        jadwal = {
            hari: gv('jadwal-hari'), jam_mulai: gv('jadwal-jam-mulai'), jam_selesai: gv('jadwal-jam-selesai'),
            kelas: '', mata_pelajaran: namaKegiatan, ruang: gv('jadwal-ruang'), kategori: 'Kegiatan'
        };
    } else {
        const kelas = gv('jadwal-kelas');
        const mapel = gv('jadwal-mapel');
        if (!kelas || !mapel) { alert('Kelas dan Mata Pelajaran wajib dipilih.'); return; }
        jadwal = {
            hari: gv('jadwal-hari'), jam_mulai: gv('jadwal-jam-mulai'), jam_selesai: gv('jadwal-jam-selesai'),
            kelas: kelas, mata_pelajaran: mapel, ruang: gv('jadwal-ruang'), kategori: kategori || 'Normal'
        };
    }

    // Jadwal sekali (hanya tanggal tertentu) -> disimpan sebagai override, bukan seri mingguan
    const pengulangan = _pgEditJadwalRow ? 'mingguan' : gv('jadwal-pengulangan');
    const tanggal = gv('jadwal-tanggal');
    if (pengulangan === 'sekali' && !tanggal) { alert('Pilih tanggal untuk jadwal satu kali.'); return; }

    const btn = document.querySelector('#modal-jadwal [onclick="simpanJadwal()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    console.log('[TeachMate] Simpan jadwal payload:', jadwal, 'pengulangan:', pengulangan);

    try {
        let result;
        if (_pgEditJadwalRow) {
            result = await updateJadwal(_pgEditJadwalRow, jadwal);
        } else if (pengulangan === 'sekali') {
            await simpanJadwalOverride({
                tanggal: tanggal, aksi: 'tambah', id: 'ot' + Date.now(),
                jam_mulai: jadwal.jam_mulai, jam_selesai: jadwal.jam_selesai,
                kelas: jadwal.kelas, mata_pelajaran: jadwal.mata_pelajaran,
                ruang: jadwal.ruang, kategori: jadwal.kategori
            });
            result = { success: true };
        } else {
            result = await tambahJadwal(jadwal);
            // Seri baru dengan tanggal "berlaku mulai": tidak tampil di minggu-minggu sebelum tanggal itu
            if (result && result.success && result.id && tanggal) {
                await simpanJadwalOverride({ tanggal: tanggal, jadwalId: result.id, aksi: 'start' });
            }
        }
        if (result && result.success) {
            _onJadwalSaved();
        } else {
            _onJadwalErr(new Error(result?.message || 'Gagal menyimpan. Buka Console (F12) untuk detail.'));
        }
    } catch (err) {
        _onJadwalErr(err);
    }
}

function _editJadwal(rowNum) { bukaModalJadwal(rowNum); }

async function _hapusJadwal(rowNum, label) {
    if (!confirm(`Hapus PERMANEN jadwal "${label}"?\n\nSeri ini akan hilang dari SEMUA minggu, termasuk riwayat minggu sebelumnya.\nJika hanya ingin mengakhirinya mulai tanggal tertentu (riwayat tetap tersimpan), gunakan tombol hapus di halaman "Jadwal Mengajar".`)) return;
    try {
        await hapusJadwal(rowNum);
        _onJadwalSaved();
    } catch (err) {
        _onJadwalErr(err);
    }
}

async function _onJadwalSaved() {
    tutupModalJadwal();
    const btn = document.querySelector('#modal-jadwal [onclick="simpanJadwal()"]');
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; }
    try {
        const data = await getPengaturanData();
        _pgData = data;
        _renderTabJadwal();
        if (typeof refreshDashboardManual === 'function') refreshDashboardManual();
    } catch (err) {
        console.error('Gagal reload jadwal:', err);
    }
}

function _onJadwalErr(err) {
    const btn = document.querySelector('#modal-jadwal [onclick="simpanJadwal()"]');
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; }
    alert('Gagal: ' + (err.message || err));
}

// =========================================================
// TAB 5: KELOLA QUICK LINKS
// =========================================================
const LINK_COLORS = ['emerald','amber','sky','violet','indigo','rose','green'];
const LINK_ICONS  = ['link','external-link','globe','book-open','file-text','video','hard-drive','graduation-cap','table-2','mail','phone','calendar'];

function _renderTabLinks() {
    const links = (_pgData && _pgData.quickLinks) || [];
    const container = document.getElementById('pg-links-grid');
    if (!container) return;

    const colorMap = {
        emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        amber:   'bg-amber-50 border-amber-200 text-amber-700',
        sky:     'bg-sky-50 border-sky-200 text-sky-700',
        violet:  'bg-violet-50 border-violet-200 text-violet-700',
        indigo:  'bg-indigo-50 border-indigo-200 text-indigo-700',
        rose:    'bg-rose-50 border-rose-200 text-rose-700',
        green:   'bg-teal-50 border-teal-200 text-teal-700'
    };

    if (links.length === 0) {
        container.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400 font-semibold">Belum ada link. Klik "+ Tambah Link".</div>`;
        return;
    }

    container.innerHTML = links.map((l, i) => {
        const cls = colorMap[l.color] || colorMap.indigo;
        return `
        <div class="group relative flex flex-col gap-2 p-4 rounded-2xl border ${cls} hover:shadow-md transition-all">
            <div class="flex items-start justify-between gap-2">
                <i data-lucide="${_esc(l.icon || 'link')}" class="w-5 h-5 shrink-0 mt-0.5"></i>
                <div class="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                    <button onclick="_editLink(${i})" class="bg-white/80 p-1 rounded-lg hover:bg-white shadow-sm"><i data-lucide="edit-3" class="w-3 h-3 text-slate-600"></i></button>
                    <button onclick="_hapusLink(${i})" class="bg-white/80 p-1 rounded-lg hover:bg-rose-50 shadow-sm"><i data-lucide="trash-2" class="w-3 h-3 text-rose-500"></i></button>
                </div>
            </div>
            <p class="text-sm font-bold leading-tight">${_esc(l.label)}</p>
            <p class="text-[10px] opacity-60 truncate">${_esc(l.url)}</p>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function bukaModalLink(idx) {
    _pgEditLinkIdx = idx !== undefined ? idx : null;
    const modal = document.getElementById('modal-link');
    const title = document.getElementById('modal-link-title');
    if (!modal) return;

    const iconSel = document.getElementById('link-icon');
    if (iconSel) iconSel.innerHTML = LINK_ICONS.map(ic => `<option value="${ic}">${ic}</option>`).join('');
    const colorSel = document.getElementById('link-color');
    if (colorSel) colorSel.innerHTML = LINK_COLORS.map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('');

    if (idx !== undefined) {
        const l = (_pgData.quickLinks || [])[idx];
        title.textContent = 'Edit Link';
        if (l) {
            document.getElementById('link-label').value  = l.label  || '';
            document.getElementById('link-url').value    = l.url    || '';
            if (iconSel)  iconSel.value  = l.icon  || 'link';
            if (colorSel) colorSel.value = l.color || 'indigo';
        }
    } else {
        title.textContent = 'Tambah Link';
        document.getElementById('link-label').value = '';
        document.getElementById('link-url').value   = '';
        if (iconSel)  iconSel.value  = 'link';
        if (colorSel) colorSel.value = 'indigo';
    }
    modal.classList.remove('hidden');
    lucide.createIcons();
    setTimeout(() => document.getElementById('link-label')?.focus(), 100);
}

function tutupModalLink() { document.getElementById('modal-link')?.classList.add('hidden'); }

async function simpanLink() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const link = { label: gv('link-label'), url: gv('link-url'), icon: gv('link-icon'), color: gv('link-color') };
    if (!link.label || !link.url) { alert('Label dan URL wajib diisi.'); return; }

    const links = (_pgData.quickLinks || []).slice();
    if (_pgEditLinkIdx !== null) { links[_pgEditLinkIdx] = link; }
    else { links.push(link); }

    const btn = document.querySelector('#modal-link [onclick="simpanLink()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    try {
        await simpanQuickLinks(links);
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; }
        _pgData.quickLinks = links;
        tutupModalLink();
        _renderTabLinks();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; }
        alert('Gagal: ' + (err.message || err));
    }
}

function _editLink(idx)  { bukaModalLink(idx); }

async function _hapusLink(idx) {
    if (!confirm('Hapus link ini?')) return;
    const links = (_pgData.quickLinks || []).slice();
    links.splice(idx, 1);
    try {
        await simpanQuickLinks(links);
        _pgData.quickLinks = links;
        _renderTabLinks();
    } catch (err) {
        alert('Gagal: ' + (err.message || err));
    }
}

// =========================================================
// TAB 6: PROFIL & PARAMETER
// =========================================================
function _renderTabProfil() {
    if (!_pgData) return;
    const p = _pgData.profil || {}, b = _pgData.bobot || {};
    const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    sv('pg-profil-nama', p.nama);   sv('pg-profil-sekolah', p.sekolah);
    sv('pg-profil-kepala', p.namaKepala);
    sv('pg-profil-tahun', p.tahunAjaran); sv('pg-profil-kkm', p.kkm);
    const sem = document.getElementById('pg-profil-semester');
    if (sem) sem.value = p.semester || 'Ganjil';
    sv('pg-bobot-bab', b.bab);   sv('pg-bobot-hdr', b.hdr);
    sv('pg-bobot-aktf', b.aktf); sv('pg-bobot-sas', b.sas);
}

async function simpanProfilLengkap() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const profil = { nama: gv('pg-profil-nama'), sekolah: gv('pg-profil-sekolah'), namaKepala: gv('pg-profil-kepala'), tahunAjaran: gv('pg-profil-tahun'), semester: gv('pg-profil-semester'), kkm: gv('pg-profil-kkm') };
    const bobot  = { bab: parseFloat(gv('pg-bobot-bab')) || 50, hdr: parseFloat(gv('pg-bobot-hdr')) || 10, aktf: parseFloat(gv('pg-bobot-aktf')) || 10, sas: parseFloat(gv('pg-bobot-sas')) || 30 };
    const total  = bobot.bab + bobot.hdr + bobot.aktf + bobot.sas;
    if (Math.abs(total - 100) > 0.5) { alert(`Total bobot harus 100%. Saat ini: ${total}%.`); return; }

    const btn = document.getElementById('btn-simpan-profil');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    try {
        await saveProfilGuru(profil);
        await simpanPengaturan(bobot);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save" class="w-4 h-4 inline mr-1"></i>Tersimpan ✅'; lucide.createIcons(); }
        setTimeout(() => { if (btn) { btn.innerHTML = '<i data-lucide="save" class="w-4 h-4 inline mr-1"></i>Simpan Profil & Bobot'; lucide.createIcons(); } }, 2000);
        if (typeof refreshDashboardManual === 'function') refreshDashboardManual();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; }
        alert('Gagal: ' + (err.message || err));
    }
}

// =========================================================
// KELOLA SISWA (CRUD + Delete All)
// =========================================================
let _allSiswaData = [];

async function muatDaftarSiswaLengkap() {
    const tbody = document.getElementById('tbody-kelola-siswa');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-indigo-500 animate-pulse font-semibold">Memuat data siswa...</td></tr>';

    try {
        const data = await getSemuaSiswa();
        _allSiswaData = data || [];
        renderTabelSiswa(_allSiswaData);
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-rose-500 font-bold">Gagal: ${err.message}</td></tr>`;
    }
}

function renderTabelSiswa(data) {
    const tbody = document.getElementById('tbody-kelola-siswa');
    const info = document.getElementById('info-total-siswa');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-slate-400 font-semibold">Belum ada data siswa. Gunakan tab "Import Siswa" atau klik "Tambah Siswa".</td></tr>';
        if (info) info.textContent = '';
        return;
    }

    tbody.innerHTML = data.map(function(s, i) {
        return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="py-2 px-3 text-center"><input type="checkbox" class="chk-siswa-item" value="${_esc(s.nisn)}" onchange="updateBtnHapusSiswa()"></td>
            <td class="py-2 px-3 text-center text-slate-400">${i + 1}</td>
            <td class="py-2 px-3 font-mono text-slate-600">${_esc(s.nisn)}</td>
            <td class="py-2 px-3 font-semibold text-slate-800">${_esc(s.nama)}</td>
            <td class="py-2 px-3 text-slate-600">${_esc(s.kelas)}</td>
            <td class="py-2 px-3 text-center">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="bukaModalEditSiswa('${s.id}','${_esc(s.nisn)}','${_esc(s.nama)}','${_esc(s.kelas)}')"
                            class="text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="hapusSatuSiswa('${_esc(s.nisn)}','${_esc(s.nama)}')"
                            class="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    if (info) info.textContent = `Total: ${data.length} siswa`;
    lucide.createIcons();
}

function filterTabelSiswa() {
    const q = (document.getElementById('filter-siswa-search')?.value || '').toLowerCase();
    if (!q) { renderTabelSiswa(_allSiswaData); return; }
    const filtered = _allSiswaData.filter(function(s) {
        return s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q) || s.kelas.toLowerCase().includes(q);
    });
    renderTabelSiswa(filtered);
}

function toggleAllSiswa(el) {
    document.querySelectorAll('.chk-siswa-item').forEach(function(chk) { chk.checked = el.checked; });
    updateBtnHapusSiswa();
}

function updateBtnHapusSiswa() {
    const checked = document.querySelectorAll('.chk-siswa-item:checked');
    const btn = document.getElementById('btn-hapus-siswa-terpilih');
    if (btn) {
        if (checked.length > 0) {
            btn.classList.remove('hidden');
            btn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Hapus ${checked.length} Siswa`;
            lucide.createIcons();
        } else {
            btn.classList.add('hidden');
        }
    }
}

// --- Modal Tambah/Edit Siswa ---
function bukaModalTambahSiswa() {
    document.getElementById('modal-siswa-title').textContent = 'Tambah Siswa';
    document.getElementById('siswa-nisn').value = '';
    document.getElementById('siswa-nama').value = '';
    document.getElementById('siswa-kelas').value = '';
    document.getElementById('siswa-edit-id').value = '';
    document.getElementById('siswa-nisn').removeAttribute('readonly');
    document.getElementById('modal-siswa').classList.remove('hidden');
    setTimeout(() => document.getElementById('siswa-nisn')?.focus(), 100);
}

function bukaModalEditSiswa(id, nisn, nama, kelas) {
    document.getElementById('modal-siswa-title').textContent = 'Edit Siswa';
    document.getElementById('siswa-nisn').value = nisn;
    document.getElementById('siswa-nama').value = nama;
    document.getElementById('siswa-kelas').value = kelas;
    document.getElementById('siswa-edit-id').value = id;
    document.getElementById('siswa-nisn').setAttribute('readonly', true);
    document.getElementById('modal-siswa').classList.remove('hidden');
    setTimeout(() => document.getElementById('siswa-nama')?.focus(), 100);
}

function tutupModalSiswa() {
    document.getElementById('modal-siswa').classList.add('hidden');
}

async function simpanSiswaUI() {
    const nisn = document.getElementById('siswa-nisn')?.value?.trim();
    const nama = document.getElementById('siswa-nama')?.value?.trim();
    const kelas = document.getElementById('siswa-kelas')?.value?.trim();
    const editId = document.getElementById('siswa-edit-id')?.value;

    if (!nisn || !nama || !kelas) { alert('Semua field wajib diisi.'); return; }

    try {
        let res;
        if (editId) {
            res = await editSiswa(editId, nisn, nama, kelas);
        } else {
            res = await tambahSiswa(nisn, nama, kelas);
        }
        if (res.success) { tutupModalSiswa(); muatDaftarSiswaLengkap(); }
        else alert(res.message || 'Gagal.');
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

// --- Hapus ---
async function hapusSatuSiswa(nisn, nama) {
    if (!confirm(`Hapus siswa "${nama}" (${nisn})?\n\nSemua data presensi, keaktifan, dan nilai siswa ini juga akan dihapus.`)) return;
    try {
        const res = await hapusSiswaByNisn(nisn);
        if (res.success) muatDaftarSiswaLengkap();
        else alert('Gagal: ' + (res.message || ''));
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

async function hapusSiswaTerpilih() {
    const checked = document.querySelectorAll('.chk-siswa-item:checked');
    const nisnArr = Array.from(checked).map(function(c) { return c.value; });
    if (nisnArr.length === 0) return;
    if (!confirm(`Hapus ${nisnArr.length} siswa beserta semua data terkait?\n\nAksi ini tidak bisa dibatalkan!`)) return;

    try {
        const res = await hapusSiswaMassal(nisnArr);
        alert(`✅ ${res.dihapus} siswa berhasil dihapus.`);
        muatDaftarSiswaLengkap();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

async function hapusSemuaSiswaUI() {
    const total = _allSiswaData.length;
    if (total === 0) { alert('Tidak ada data siswa.'); return; }
    if (!confirm(`⚠️ HAPUS SEMUA ${total} SISWA?\n\nSemua data presensi, nilai, dan keaktifan juga akan dihapus.\n\nKetik "HAPUS" di prompt berikutnya untuk konfirmasi.`)) return;
    const konfirmasi = prompt('Ketik "HAPUS" (huruf kapital) untuk mengkonfirmasi:');
    if (konfirmasi !== 'HAPUS') { alert('Dibatalkan.'); return; }

    try {
        const res = await hapusSemuaSiswa();
        if (res.success) {
            alert('✅ Semua data siswa berhasil dihapus.');
            muatDaftarSiswaLengkap();
        }
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

// =========================================================
// KELAS MENGAJAR (merged into Profil tab)
// =========================================================
let _kelasMengajarData = [];

async function muatKelasMengajar() {
    const container = document.getElementById('daftar-kelas-mengajar');
    if (!container) return;
    container.innerHTML = '<div class="col-span-full text-center py-6 text-indigo-500 animate-pulse font-semibold text-xs">Memuat...</div>';

    try {
        const data = await getDaftarMengajar();
        _kelasMengajarData = data || [];
        renderKelasMengajar();
    } catch (err) {
        if (container) container.innerHTML = `<div class="col-span-full text-center py-6 text-rose-500 font-bold text-xs">Gagal: ${err.message}</div>`;
    }

    try {
        const kelasArr = await getDaftarKelasUnik();
        const sel = document.getElementById('input-kelas-mengajar');
        if (!sel) return;
        sel.innerHTML = '<option value="">— Pilih Kelas —</option>';
        (kelasArr || []).forEach(function(k) { sel.innerHTML += `<option value="${_esc(k)}">${_esc(k)}</option>`; });
    } catch (err) {
        console.error('Gagal muat kelas unik:', err);
    }
}

function renderKelasMengajar() {
    const container = document.getElementById('daftar-kelas-mengajar');
    if (!container) return;
    if (_kelasMengajarData.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-4 text-slate-400 font-semibold text-xs">Belum ada kelas yang diampu.</div>';
        return;
    }
    container.innerHTML = _kelasMengajarData.map(function(k) {
        return `<div class="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 hover:shadow-sm transition-all group">
            <div><p class="font-bold text-slate-800 text-xs">${_esc(k.kelas)}</p><p class="text-[10px] text-indigo-600 font-semibold">${_esc(k.mapel)}</p></div>
            <button onclick="hapusKelasMengajarUI(${k._id},'${_esc(k.kelas)} - ${_esc(k.mapel)}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>`;
    }).join('');
    lucide.createIcons();
}

async function tambahKelasMengajarUI() {
    const kelas = document.getElementById('input-kelas-mengajar')?.value?.trim();
    const mapel = document.getElementById('input-mapel-mengajar')?.value?.trim();
    if (!kelas || !mapel) { alert('Pilih Kelas dan isi Mata Pelajaran.'); return; }

    try {
        const res = await tambahKelasMengajar(kelas, mapel);
        if (res.success) {
            document.getElementById('input-kelas-mengajar').value = '';
            document.getElementById('input-mapel-mengajar').value = '';
            muatKelasMengajar();
            if (typeof muatDaftarKelasDanMapel === 'function') muatDaftarKelasDanMapel();
        } else {
            alert(res.message || 'Gagal.');
        }
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

async function hapusKelasMengajarUI(id, label) {
    if (!confirm(`Hapus kelas "${label}"?`)) return;
    try {
        await hapusKelasMengajar(id);
        muatKelasMengajar();
        if (typeof muatDaftarKelasDanMapel === 'function') muatDaftarKelasDanMapel();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

// =========================================================
// MIGRASI
// =========================================================
async function jalankanMigrasi() {
    if (!confirm('Jalankan migrasi data lama?\n\nIni akan menambahkan kolom Periode ke semua sheet yang belum memilikinya. Proses ini aman dan tidak menghapus data.')) return;
    const btn = document.getElementById('btn-migrasi');
    if (btn) { btn.disabled = true; btn.textContent = 'Menjalankan migrasi...'; }

    try {
        const result = await jalankanMigrasiPeriode();
        if (btn) { btn.disabled = false; btn.textContent = 'Jalankan Migrasi'; }
        alert('Migrasi selesai:\n\n' + (result.laporan || []).join('\n'));
        initHalamanPengaturan();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Jalankan Migrasi'; }
        alert('Error migrasi: ' + (err.message || err));
    }
}

// =========================================================
// DATA MASTER: Guru & Wali Kelas
// =========================================================
let _dmGuruData = [];
let _dmWaliData = [];

async function muatDmGuru() {
    const tbody = document.getElementById('dm-tbody-guru');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-indigo-500 animate-pulse font-semibold">Memuat...</td></tr>';
    try {
        const data = await getDataGuru();
        _dmGuruData = data || [];
        renderDmGuru();
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-500 font-bold">Gagal: ${err.message}</td></tr>`;
    }
}

// Sortir tabel guru: bisa berdasarkan kode ATAU nama, naik/turun
let _dmGuruSort = { by: 'kode', dir: 'asc' };

function urutkanGuru(by) {
    if (_dmGuruSort.by === by) _dmGuruSort.dir = (_dmGuruSort.dir === 'asc' ? 'desc' : 'asc');
    else _dmGuruSort = { by: by, dir: 'asc' };
    renderDmGuru();
}

function _bandingGuru(a, b) {
    const key = _dmGuruSort.by === 'nama' ? 'nama' : 'kode_guru';
    // numeric:true -> kode bernomor tanpa nol depan tetap urut benar (G2 sebelum G10)
    const r = String(a[key] || '').localeCompare(String(b[key] || ''), 'id', { numeric: true, sensitivity: 'base' });
    return _dmGuruSort.dir === 'desc' ? -r : r;
}

function renderDmGuru() {
    const tbody = document.getElementById('dm-tbody-guru');
    if (!tbody) return;
    const q = (document.getElementById('dm-guru-cari')?.value || '').toLowerCase().trim();
    const data = (q
        ? _dmGuruData.filter(g => (g.nama || '').toLowerCase().includes(q) || (g.kode_guru || '').toLowerCase().includes(q))
        : _dmGuruData.slice()).sort(_bandingGuru);

    // Indikator panah pada header yang aktif
    const panah = _dmGuruSort.dir === 'asc' ? '↑' : '↓';
    const indKode = document.getElementById('dm-guru-sort-kode');
    const indNama = document.getElementById('dm-guru-sort-nama');
    if (indKode) indKode.textContent = _dmGuruSort.by === 'kode' ? panah : '';
    if (indNama) indNama.textContent = _dmGuruSort.by === 'nama' ? panah : '';

    const info = document.getElementById('dm-guru-info');
    if (info) info.textContent = _dmGuruData.length + ' guru' + (q ? ' · ' + data.length + ' cocok' : '')
        + ' · urut ' + (_dmGuruSort.by === 'nama' ? 'nama' : 'kode') + ' ' + (_dmGuruSort.dir === 'asc' ? 'A→Z' : 'Z→A');
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-slate-400 font-semibold">' + (q ? 'Tidak ada guru yang cocok.' : 'Belum ada data guru. Gunakan "Import Guru" untuk menambah banyak sekaligus.') + '</td></tr>'; return; }
    tbody.innerHTML = data.map(function(g, i) {
        return `<tr class="hover:bg-slate-50 group"><td class="py-2 px-3 text-slate-400">${i+1}</td><td class="py-2 px-3 font-mono font-bold text-indigo-600">${_esc(g.kode_guru)}</td><td class="py-2 px-3 font-semibold text-slate-800">${_esc(g.nama)}</td><td class="py-2 px-3 text-center"><div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100"><button onclick="editGuruUI(${g.id},'${_esc(g.kode_guru)}','${_esc(g.nama)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button><button onclick="hapusGuruUI(${g.id},'${_esc(g.nama)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div></td></tr>`;
    }).join('');
    lucide.createIcons();
}

function bukaModalGuru() {
    document.getElementById('modal-guru-title').textContent = 'Tambah Guru';
    document.getElementById('dm-guru-kode').value = '';
    document.getElementById('dm-guru-nama').value = '';
    document.getElementById('dm-guru-edit-id').value = '';
    document.getElementById('modal-dm-guru').classList.remove('hidden');
}

function editGuruUI(id, kode, nama) {
    document.getElementById('modal-guru-title').textContent = 'Edit Guru';
    document.getElementById('dm-guru-kode').value = kode;
    document.getElementById('dm-guru-nama').value = nama;
    document.getElementById('dm-guru-edit-id').value = id;
    document.getElementById('modal-dm-guru').classList.remove('hidden');
}

async function simpanGuru() {
    const kode = document.getElementById('dm-guru-kode')?.value?.trim();
    const nama = document.getElementById('dm-guru-nama')?.value?.trim();
    const editId = document.getElementById('dm-guru-edit-id')?.value;
    if (!kode || !nama) { alert('Kode dan Nama wajib diisi.'); return; }

    try {
        let res;
        if (editId) { res = await editGuru(editId, kode, nama); }
        else { res = await tambahGuru(kode, nama); }
        if (res && !res.success) { alert(res.message); return; }
        document.getElementById('modal-dm-guru').classList.add('hidden');
        muatDmGuru();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

// ── IMPORT MASSAL GURU (CSV/Excel) ──────────────────────────
let _dmGuruImportPreview = [];

function bukaImportGuru() {
    _dmGuruImportPreview = [];
    document.getElementById('import-guru-status').textContent = '';
    document.getElementById('import-guru-preview-section')?.classList.add('hidden');
    const inp = document.getElementById('import-guru-file');
    if (inp) inp.value = '';
    document.getElementById('modal-import-guru').classList.remove('hidden');
    const dz = document.getElementById('import-guru-dropzone');
    if (dz && !dz.dataset.bound) {
        dz.dataset.bound = '1';
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('border-indigo-400', 'bg-indigo-50'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('border-indigo-400', 'bg-indigo-50'));
        dz.addEventListener('drop', e => {
            e.preventDefault();
            dz.classList.remove('border-indigo-400', 'bg-indigo-50');
            if (e.dataTransfer.files[0]) _prosesFileGuru(e.dataTransfer.files[0]);
        });
    }
    lucide.createIcons();
}

function _handleFileGuru(input) {
    if (input.files[0]) _prosesFileGuru(input.files[0]);
}

function _prosesFileGuru(file) {
    const statusEl = document.getElementById('import-guru-status');
    if (statusEl) statusEl.textContent = 'Membaca file...';
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let rows = [];
            if (ext === 'csv') {
                rows = e.target.result.split('\n').map(r => r.split(/[,;]/).map(c => c.trim().replace(/^"|"$/g, '')));
            } else if (ext === 'xlsx' || ext === 'xls') {
                if (typeof XLSX === 'undefined') { statusEl.innerHTML = '<span class="text-rose-600">Library Excel belum dimuat, refresh halaman.</span>'; return; }
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
            } else {
                statusEl.innerHTML = '<span class="text-rose-600">Format tidak didukung. Gunakan CSV atau Excel.</span>';
                return;
            }
            _previewImportGuru(rows);
        } catch (err) {
            statusEl.innerHTML = `<span class="text-rose-600">Error membaca file: ${err.message}</span>`;
        }
    };
    if (ext === 'csv') reader.readAsText(file); else reader.readAsBinaryString(file);
}

function _previewImportGuru(rows) {
    const statusEl = document.getElementById('import-guru-status');
    if (!rows || rows.length === 0) { statusEl.innerHTML = '<span class="text-amber-600">File kosong.</span>'; return; }

    // Deteksi header; jika baris pertama bukan header, ikut diproses sebagai data
    const first = rows[0].map(h => String(h).toLowerCase().trim());
    const punyaHeader = first.some(h => h.includes('kode') || h.includes('nama'));
    let iKode = first.findIndex(h => h.includes('kode'));
    let iNama = first.findIndex(h => h.includes('nama'));
    if (iKode < 0) iKode = 0;
    if (iNama < 0) iNama = 1;

    const kodeAda = new Set(_dmGuruData.map(g => String(g.kode_guru || '').toLowerCase()));
    const kodeDiFile = new Set();
    _dmGuruImportPreview = [];
    (punyaHeader ? rows.slice(1) : rows).forEach(row => {
        const kode = String(row[iKode] || '').trim();
        const nama = String(row[iNama] || '').trim();
        if (!kode && !nama) return;
        const k = kode.toLowerCase();
        const dup = kodeAda.has(k) || kodeDiFile.has(k);
        if (!dup) kodeDiFile.add(k);
        _dmGuruImportPreview.push({ kode, nama, isDuplikat: dup, invalid: !kode || !nama });
    });

    const baru = _dmGuruImportPreview.filter(d => !d.isDuplikat && !d.invalid).length;
    const dup = _dmGuruImportPreview.filter(d => d.isDuplikat).length;
    const invalid = _dmGuruImportPreview.filter(d => d.invalid).length;
    statusEl.innerHTML = `<span class="text-emerald-600 font-bold">${baru} guru baru</span>`
        + (dup ? ` · <span class="text-amber-600 font-bold">${dup} duplikat (dilewati)</span>` : '')
        + (invalid ? ` · <span class="text-rose-600 font-bold">${invalid} tidak lengkap (dilewati)</span>` : '');

    document.getElementById('import-guru-preview-section')?.classList.remove('hidden');
    const tbody = document.getElementById('import-guru-tbody');
    if (tbody) {
        tbody.innerHTML = _dmGuruImportPreview.slice(0, 300).map((d, i) => {
            const cls = d.invalid ? 'bg-rose-50' : (d.isDuplikat ? 'bg-amber-50' : '');
            const badge = d.invalid ? '<span class="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-lg">✕ Tak lengkap</span>'
                : d.isDuplikat ? '<span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg">⚠ Duplikat</span>'
                : '<span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg">✓ Baru</span>';
            return `<tr class="${cls}"><td class="py-1.5 px-3 text-center text-slate-400">${i+1}</td><td class="py-1.5 px-3 font-mono text-xs">${_esc(d.kode)}</td><td class="py-1.5 px-3 font-semibold text-sm">${_esc(d.nama)}</td><td class="py-1.5 px-3 text-center">${badge}</td></tr>`;
        }).join('') + (_dmGuruImportPreview.length > 300 ? `<tr><td colspan="4" class="py-2 px-3 text-center text-[10px] text-slate-400 font-semibold">…dan ${_dmGuruImportPreview.length - 300} baris lain</td></tr>` : '');
    }
    const btn = document.getElementById('btn-konfirmasi-import-guru');
    if (btn) btn.disabled = baru === 0;
    lucide.createIcons();
}

async function konfirmasiImportGuru() {
    const toImport = _dmGuruImportPreview.filter(d => !d.isDuplikat && !d.invalid);
    if (toImport.length === 0) { alert('Tidak ada data guru baru untuk diimport.'); return; }
    if (!confirm(`Import ${toImport.length} guru baru?`)) return;
    const btn = document.getElementById('btn-konfirmasi-import-guru');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengimport...'; }
    try {
        // Kirim bertahap agar ratusan data tidak menabrak batas payload
        let total = 0;
        const errs = [];
        for (let i = 0; i < toImport.length; i += 100) {
            const res = await importDataGuruMassal(toImport.slice(i, i + 100));
            total += res.berhasil;
            if (res.errorList && res.errorList.length) errs.push(...res.errorList);
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="upload" class="w-4 h-4 inline mr-1"></i>Import Sekarang'; }
        if (total > 0) {
            alert('✅ Berhasil mengimport ' + total + ' guru!');
            document.getElementById('modal-import-guru').classList.add('hidden');
            _dmGuruImportPreview = [];
            muatDmGuru();
        } else {
            alert('Gagal import:\n' + errs.join('\n'));
        }
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Import Sekarang'; }
        alert('Error: ' + (err.message || err));
    }
    lucide.createIcons();
}

function unduhTemplateGuru() {
    const csv = 'kode_guru,nama_guru\nG001,Nama Guru Contoh\nG002,Nama Guru Lainnya\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'template-import-guru.csv';
    document.body.appendChild(a); a.click(); a.remove();
}

async function hapusGuruUI(id, nama) {
    if (!confirm(`Hapus guru "${nama}"?`)) return;
    try {
        await hapusGuru(id);
        muatDmGuru();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

// --- Data Wali Kelas ---
let _dmWaliDataLocal = [];

async function muatDmWali() {
    const tbody = document.getElementById('dm-tbody-wali');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-indigo-500 animate-pulse font-semibold">Memuat...</td></tr>';
    try {
        const data = await getDataWaliKelas();
        _dmWaliDataLocal = data || [];
        renderDmWali();
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-rose-500 font-bold">Gagal: ${err.message}</td></tr>`;
    }
}

function renderDmWali() {
    const tbody = document.getElementById('dm-tbody-wali');
    if (!tbody) return;
    if (_dmWaliDataLocal.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-400 font-semibold">Belum ada data wali kelas.</td></tr>'; return; }
    tbody.innerHTML = _dmWaliDataLocal.map(function(w, i) {
        return `<tr class="hover:bg-slate-50 group"><td class="py-2 px-3 text-slate-400">${i+1}</td><td class="py-2 px-3 font-bold text-slate-800">${_esc(w.kelas)}</td><td class="py-2 px-3 text-slate-700">${_esc(w.nama_wali)}</td><td class="py-2 px-3 text-indigo-600 font-bold">${w.total_siswa}</td><td class="py-2 px-3 text-center"><div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100"><button onclick="editWaliUI(${w.id},'${_esc(w.kelas)}','${_esc(w.nama_wali)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button><button onclick="hapusWaliUI(${w.id},'${_esc(w.kelas)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div></td></tr>`;
    }).join('');
    lucide.createIcons();
}

function bukaModalWali() {
    document.getElementById('modal-wali-title').textContent = 'Tambah Wali Kelas';
    document.getElementById('dm-wali-kelas').value = '';
    document.getElementById('dm-wali-edit-id').value = '';
    _populateKelasDropdownWali('');
    _populateGuruDropdownWali('');
    document.getElementById('modal-dm-wali').classList.remove('hidden');
}

function editWaliUI(id, kelas, nama) {
    document.getElementById('modal-wali-title').textContent = 'Edit Wali Kelas';
    document.getElementById('dm-wali-edit-id').value = id;
    _populateKelasDropdownWali(kelas);
    _populateGuruDropdownWali(nama);
    document.getElementById('modal-dm-wali').classList.remove('hidden');
}

async function _populateKelasDropdownWali(selectedValue) {
    const sel = document.getElementById('dm-wali-kelas');
    try {
        const kelasArr = await getDaftarKelasUnik();
        sel.innerHTML = '<option value="">— Pilih Kelas —</option>';
        (kelasArr || []).forEach(function(k) {
            sel.innerHTML += `<option value="${_esc(k)}" ${k === selectedValue ? 'selected' : ''}>${_esc(k)}</option>`;
        });
    } catch (err) {
        console.error('Gagal muat dropdown kelas:', err);
    }
}

// Nama wali kelas dipilih dari Data Guru (bukan ketik manual)
async function _populateGuruDropdownWali(selectedValue) {
    const sel = document.getElementById('dm-wali-nama');
    if (!sel) return;
    sel.innerHTML = '<option value="">Memuat daftar guru...</option>';
    try {
        let guru = _dmGuruData;
        if (!guru || guru.length === 0) { guru = await getDataGuru(); _dmGuruData = guru; }
        if (!guru || guru.length === 0) {
            sel.innerHTML = '<option value="">— Data guru masih kosong, import dulu di tab Guru —</option>';
            return;
        }
        sel.innerHTML = '<option value="">— Pilih Guru —</option>';
        // Dropdown SELALU urut alfabetis berdasarkan nama guru
        guru = guru.slice().sort((a, b) =>
            String(a.nama || a.nama_guru || '').localeCompare(String(b.nama || b.nama_guru || ''), 'id', { sensitivity: 'base' }));
        guru.forEach(function(g) {
            const nm = g.nama || g.nama_guru || '';
            sel.innerHTML += `<option value="${_esc(nm)}" ${nm === selectedValue ? 'selected' : ''}>${_esc(nm)}${g.kode_guru ? ' (' + _esc(g.kode_guru) + ')' : ''}</option>`;
        });
        // Nama lama yang tidak ada di data guru tetap dipertahankan agar tidak hilang saat edit
        if (selectedValue && !guru.some(g => (g.nama || g.nama_guru) === selectedValue)) {
            sel.innerHTML += `<option value="${_esc(selectedValue)}" selected>${_esc(selectedValue)} (tidak ada di data guru)</option>`;
        }
    } catch (err) {
        sel.innerHTML = '<option value="">Gagal memuat daftar guru</option>';
        console.error('Gagal muat dropdown guru:', err);
    }
}

async function simpanWali() {
    const kelas = document.getElementById('dm-wali-kelas')?.value?.trim();
    const nama = document.getElementById('dm-wali-nama')?.value?.trim();
    const editId = document.getElementById('dm-wali-edit-id')?.value;
    if (!kelas || !nama) { alert('Kelas dan Nama Wali wajib diisi.'); return; }

    try {
        let res;
        if (editId) { res = await editWaliKelas(editId, kelas, nama); }
        else { res = await tambahWaliKelas(kelas, nama); }
        if (res && !res.success) { alert(res.message); return; }
        document.getElementById('modal-dm-wali').classList.add('hidden');
        muatDmWali();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

async function hapusWaliUI(id, kelas) {
    if (!confirm(`Hapus wali kelas "${kelas}"?`)) return;
    try {
        await hapusWaliKelas(id);
        muatDmWali();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

// =========================================================
// JADWAL VIEW (Mingguan, navigable)
// =========================================================
let _jadwalViewOffset = 0;
let _jadwalAllData = [];
let _jadwalSiswaCount = {};
let _jadwalOverrides = [];

function initHalamanJadwalView() {
    _jadwalViewOffset = 0;
    _muatJadwalView();
}

function jadwalPrevWeek() { _jadwalViewOffset--; _renderJadwalView(); }
function jadwalNextWeek() { _jadwalViewOffset++; _renderJadwalView(); }
function jadwalThisWeek() { _jadwalViewOffset = 0; _renderJadwalView(); }

async function _muatJadwalView() {
    const grid = document.getElementById('jadwal-week-grid');
    if (grid) grid.innerHTML = '<div class="col-span-full py-10 text-center text-indigo-500 animate-pulse font-semibold text-xs">Memuat jadwal...</div>';

    try {
        const [jadwalData, overridesData] = await Promise.all([
            getDaftarJadwal(),
            getJadwalOverrides()
        ]);
        _jadwalAllData = jadwalData || [];
        _jadwalOverrides = overridesData || [];
        console.log('[TeachMate] Jadwal View loaded:', _jadwalAllData.length, 'items', _jadwalAllData);
        _renderJadwalView();
    } catch (err) {
        if (grid) grid.innerHTML = `<div class="col-span-full py-10 text-center text-rose-500 font-bold">Gagal: ${err.message}</div>`;
    }
}

// Hapus jadwal berulang HANYA untuk satu tanggal (minggu lain tetap ada)
async function _skipJadwal(jadwalId, tanggal, label) {
    if (!confirm('Hapus "' + (label || 'jadwal ini') + '" untuk tanggal ' + tanggal + ' SAJA?\n\nJadwal di minggu-minggu lain tetap ada.')) return;
    try {
        await simpanJadwalOverride({ tanggal: tanggal, jadwalId: jadwalId, aksi: 'skip' });
        _muatJadwalView();
    } catch (err) {
        alert('Gagal: ' + (err.message || err));
    }
}

async function _undoSkipJadwal(tanggal, jadwalId) {
    try {
        await hapusJadwalOverride(tanggal, jadwalId);
        _muatJadwalView();
    } catch (err) {
        alert('Gagal: ' + (err.message || err));
    }
}

// Akhiri jadwal berulang mulai tanggal tertentu (riwayat minggu sebelumnya TETAP tersimpan)
async function _hapusJadwalSeri(jadwalId, label, tglIso) {
    if (!confirm('Hapus "' + (label || 'jadwal ini') + '" mulai ' + tglIso + ' dan SETERUSNYA?\n\nMinggu-minggu SEBELUMNYA tetap tersimpan sebagai riwayat/rekap mengajar.')) return;
    try {
        await simpanJadwalOverride({ tanggal: tglIso, jadwalId: jadwalId, aksi: 'end' });
        _muatJadwalView();
    } catch (err) {
        alert('Gagal: ' + (err.message || err));
    }
}

// Hapus jadwal satu-kali (override 'tambah') di tanggal tertentu
async function _hapusJadwalTambahanUI(tanggal, otId, label) {
    if (!confirm('Hapus jadwal satu kali "' + (label || '') + '" pada ' + tanggal + '?')) return;
    try {
        await hapusJadwalTambahan(tanggal, otId);
        _muatJadwalView();
    } catch (err) {
        alert('Gagal: ' + (err.message || err));
    }
}

// ── Modal tambah jadwal dari view mingguan (per tanggal) ──
function bukaModalJadwalOneTime(tanggal, hari) {
    const modal = document.getElementById('modal-jadwal-onetime');
    if (!modal) return;
    document.getElementById('jot-tanggal').value = tanggal;
    const d = new Date(tanggal + 'T00:00:00');
    document.getElementById('jot-tanggal-label').textContent = hari + ', ' + _fmtTglShort(d) + ' ' + d.getFullYear();
    document.getElementById('jot-mapel').value = '';
    document.getElementById('jot-kelas').value = '';
    document.getElementById('jot-jam-mulai').value = '';
    document.getElementById('jot-jam-selesai').value = '';
    const sel = document.getElementById('jot-pengulangan');
    if (sel) {
        sel.value = 'sekali';
        sel.options[0].text = 'Hanya ' + hari + ' ini (' + _fmtTglShort(d) + ')';
        sel.options[1].text = 'Berulang tiap ' + hari + ' (jam sama)';
    }
    modal.classList.remove('hidden');
    lucide.createIcons();
}

async function simpanJadwalOneTime() {
    const gv = id => document.getElementById(id)?.value?.trim() || '';
    const tanggal = gv('jot-tanggal');
    const mapel = gv('jot-mapel');
    const kelas = gv('jot-kelas');
    if (!mapel) { alert('Nama Kegiatan / Mapel wajib diisi.'); return; }

    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hari = HARI[new Date(tanggal + 'T00:00:00').getDay()];
    const kategori = kelas ? 'Normal' : 'Kegiatan';

    try {
        if (gv('jot-pengulangan') === 'mingguan') {
            const result = await tambahJadwal({
                hari: hari, jam_mulai: gv('jot-jam-mulai'), jam_selesai: gv('jot-jam-selesai'),
                kelas: kelas, mata_pelajaran: mapel, ruang: '', kategori: kategori
            });
            if (!result || !result.success) throw new Error(result?.message || 'Gagal menyimpan.');
            // Berulang MULAI tanggal yang dipilih (tidak muncul di minggu-minggu sebelumnya)
            if (result.id && tanggal) {
                await simpanJadwalOverride({ tanggal: tanggal, jadwalId: result.id, aksi: 'start' });
            }
        } else {
            await simpanJadwalOverride({
                tanggal: tanggal, aksi: 'tambah', id: 'ot' + Date.now(),
                jam_mulai: gv('jot-jam-mulai'), jam_selesai: gv('jot-jam-selesai'),
                kelas: kelas, mata_pelajaran: mapel, ruang: '', kategori: kategori
            });
        }
        document.getElementById('modal-jadwal-onetime').classList.add('hidden');
        _muatJadwalView();
    } catch (err) {
        alert('Gagal: ' + (err.message || err));
    }
}

function _renderJadwalView() {
    const grid = document.getElementById('jadwal-week-grid');
    const labelEl = document.getElementById('jadwal-week-label');
    const rangeEl = document.getElementById('jadwal-week-range');
    if (!grid) return;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + (_jadwalViewOffset * 7));

    const hariList = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const hariColors = ['indigo','violet','sky','emerald','amber','rose'];

    if (labelEl) {
        if (_jadwalViewOffset === 0) labelEl.textContent = 'Minggu Ini';
        else if (_jadwalViewOffset === 1) labelEl.textContent = 'Minggu Depan';
        else if (_jadwalViewOffset === -1) labelEl.textContent = 'Minggu Lalu';
        else labelEl.textContent = (_jadwalViewOffset > 0 ? '+' : '') + _jadwalViewOffset + ' minggu';
    }

    const saturdayDate = new Date(monday);
    saturdayDate.setDate(monday.getDate() + 5);
    if (rangeEl) rangeEl.textContent = _fmtTglShort(monday) + ' — ' + _fmtTglShort(saturdayDate);

    // ── TIMELINE KALENDER: kolom hari + sumbu jam, event diposisikan
    //    sesuai waktunya sehingga JEDA KOSONG terlihat secara visual ──
    const toMin = s => { const m = /^(\d{1,2})[:.](\d{2})/.exec(String(s || '').trim()); return m ? (+m[1]) * 60 + (+m[2]) : null; };

    // Kumpulkan event per hari
    const days = hariList.map(function(hari, idx) {
        const tglObj = new Date(monday);
        tglObj.setDate(monday.getDate() + idx);
        const tglIso = tglObj.getFullYear() + '-' + String(tglObj.getMonth()+1).padStart(2,'0') + '-' + String(tglObj.getDate()).padStart(2,'0');
        const isToday = tglObj.toDateString() === now.toDateString();

        const jadwalHari = _jadwalAllData.filter(j => j.hari === hari && jadwalSeriesAktif(j.id, tglIso, _jadwalOverrides));
        const skippedIds = _jadwalOverrides.filter(o => o.tanggal === tglIso && o.aksi === 'skip').map(o => o.jadwalId);
        return {
            hari, tglObj, tglIso, isToday, color: hariColors[idx],
            visible: jadwalHari.filter(j => !skippedIds.includes(j.id)),
            skipped: jadwalHari.filter(j => skippedIds.includes(j.id)),
            tambahan: _jadwalOverrides.filter(o => o.tanggal === tglIso && o.aksi === 'tambah')
        };
    });

    // Rentang jam dinamis dari data (default 07:00–15:00)
    let minM = 7 * 60, maxM = 15 * 60;
    days.forEach(d => {
        [].concat(d.visible, d.skipped, d.tambahan).forEach(e => {
            const st = toMin(e.jam_mulai), en = toMin(e.jam_selesai);
            if (st !== null) minM = Math.min(minM, st);
            if (en !== null) maxM = Math.max(maxM, en);
        });
    });
    minM = Math.floor(minM / 60) * 60;
    maxM = Math.ceil(maxM / 60) * 60;
    if (maxM - minM < 240) maxM = minM + 240;

    const PPM = 1.1;                       // piksel per menit
    const bodyH = (maxM - minM) * PPM;
    const posy = st => ((st - minM) * PPM);

    // Pembagian kolom utk jadwal yang BENTROK jam (ala Google Calendar):
    // event yang tumpang tindih dibagi berdampingan (kolom), sehingga
    // semua jadwal tetap terlihat & bisa dipilih utk dihapus/dibiarkan.
    const layoutColumns = function(evs) {
        const timed = [], untimed = [];
        evs.forEach(e => {
            const st = toMin(e.jam_mulai), en = toMin(e.jam_selesai);
            e._st = st; e._en = en;
            if (st !== null && en !== null && en > st) timed.push(e); else untimed.push(e);
        });
        timed.sort((a, b) => a._st - b._st || b._en - a._en);
        let cluster = [], colsEnd = [], clusterMaxEnd = -Infinity;
        const flush = () => {
            const n = colsEnd.length || 1;
            cluster.forEach(ev => { ev._cols = n; });
            cluster = []; colsEnd = [];
        };
        timed.forEach(ev => {
            if (cluster.length && ev._st >= clusterMaxEnd) { flush(); clusterMaxEnd = -Infinity; }
            let placed = false;
            for (let c = 0; c < colsEnd.length; c++) {
                if (colsEnd[c] <= ev._st) { ev._col = c; colsEnd[c] = ev._en; placed = true; break; }
            }
            if (!placed) { ev._col = colsEnd.length; colsEnd.push(ev._en); }
            cluster.push(ev);
            clusterMaxEnd = Math.max(clusterMaxEnd, ev._en);
        });
        flush();
        untimed.forEach(ev => { ev._col = 0; ev._cols = 1; });
    };

    // Blok event (dipakai utk normal / sekali / skip)
    const blok = function(e, d, jenis) {
        const st = toMin(e.jam_mulai), en = toMin(e.jam_selesai);
        const top = st !== null ? posy(st) : 0;
        const h = (st !== null && en !== null && en > st) ? Math.max((en - st) * PPM, 40) : 44;
        const cols = e._cols || 1, col = e._col || 0;
        const pos = 'left:calc(' + (col / cols * 100).toFixed(4) + '% + 2px);width:calc(' + (100 / cols).toFixed(4) + '% - 4px);top:' + top + 'px;';
        const label = _esc((e.kelas ? e.kelas + ' - ' : '') + (e.mata_pelajaran || e.mapel || ''));
        const jamLabel = (e.jam_mulai || '?') + '–' + (e.jam_selesai || '?');
        if (jenis === 'skip') {
            return `<div class="absolute rounded-lg border border-dashed border-slate-300 bg-slate-50/90 px-1.5 py-1 overflow-hidden group/ev hover:z-30" style="${pos}height:${Math.max(h,34)}px" title="Dihapus hari ini: ${jamLabel} ${label}">
                <p class="text-[9px] font-bold text-slate-400 line-through leading-tight truncate">${jamLabel} ${label}</p>
                <button onclick="_undoSkipJadwal('${d.tglIso}',${e.id})" class="text-[9px] font-black text-indigo-600 hover:underline">Undo</button>
            </div>`;
        }
        const isSekali = jenis === 'sekali';
        // Warna berdasarkan KATEGORI jadwal (bukan hari):
        // Normal = indigo, Intensif = amber, Kegiatan = slate
        const kat = e.kategori || 'Normal';
        const katPalette = {
            Normal:   ['bg-indigo-100/90 border-indigo-300', 'text-indigo-800'],
            Intensif: ['bg-amber-100/90 border-amber-300', 'text-amber-800'],
            Kegiatan: ['bg-slate-200/90 border-slate-300', 'text-slate-700']
        };
        const pal = katPalette[kat] || katPalette.Normal;
        const bg = pal[0], txt = pal[1];
        const bentrok = cols > 1;
        const btns = isSekali
            ? `<button onclick="_hapusJadwalTambahanUI('${d.tglIso}','${_esc(e.id)}','${label}')" title="Hapus jadwal satu kali ini" class="p-0.5 rounded bg-white/90 text-slate-400 hover:text-rose-600 border border-slate-200"><i data-lucide="trash-2" class="w-3 h-3"></i></button>`
            : `<button onclick="_skipJadwal(${e.id},'${d.tglIso}','${label}')" title="Hapus hari ini saja" class="p-0.5 rounded bg-white/90 text-slate-400 hover:text-amber-600 border border-slate-200"><i data-lucide="calendar-x" class="w-3 h-3"></i></button>
               <button onclick="_hapusJadwalSeri(${e.id},'${label}','${d.tglIso}')" title="Hapus mulai tanggal ini & seterusnya (riwayat aman)" class="p-0.5 rounded bg-white/90 text-slate-400 hover:text-rose-600 border border-slate-200"><i data-lucide="trash-2" class="w-3 h-3"></i></button>`;
        // Saat bentrok (kolom sempit), hover memperlebar blok ke seluruh kolom hari agar detail terbaca
        const hoverExpand = bentrok ? ' hover:!left-1 hover:!right-1 hover:!w-auto' : '';
        return `<div class="absolute rounded-lg border ${bg} shadow-sm px-1.5 py-1 overflow-hidden group/ev hover:z-30 hover:shadow-md transition-all${hoverExpand}" style="${pos}height:${h}px" title="${jamLabel} · ${label}${bentrok ? ' (bentrok jam)' : ''}">
            <p class="text-[9px] font-black ${txt} leading-tight truncate">${jamLabel}${isSekali ? ' <span class="bg-emerald-500 text-white px-1 rounded uppercase">1x</span>' : ''}${bentrok ? ' <span class="bg-rose-500 text-white px-1 rounded uppercase">bentrok</span>' : ''}</p>
            ${e.kelas ? `<p class="text-[10px] font-bold text-slate-800 leading-tight truncate">${_esc(e.kelas)}</p>` : ''}
            <p class="text-[9px] font-semibold ${txt} leading-tight truncate">${_esc(e.mata_pelajaran || e.mapel || '')}</p>
            <div class="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover/ev:opacity-100 transition-opacity">${btns}</div>
        </div>`;
    };

    // Gutter jam
    let gutter = '';
    for (let m = minM; m <= maxM; m += 60) {
        gutter += `<div class="absolute right-1.5 text-[9px] font-bold text-slate-400" style="top:${posy(m) - 6}px">${String(Math.floor(m/60)).padStart(2,'0')}:00</div>`;
    }

    // Garis jam horizontal (background) per kolom hari
    const gridBg = `background-image:repeating-linear-gradient(to bottom,#e2e8f0 0,#e2e8f0 1px,transparent 1px,transparent ${60*PPM}px);`;

    // Garis "sekarang" utk hari ini
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowLine = (nowMin >= minM && nowMin <= maxM)
        ? `<div class="absolute left-0 right-0 border-t-2 border-rose-400 z-10 pointer-events-none" style="top:${posy(nowMin)}px"><span class="absolute -top-1 -left-0.5 w-2 h-2 rounded-full bg-rose-400"></span></div>`
        : '';

    // Legenda warna kategori
    const legenda = `<div class="flex items-center gap-3 flex-wrap mb-2 px-1">
        <span class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span class="w-3 h-3 rounded bg-indigo-100 border border-indigo-300"></span>Jam Normal</span>
        <span class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span class="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>Intensif</span>
        <span class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span class="w-3 h-3 rounded bg-slate-200 border border-slate-300"></span>Kegiatan</span>
        <span class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><span class="text-[8px] font-black bg-emerald-500 text-white px-1 rounded uppercase">1x</span>Jadwal sekali</span>
    </div>`;

    let html = legenda + `<div class="min-w-[840px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="grid" style="grid-template-columns:46px repeat(6,minmax(126px,1fr));">
            <div class="border-b border-slate-100 bg-slate-50"></div>`;
    days.forEach(d => {
        html += `<div class="border-b border-l border-slate-100 ${d.isToday ? 'bg-indigo-600 text-white' : 'bg-slate-50'} px-2.5 py-2 flex items-center justify-between">
            <div>
                <p class="font-bold text-xs">${d.hari}</p>
                <p class="text-[9px] ${d.isToday ? 'text-indigo-200' : 'text-slate-400'}">${_fmtTglShort(d.tglObj)}</p>
            </div>
            <button onclick="bukaModalJadwalOneTime('${d.tglIso}','${d.hari}')" title="Tambah jadwal ${d.hari} ini"
                class="p-1 rounded-lg ${d.isToday ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'} transition-colors">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
        </div>`;
    });
    // Baris badan: gutter + 6 kolom timeline
    html += `<div class="relative bg-slate-50/50" style="height:${bodyH + 16}px">${gutter}</div>`;
    days.forEach(d => {
        // Semua event hari ini (aktif + sekali + dihapus) di-layout bersama
        // agar jadwal yang bentrok jam tampil berdampingan, bukan tertutup.
        const items = [].concat(
            d.visible.map(e => ({ e: e, type: 'normal' })),
            d.tambahan.map(e => ({ e: e, type: 'sekali' })),
            d.skipped.map(e => ({ e: e, type: 'skip' }))
        );
        layoutColumns(items.map(it => it.e));
        html += `<div class="relative border-l border-slate-100 ${d.isToday ? 'bg-indigo-50/40' : ''}" style="height:${bodyH + 16}px;${gridBg}">
            ${d.isToday ? nowLine : ''}
            ${items.map(it => blok(it.e, d, it.type)).join('')}
        </div>`;
    });
    html += `</div></div>`;

    grid.innerHTML = html;
    lucide.createIcons();
}

function _fmtTglShort(d) {
    const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return d.getDate() + ' ' + bulan[d.getMonth()];
}

// =========================================================
// HELPER
// =========================================================
function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// =========================================================
// QUICK LINKS PAGE (halaman-quicklinks)
// =========================================================
let _qlData = { categories: ['Umum'], links: [] };

async function initHalamanQuickLinks() {
    const container = document.getElementById('ql-container');
    if (!container) return;
    container.innerHTML = '<div class="py-10 text-center text-indigo-500 animate-pulse font-semibold">Memuat quick links...</div>';
    try {
        const data = await getQuickLinksData();
        _qlData = data || { categories: ['Umum'], links: [] };
        if (!_qlData.categories || _qlData.categories.length === 0) _qlData.categories = ['Umum'];
        if (!_qlData.links) _qlData.links = [];
        _renderQuickLinksFullPage();
    } catch (err) {
        container.innerHTML = `<div class="py-10 text-center text-rose-500 font-bold">Gagal memuat: ${err.message}</div>`;
    }
}

function _renderQuickLinksFullPage() {
    const container = document.getElementById('ql-container');
    if (!container) return;

    if (_qlData.links.length === 0) {
        container.innerHTML = '<div class="py-10 text-center text-slate-400 font-semibold">Belum ada link. Klik "+ Tambah Link" untuk menambahkan.</div>';
        lucide.createIcons();
        return;
    }

    const colorMap = { emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', sky: 'bg-sky-50 border-sky-200 text-sky-700', indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700', violet: 'bg-violet-50 border-violet-200 text-violet-700', rose: 'bg-rose-50 border-rose-200 text-rose-700' };

    // Group by category
    let html = '';
    _qlData.categories.forEach(cat => {
        const linksInCat = _qlData.links.filter(l => (l.kategori || 'Umum') === cat);
        if (linksInCat.length === 0 && _qlData.categories.length > 1) return; // skip empty categories unless it's the only one

        html += `<div class="space-y-3">
            <div class="flex items-center justify-between">
                <h4 class="font-bold text-slate-700 text-sm">${_esc(cat)}</h4>
                ${_qlData.categories.length > 1 ? `<button onclick="_hapusKategori('${_esc(cat)}')" class="text-[10px] text-slate-400 hover:text-rose-500 font-bold">Hapus Kategori</button>` : ''}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                ${linksInCat.map((l, i) => {
                    const idx = _qlData.links.indexOf(l);
                    const cls = colorMap[l.color] || colorMap.indigo;
                    return `<div class="group relative flex items-center gap-3 p-4 rounded-2xl border ${cls} hover:shadow-md transition-all">
                        <i data-lucide="${_esc(l.icon || 'link')}" class="w-5 h-5 shrink-0"></i>
                        <div class="flex-1 min-w-0">
                            <a href="${_esc(l.url)}" data-ql-track="${_esc(l.url)}" target="_blank" class="font-bold text-sm block truncate hover:underline">${_esc(l.label)}</a>
                            <p class="text-[10px] opacity-60 truncate">${_esc(l.url)}</p>
                        </div>
                        <div class="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                            <button onclick="_editQL(${idx})" class="bg-white/80 p-1.5 rounded-lg hover:bg-white shadow-sm"><i data-lucide="edit-3" class="w-3 h-3 text-slate-600"></i></button>
                            <button onclick="_hapusQL(${idx})" class="bg-white/80 p-1.5 rounded-lg hover:bg-rose-50 shadow-sm"><i data-lucide="trash-2" class="w-3 h-3 text-rose-500"></i></button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    });

    container.innerHTML = html;
    lucide.createIcons();
}

// ── Modal: Tambah Kategori ──
function bukaModalTambahKategori() {
    document.getElementById('ql-kategori-nama').value = '';
    document.getElementById('modal-ql-kategori').classList.remove('hidden');
    setTimeout(() => document.getElementById('ql-kategori-nama')?.focus(), 100);
}

async function simpanKategoriBaru() {
    const nama = document.getElementById('ql-kategori-nama')?.value?.trim();
    if (!nama) { alert('Nama kategori wajib diisi.'); return; }
    if (_qlData.categories.includes(nama)) { alert('Kategori sudah ada.'); return; }

    _qlData.categories.push(nama);
    await simpanQuickLinks(_qlData);
    document.getElementById('modal-ql-kategori').classList.add('hidden');
    _renderQuickLinksFullPage();
}

async function _hapusKategori(cat) {
    const linksInCat = _qlData.links.filter(l => (l.kategori || 'Umum') === cat);
    if (linksInCat.length > 0) {
        if (!confirm(`Kategori "${cat}" punya ${linksInCat.length} link. Hapus kategori beserta semua link-nya?`)) return;
        _qlData.links = _qlData.links.filter(l => (l.kategori || 'Umum') !== cat);
    }
    _qlData.categories = _qlData.categories.filter(c => c !== cat);
    if (_qlData.categories.length === 0) _qlData.categories = ['Umum'];
    await simpanQuickLinks(_qlData);
    _renderQuickLinksFullPage();
}

// ── Modal: Tambah/Edit Link ──
let _qlEditIdx = null;

function bukaModalTambahLink() {
    _qlEditIdx = null;
    document.getElementById('modal-ql-link-title').textContent = 'Tambah Link';
    document.getElementById('ql-link-label').value = '';
    document.getElementById('ql-link-url').value = '';
    _populateQLKategoriDropdown('');
    _populateQLIconGrid('link');
    _populateQLColorGrid('indigo');
    document.getElementById('ql-link-edit-idx').value = '';
    document.getElementById('modal-ql-link').classList.remove('hidden');
    setTimeout(() => document.getElementById('ql-link-label')?.focus(), 100);
}

function _editQL(idx) {
    _qlEditIdx = idx;
    const l = _qlData.links[idx];
    if (!l) return;
    document.getElementById('modal-ql-link-title').textContent = 'Edit Link';
    document.getElementById('ql-link-label').value = l.label || '';
    document.getElementById('ql-link-url').value = l.url || '';
    document.getElementById('ql-link-edit-idx').value = idx;
    _populateQLKategoriDropdown(l.kategori || 'Umum');
    _populateQLIconGrid(l.icon || 'link');
    _populateQLColorGrid(l.color || 'indigo');
    document.getElementById('modal-ql-link').classList.remove('hidden');
}

function _populateQLKategoriDropdown(selected) {
    const sel = document.getElementById('ql-link-kategori');
    if (!sel) return;
    sel.innerHTML = _qlData.categories.map(c => `<option value="${_esc(c)}" ${c === selected ? 'selected' : ''}>${_esc(c)}</option>`).join('');
}

function _populateQLIconGrid(selected) {
    const icons = ['link','external-link','globe','book-open','file-text','video','hard-drive','graduation-cap','table-2','mail','phone','calendar','map-pin','music','image','code','terminal','database','star','heart','bookmark','clipboard','folder','search','settings'];
    const grid = document.getElementById('ql-icon-grid');
    if (!grid) return;
    grid.innerHTML = icons.map(ic => `<button type="button" onclick="_selectQLIcon('${ic}')" class="w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${ic === selected ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}"><i data-lucide="${ic}" class="w-4 h-4"></i></button>`).join('');
    document.getElementById('ql-link-icon').value = selected;
    lucide.createIcons();
}

function _selectQLIcon(icon) {
    document.getElementById('ql-link-icon').value = icon;
    _populateQLIconGrid(icon);
}

function _populateQLColorGrid(selected) {
    const colors = ['indigo','emerald','amber','sky','violet','rose'];
    const grid = document.getElementById('ql-color-grid');
    if (!grid) return;
    const colorBg = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', sky: 'bg-sky-500', violet: 'bg-violet-500', rose: 'bg-rose-500' };
    grid.innerHTML = colors.map(c => `<button type="button" onclick="_selectQLColor('${c}')" class="w-7 h-7 rounded-full ${colorBg[c]} transition-all ${c === selected ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'}"></button>`).join('');
    document.getElementById('ql-link-color').value = selected;
}

function _selectQLColor(color) {
    document.getElementById('ql-link-color').value = color;
    _populateQLColorGrid(color);
}

async function simpanLinkQL() {
    const label = document.getElementById('ql-link-label')?.value?.trim();
    const url = document.getElementById('ql-link-url')?.value?.trim();
    const kategori = document.getElementById('ql-link-kategori')?.value || 'Umum';
    const icon = document.getElementById('ql-link-icon')?.value || 'link';
    const color = document.getElementById('ql-link-color')?.value || 'indigo';

    if (!label || !url) { alert('Label dan URL wajib diisi.'); return; }

    const link = { label, url, kategori, icon, color };

    if (_qlEditIdx !== null) {
        _qlData.links[_qlEditIdx] = link;
    } else {
        _qlData.links.push(link);
    }

    try {
        await simpanQuickLinks(_qlData);
        document.getElementById('modal-ql-link').classList.add('hidden');
        _renderQuickLinksFullPage();
    } catch (err) {
        alert('Gagal menyimpan: ' + (err.message || err));
    }
}

async function _hapusQL(idx) {
    if (!confirm('Hapus link ini?')) return;
    _qlData.links.splice(idx, 1);
    await simpanQuickLinks(_qlData);
    _renderQuickLinksFullPage();
}

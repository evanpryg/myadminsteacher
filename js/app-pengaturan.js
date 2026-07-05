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

function tampilkanTabPengaturan(tab) {
    ['semester','import','export','jadwal','profil','prompt'].forEach(function(t) {
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
}

// =========================================================
// TAB 1: MANAJEMEN SEMESTER
// =========================================================
function _renderTabSemester() {
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

    const btn = document.querySelector('#modal-jadwal [onclick="simpanJadwal()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    
    console.log('[TeachMate] Simpan jadwal payload:', jadwal);

    try {
        let result;
        if (_pgEditJadwalRow) {
            result = await updateJadwal(_pgEditJadwalRow, jadwal);
        } else {
            result = await tambahJadwal(jadwal);
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
    if (!confirm(`Hapus jadwal "${label}"?`)) return;
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

function renderDmGuru() {
    const tbody = document.getElementById('dm-tbody-guru');
    if (!tbody) return;
    if (_dmGuruData.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-400 font-semibold">Belum ada data guru.</td></tr>'; return; }
    tbody.innerHTML = _dmGuruData.map(function(g, i) {
        return `<tr class="hover:bg-slate-50 group"><td class="py-2 px-3 text-slate-400">${i+1}</td><td class="py-2 px-3 font-mono font-bold text-indigo-600">${_esc(g.kode_guru || g.kode)}</td><td class="py-2 px-3 font-semibold text-slate-800">${_esc(g.nama)}</td><td class="py-2 px-3 text-slate-600">${_esc(g.mata_pelajaran || g.mapel)}</td><td class="py-2 px-3 text-center"><div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100"><button onclick="editGuruUI(${g.id},'${_esc(g.kode_guru || g.kode)}','${_esc(g.nama)}','${_esc(g.mata_pelajaran || g.mapel)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button><button onclick="hapusGuruUI(${g.id},'${_esc(g.nama)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div></td></tr>`;
    }).join('');
    lucide.createIcons();
}

function bukaModalGuru() {
    document.getElementById('modal-guru-title').textContent = 'Tambah Guru';
    document.getElementById('dm-guru-kode').value = '';
    document.getElementById('dm-guru-nama').value = '';
    document.getElementById('dm-guru-mapel').value = '';
    document.getElementById('dm-guru-edit-id').value = '';
    document.getElementById('modal-dm-guru').classList.remove('hidden');
}

function editGuruUI(id, kode, nama, mapel) {
    document.getElementById('modal-guru-title').textContent = 'Edit Guru';
    document.getElementById('dm-guru-kode').value = kode;
    document.getElementById('dm-guru-nama').value = nama;
    document.getElementById('dm-guru-mapel').value = mapel;
    document.getElementById('dm-guru-edit-id').value = id;
    document.getElementById('modal-dm-guru').classList.remove('hidden');
}

async function simpanGuru() {
    const kode = document.getElementById('dm-guru-kode')?.value?.trim();
    const nama = document.getElementById('dm-guru-nama')?.value?.trim();
    const mapel = document.getElementById('dm-guru-mapel')?.value?.trim();
    const editId = document.getElementById('dm-guru-edit-id')?.value;
    if (!kode || !nama) { alert('Kode dan Nama wajib diisi.'); return; }

    try {
        let res;
        if (editId) { res = await editGuru(editId, kode, nama, mapel); }
        else { res = await tambahGuru(kode, nama, mapel); }
        if (res && !res.success) { alert(res.message); return; }
        document.getElementById('modal-dm-guru').classList.add('hidden');
        muatDmGuru();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
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
    document.getElementById('dm-wali-nama').value = '';
    document.getElementById('dm-wali-edit-id').value = '';
    _populateKelasDropdownWali('');
    document.getElementById('modal-dm-wali').classList.remove('hidden');
}

function editWaliUI(id, kelas, nama) {
    document.getElementById('modal-wali-title').textContent = 'Edit Wali Kelas';
    document.getElementById('dm-wali-nama').value = nama;
    document.getElementById('dm-wali-edit-id').value = id;
    _populateKelasDropdownWali(kelas);
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

async function _skipJadwal(jadwalId, tanggal) {
    if (!confirm('Skip jadwal ini untuk tanggal ' + tanggal + '?')) return;
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

    let html = '';
    hariList.forEach(function(hari, idx) {
        const tglObj = new Date(monday);
        tglObj.setDate(monday.getDate() + idx);
        const tglIso = tglObj.getFullYear() + '-' + String(tglObj.getMonth()+1).padStart(2,'0') + '-' + String(tglObj.getDate()).padStart(2,'0');
        const isToday = tglObj.toDateString() === now.toDateString();
        const color = hariColors[idx];

        const jadwalHari = _jadwalAllData.filter(j => j.hari === hari);
        jadwalHari.sort((a,b) => (a.jam_mulai || '').localeCompare(b.jam_mulai || ''));

        const skippedIds = _jadwalOverrides.filter(o => o.tanggal === tglIso && o.aksi === 'skip').map(o => o.jadwalId);
        const tambahan = _jadwalOverrides.filter(o => o.tanggal === tglIso && o.aksi === 'tambah');

        html += `<div class="bg-white rounded-2xl border ${isToday ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'} shadow-sm overflow-hidden flex flex-col">
            <div class="px-4 py-3 border-b ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-50 border-slate-100'} flex items-center justify-between">
                <div>
                    <p class="font-bold text-sm">${hari}</p>
                    <p class="text-[10px] ${isToday ? 'text-indigo-200' : 'text-slate-400'}">${_fmtTglShort(tglObj)}</p>
                </div>
            </div>
            <div class="p-3 flex-1 space-y-2">`;

        const visibleJadwal = jadwalHari.filter(j => !skippedIds.includes(j.id));
        if (visibleJadwal.length === 0 && tambahan.length === 0) {
            html += `<p class="text-xs text-slate-400 text-center py-4">Tidak ada jadwal</p>`;
        } else {
            visibleJadwal.forEach(function(j) {
                html += `<div class="bg-${color}-50 border border-${color}-200 rounded-xl p-3 space-y-1 group/card relative">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-black text-${color}-600 bg-${color}-100 px-2 py-0.5 rounded-md">${j.jam_mulai || '?'} – ${j.jam_selesai || '?'}</span>
                    </div>
                    ${j.kelas ? `<p class="font-bold text-slate-800 text-xs">${_esc(j.kelas)}</p>` : ''}
                    <p class="text-[11px] text-${color}-700 font-semibold">${_esc(j.mata_pelajaran || j.mapel)}</p>
                </div>`;
            });
        }

        html += `</div></div>`;
    });

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
                            <a href="${_esc(l.url)}" target="_blank" class="font-bold text-sm block truncate hover:underline">${_esc(l.label)}</a>
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

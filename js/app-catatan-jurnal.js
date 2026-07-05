// ============================================================
// APP CATATAN SISWA & JURNAL MENGAJAR
// ============================================================

// ── CATATAN SISWA ───────────────────────────────────────────

async function initHalamanCatatanSiswa() {
    const selectKelas = document.getElementById('select-kelas-catatan');
    if (!selectKelas) return;

    // Populate kelas dropdown
    try {
        const data = await getDaftarMengajar();
        if (!data || data.length === 0) {
            selectKelas.innerHTML = '<option value="">— Belum ada kelas —</option>';
            return;
        }
        const kelasUnik = {};
        data.forEach(d => { kelasUnik[d.kelas] = true; });
        const kelasList = Object.keys(kelasUnik).sort();
        selectKelas.innerHTML = '<option value="">— Pilih Kelas —</option>' +
            kelasList.map(k => `<option value="${k}">${k}</option>`).join('');
    } catch (err) {
        console.error('Gagal memuat kelas untuk catatan:', err);
    }

    // Remove old listener and re-attach
    selectKelas.onchange = () => muatCatatanSiswa();
}

async function muatCatatanSiswa() {
    const kelas = document.getElementById('select-kelas-catatan')?.value;
    const tbody = document.getElementById('body-tabel-catatan-siswa');
    const btnSimpan = document.getElementById('btn-simpan-catatan');
    const notif = document.getElementById('notif-catatan');
    if (!kelas || !tbody) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-slate-400 font-semibold">Pilih kelas untuk menampilkan data siswa.</td></tr>';
        if (btnSimpan) { btnSimpan.disabled = true; btnSimpan.className = 'inline-flex items-center gap-2 bg-slate-200 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed'; }
        return;
    }

    tbody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-indigo-500 animate-pulse font-semibold">Memuat data siswa...</td></tr>';

    try {
        // Fetch students and existing notes in parallel
        const [siswa, catatanData] = await Promise.all([
            getSiswaByKelas(kelas),
            fetchSupabase("/rest/v1/catatan_siswa?kelas=eq." + encodeURIComponent(kelas), "GET")
        ]);

        if (!siswa || siswa.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-slate-400 font-semibold">Tidak ada siswa di kelas ini.</td></tr>';
            if (btnSimpan) { btnSimpan.disabled = true; btnSimpan.className = 'inline-flex items-center gap-2 bg-slate-200 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed'; }
            return;
        }

        // Map existing notes by siswa_id (nisn)
        // We need to get the db_id mapping
        const siswaDb = await fetchSupabase("/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas), "GET") || [];
        const idToNisn = {};
        const nisnToDbId = {};
        siswaDb.forEach(s => {
            idToNisn[s.id] = s.nisn;
            nisnToDbId[s.nisn] = s.id;
        });

        const catatanMap = {};
        if (catatanData) {
            catatanData.forEach(c => {
                const nisn = idToNisn[c.siswa_id];
                if (nisn) catatanMap[nisn] = c.catatan || '';
            });
        }

        let html = '';
        siswa.sort((a, b) => a.nama.localeCompare(b.nama));
        siswa.forEach((s, i) => {
            const catatan = catatanMap[s.id_siswa] || '';
            html += `<tr class="hover:bg-slate-50/50 transition-colors">
                <td class="py-3 px-4 text-center text-slate-400 font-bold">${i + 1}</td>
                <td class="py-3 px-4 font-semibold text-slate-700">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-black shrink-0">${s.nama.charAt(0).toUpperCase()}</div>
                        ${s.nama}
                    </div>
                </td>
                <td class="py-2 px-4">
                    <textarea data-nisn="${s.id_siswa}" rows="2"
                        placeholder="Tulis catatan untuk ${s.nama}..."
                        class="catatan-input w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition-all hover:border-indigo-200">${catatan}</textarea>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;

        // Enable save button
        if (btnSimpan) {
            btnSimpan.disabled = false;
            btnSimpan.className = 'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer';
        }
    } catch (err) {
        console.error('Gagal memuat catatan siswa:', err);
        tbody.innerHTML = '<tr><td colspan="3" class="py-10 text-center text-rose-500 font-semibold">Gagal memuat data. Coba lagi.</td></tr>';
    }
}

async function simpanCatatanSiswa() {
    const kelas = document.getElementById('select-kelas-catatan')?.value;
    const notif = document.getElementById('notif-catatan');
    const btnSimpan = document.getElementById('btn-simpan-catatan');
    if (!kelas) return;

    // Disable button during save
    if (btnSimpan) {
        btnSimpan.disabled = true;
        btnSimpan.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>Menyimpan...';
        btnSimpan.className = 'inline-flex items-center gap-2 bg-slate-200 text-slate-500 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed';
    }

    try {
        // Get db ID mapping
        const siswaDb = await fetchSupabase("/rest/v1/data_siswa?kelas=eq." + encodeURIComponent(kelas), "GET") || [];
        const nisnToDbId = {};
        siswaDb.forEach(s => { nisnToDbId[s.nisn] = s.id; });

        // Collect all textarea data
        const textareas = document.querySelectorAll('#body-tabel-catatan-siswa .catatan-input');
        const payload = [];
        textareas.forEach(ta => {
            const nisn = ta.getAttribute('data-nisn');
            const dbId = nisnToDbId[nisn];
            if (dbId) {
                payload.push({
                    siswa_id: dbId,
                    kelas: kelas,
                    catatan: ta.value.trim(),
                    updated_at: new Date().toISOString()
                });
            }
        });

        if (payload.length > 0) {
            await fetchSupabase("/rest/v1/catatan_siswa", "POST", payload, {
                "Prefer": "return=representation,resolution=merge-duplicates"
            });
        }

        // Show success notification
        if (notif) {
            notif.textContent = '✅ Catatan berhasil disimpan!';
            notif.classList.remove('hidden');
            setTimeout(() => notif.classList.add('hidden'), 3000);
        }
    } catch (err) {
        console.error('Gagal menyimpan catatan:', err);
        if (notif) {
            notif.textContent = '❌ Gagal menyimpan catatan.';
            notif.className = 'text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl transition-all';
            notif.classList.remove('hidden');
            setTimeout(() => notif.classList.add('hidden'), 3000);
        }
    }

    // Re-enable save button
    if (btnSimpan) {
        btnSimpan.disabled = false;
        btnSimpan.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i>Simpan Catatan';
        btnSimpan.className = 'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer';
        lucide.createIcons();
    }
}


// ── JURNAL MENGAJAR ─────────────────────────────────────────

async function initHalamanJurnalMengajar() {
    const selectKelas = document.getElementById('select-kelas-jurnal');
    if (!selectKelas) return;

    // Populate kelas dropdown
    try {
        const data = await getDaftarMengajar();
        if (!data || data.length === 0) {
            selectKelas.innerHTML = '<option value="">— Belum ada kelas —</option>';
            return;
        }
        const kelasUnik = {};
        data.forEach(d => { kelasUnik[d.kelas] = true; });
        const kelasList = Object.keys(kelasUnik).sort();
        selectKelas.innerHTML = '<option value="">— Pilih Kelas —</option>' +
            kelasList.map(k => `<option value="${k}">${k}</option>`).join('');
    } catch (err) {
        console.error('Gagal memuat kelas untuk jurnal:', err);
    }

    selectKelas.onchange = () => muatJurnalMengajar();
}

async function muatJurnalMengajar() {
    const kelas = document.getElementById('select-kelas-jurnal')?.value;
    const tbody = document.getElementById('body-tabel-jurnal');
    const btnSimpan = document.getElementById('btn-simpan-jurnal');
    const notif = document.getElementById('notif-jurnal');

    if (!kelas || !tbody) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-400 font-semibold">Pilih kelas untuk menampilkan jurnal mengajar.</td></tr>';
        if (btnSimpan) { btnSimpan.disabled = true; btnSimpan.className = 'inline-flex items-center gap-2 bg-slate-200 text-slate-400 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed'; }
        return;
    }

    tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-indigo-500 animate-pulse font-semibold">Memuat jurnal mengajar...</td></tr>';

    try {
        // Fetch existing journal entries
        const jurnalData = await fetchSupabase(
            "/rest/v1/jurnal_mengajar?kelas=eq." + encodeURIComponent(kelas) + "&order=pertemuan_ke.asc",
            "GET"
        ) || [];

        // Create map of existing data
        const jurnalMap = {};
        jurnalData.forEach(j => {
            jurnalMap[j.pertemuan_ke] = { tanggal: j.tanggal || '', catatan: j.catatan || '' };
        });

        // Generate 16 meeting rows (matching the TM count used elsewhere)
        const totalPertemuan = 16;
        let html = '';
        for (let i = 1; i <= totalPertemuan; i++) {
            const existing = jurnalMap[i] || { tanggal: '', catatan: '' };
            const hasData = existing.tanggal || existing.catatan;
            html += `<tr class="hover:bg-slate-50/50 transition-colors ${hasData ? '' : 'opacity-70'}">
                <td class="py-3 px-4 text-center text-slate-400 font-bold">${i}</td>
                <td class="py-3 px-4 text-center">
                    <div class="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 font-black text-xs px-3 py-1.5 rounded-lg">
                        <i data-lucide="hash" class="w-3 h-3"></i>${i}
                    </div>
                </td>
                <td class="py-2 px-4">
                    <input type="date" data-tm="${i}" value="${existing.tanggal}"
                        class="jurnal-tanggal w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all hover:border-indigo-200">
                </td>
                <td class="py-2 px-4">
                    <textarea data-tm="${i}" rows="2"
                        placeholder="Catatan materi pertemuan ke-${i}..."
                        class="jurnal-catatan w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition-all hover:border-indigo-200">${existing.catatan}</textarea>
                </td>
            </tr>`;
        }
        tbody.innerHTML = html;
        lucide.createIcons();

        // Enable save button
        if (btnSimpan) {
            btnSimpan.disabled = false;
            btnSimpan.className = 'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer';
        }
    } catch (err) {
        console.error('Gagal memuat jurnal mengajar:', err);
        tbody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-rose-500 font-semibold">Gagal memuat data. Coba lagi.</td></tr>';
    }
}

async function simpanJurnalMengajar() {
    const kelas = document.getElementById('select-kelas-jurnal')?.value;
    const notif = document.getElementById('notif-jurnal');
    const btnSimpan = document.getElementById('btn-simpan-jurnal');
    if (!kelas) return;

    // Disable button during save
    if (btnSimpan) {
        btnSimpan.disabled = true;
        btnSimpan.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>Menyimpan...';
        btnSimpan.className = 'inline-flex items-center gap-2 bg-slate-200 text-slate-500 font-bold px-4 py-2 rounded-xl text-xs cursor-not-allowed';
    }

    try {
        const tanggalInputs = document.querySelectorAll('#body-tabel-jurnal .jurnal-tanggal');
        const catatanInputs = document.querySelectorAll('#body-tabel-jurnal .jurnal-catatan');

        const payload = [];
        tanggalInputs.forEach(input => {
            const tm = parseInt(input.getAttribute('data-tm'));
            const tanggal = input.value;
            // Find matching catatan textarea
            const catatanEl = document.querySelector(`#body-tabel-jurnal textarea.jurnal-catatan[data-tm="${tm}"]`);
            const catatan = catatanEl ? catatanEl.value.trim() : '';

            // Only save entries that have at least a date or a note
            if (tanggal || catatan) {
                payload.push({
                    kelas: kelas,
                    pertemuan_ke: tm,
                    tanggal: tanggal || null,
                    catatan: catatan,
                    updated_at: new Date().toISOString()
                });
            }
        });

        if (payload.length > 0) {
            await fetchSupabase("/rest/v1/jurnal_mengajar", "POST", payload, {
                "Prefer": "return=representation,resolution=merge-duplicates"
            });
        }

        // Also clean up entries where both tanggal and catatan are empty
        // (delete rows that were previously saved but now cleared)
        const existingData = await fetchSupabase(
            "/rest/v1/jurnal_mengajar?kelas=eq." + encodeURIComponent(kelas),
            "GET"
        ) || [];
        
        const savedTMs = new Set(payload.map(p => p.pertemuan_ke));
        for (const entry of existingData) {
            if (!savedTMs.has(entry.pertemuan_ke)) {
                await fetchSupabase("/rest/v1/jurnal_mengajar?id=eq." + entry.id, "DELETE");
            }
        }

        // Show success notification
        if (notif) {
            notif.textContent = '✅ Jurnal mengajar berhasil disimpan!';
            notif.className = 'text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all';
            notif.classList.remove('hidden');
            setTimeout(() => notif.classList.add('hidden'), 3000);
        }
    } catch (err) {
        console.error('Gagal menyimpan jurnal:', err);
        if (notif) {
            notif.textContent = '❌ Gagal menyimpan jurnal mengajar.';
            notif.className = 'text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl transition-all';
            notif.classList.remove('hidden');
            setTimeout(() => notif.classList.add('hidden'), 3000);
        }
    }

    // Re-enable save button
    if (btnSimpan) {
        btnSimpan.disabled = false;
        btnSimpan.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i>Simpan Jurnal';
        btnSimpan.className = 'inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer';
        lucide.createIcons();
    }
}

async function tambahBarisJurnal() {
    const kelas = document.getElementById('select-kelas-jurnal')?.value;
    if (!kelas) return;
    
    const tbody = document.getElementById('body-tabel-jurnal');
    if (!tbody) return;
    
    const existingRows = tbody.querySelectorAll('tr');
    const nextTm = existingRows.length + 1;
    
    const newRow = document.createElement('tr');
    newRow.className = 'hover:bg-slate-50/50 transition-colors opacity-70';
    newRow.innerHTML = `
        <td class="py-3 px-4 text-center text-slate-400 font-bold">${nextTm}</td>
        <td class="py-3 px-4 text-center">
            <div class="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 font-black text-xs px-3 py-1.5 rounded-lg">
                <i data-lucide="hash" class="w-3 h-3"></i>${nextTm}
            </div>
        </td>
        <td class="py-2 px-4">
            <input type="date" data-tm="${nextTm}"
                class="jurnal-tanggal w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all hover:border-indigo-200">
        </td>
        <td class="py-2 px-4">
            <textarea data-tm="${nextTm}" rows="2"
                placeholder="Catatan materi pertemuan ke-${nextTm}..."
                class="jurnal-catatan w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition-all hover:border-indigo-200"></textarea>
        </td>
    `;
    tbody.appendChild(newRow);
    lucide.createIcons();
}

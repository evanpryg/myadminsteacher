// ============================================================
// MODUL AJAR GENERATOR - UI CONTROLLER
// Flow: Form minimal -> AI generate SEMUA isi -> simpan riwayat
// -> auto-download Word. Tanpa editor: koreksi langsung di Word.
// ============================================================

const _maState = { list: [], currentId: null };

async function initHalamanModulAjar() {
    maKembaliKeList();
    const loader = document.getElementById('ma-list-loader');
    if (loader) loader.classList.remove('hidden');
    try {
        _maState.list = (await fetchSupabase('/rest/v1/modul_ajar?select=id,title,form_data,created_at&order=created_at.desc', 'GET')) || [];
        maRenderTabel();
    } catch (e) { console.error(e); }
    if (loader) loader.classList.add('hidden');
}

function maRenderTabel() {
    const tbody = document.getElementById('ma-table-body');
    if (!tbody) return;
    if (_maState.list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-slate-400 font-semibold">Belum ada modul ajar. Klik "+ Buat Baru". (Jalankan supabase-migration-modulajar.sql jika belum.)</td></tr>';
        return;
    }
    tbody.innerHTML = _maState.list.map(m => {
        const f = m.form_data || {};
        return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="py-3 px-4 whitespace-nowrap">${lpEscape(lpFormatTanggal((m.created_at || '').slice(0, 10)))}</td>
            <td class="py-3 px-3 font-bold text-slate-700">${lpEscape(f.mapel || '-')}</td>
            <td class="py-3 px-3">${lpEscape((f.fase || '') + ' / ' + (f.kelas || '-'))}</td>
            <td class="py-3 px-3 font-semibold text-slate-700">${lpEscape(f.topik || '-')}<p class="text-[10px] text-slate-400 font-medium">${lpEscape(f.jumlah_pertemuan || 2)} pertemuan · ${lpEscape(f.model || '')}</p></td>
            <td class="py-3 px-3">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="maDownload(${m.id}, this)" title="Download Word" class="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><i data-lucide="file-down" class="w-4 h-4"></i></button>
                    <button onclick="maEdit(${m.id})" title="Edit form & generate ulang" class="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
                    <button onclick="maHapus(${m.id})" title="Hapus" class="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}

function maKembaliKeList() {
    document.getElementById('ma-list-view')?.classList.remove('hidden');
    document.getElementById('ma-form-view')?.classList.add('hidden');
    document.getElementById('ma-loading-view')?.classList.add('hidden');
}

async function maBukaForm(prefill) {
    _maState.currentId = (prefill && prefill.id) || null;
    const f = (prefill && prefill.form_data) || {};
    document.getElementById('ma-list-view').classList.add('hidden');
    document.getElementById('ma-loading-view').classList.add('hidden');
    document.getElementById('ma-form-view').classList.remove('hidden');
    document.getElementById('ma-form-title').innerText = _maState.currentId ? 'Edit & Generate Ulang' : 'Buat Modul Ajar';

    // Datalist mapel/kelas + model pembelajaran
    try {
        const [mengajar, models] = await Promise.all([getDaftarMengajar().catch(() => []), lpGetLearningModels().catch(() => [])]);
        const dlM = document.getElementById('ma-dl-mapel');
        const dlK = document.getElementById('ma-dl-kelas');
        const dlMo = document.getElementById('ma-dl-model');
        if (dlM) dlM.innerHTML = [...new Set(mengajar.map(x => x.mata_pelajaran).filter(Boolean))].map(v => `<option value="${lpEscape(v)}">`).join('');
        if (dlK) dlK.innerHTML = [...new Set(mengajar.map(x => x.kelas).filter(Boolean))].map(v => `<option value="${lpEscape(v)}">`).join('');
        if (dlMo) dlMo.innerHTML = models.map(m => `<option value="${lpEscape(m.name)}">`).join('');
    } catch (e) { /* opsional */ }

    const set = (id, v, dflt) => { const el = document.getElementById(id); if (el) el.value = (v !== undefined && v !== null && v !== '') ? v : (dflt !== undefined ? dflt : ''); };
    set('ma-f-mapel', f.mapel);
    set('ma-f-kelas', f.kelas);
    set('ma-f-fase', f.fase, 'F');
    set('lp-f-ma-ma_topik', f.topik);
    set('ma-f-jumlah', f.jumlah_pertemuan, 2);
    set('ma-f-jp', f.jp, 2);
    set('ma-f-menit', f.menit, 40);
    set('ma-f-model', f.model, 'Problem Based Learning berbasis Deep Learning');
    set('lp-f-ma-ma_cp', f.cp);
    set('ma-f-catatan', f.catatan);

    // Typeahead bank (reuse infrastruktur lesson plan)
    lpInitBankTypeahead({ section: 'ma', id: 'ma_topik', bank: 'MATERI' });
    lpInitBankTypeahead({ section: 'ma', id: 'ma_cp', bank: 'CP' });
    lucide.createIcons();
}

function maCollectForm() {
    const gv = id => (document.getElementById(id)?.value || '').trim();
    const form = {
        mapel: gv('ma-f-mapel'), kelas: gv('ma-f-kelas'), fase: gv('ma-f-fase') || 'F',
        topik: gv('lp-f-ma-ma_topik'),
        jumlah_pertemuan: parseInt(gv('ma-f-jumlah'), 10) || 2,
        jp: parseInt(gv('ma-f-jp'), 10) || 2,
        menit: parseInt(gv('ma-f-menit'), 10) || 40,
        model: gv('ma-f-model'), cp: gv('lp-f-ma-ma_cp'), catatan: gv('ma-f-catatan')
    };
    const wajib = [['mapel', form.mapel], ['kelas', form.kelas], ['topik', form.topik], ['model pembelajaran', form.model]];
    const kosong = wajib.filter(([, v]) => !v).map(([k]) => k);
    if (kosong.length) { alert('Lengkapi dulu: ' + kosong.join(', ')); return null; }
    return form;
}

async function maGenerateSekarang() {
    const form = maCollectForm();
    if (!form) return;

    document.getElementById('ma-form-view').classList.add('hidden');
    document.getElementById('ma-loading-view').classList.remove('hidden');

    // Simpan topik/CP baru ke bank (non-blocking utk kegagalan)
    try {
        if (form.topik) await lpSimpanKeBank('MATERI', form.mapel, form.fase, form.topik);
        if (form.cp) await lpSimpanKeBank('CP', form.mapel, form.fase, form.cp);
    } catch (e) { console.warn(e); }

    try {
        const aiData = await maGenerateAiData(form);
        const payload = {
            title: [form.mapel, form.kelas, form.topik].filter(Boolean).join(' - '),
            form_data: form, ai_data: aiData
        };
        let saved;
        if (_maState.currentId) {
            saved = (await fetchSupabase('/rest/v1/modul_ajar?id=eq.' + _maState.currentId, 'PATCH', payload)) || [];
        } else {
            saved = (await fetchSupabase('/rest/v1/modul_ajar', 'POST', payload)) || [];
        }
        const row = saved[0];
        if (!row) throw new Error('Gagal menyimpan ke database. Sudah menjalankan supabase-migration-modulajar.sql?\n' + (_lastSupabaseError || ''));
        await maExportDocx(row);
        await initHalamanModulAjar();
    } catch (err) {
        console.error(err);
        alert('Gagal generate modul ajar:\n' + (err.message || err));
        document.getElementById('ma-loading-view').classList.add('hidden');
        document.getElementById('ma-form-view').classList.remove('hidden');
    }
}

async function maDownload(id, btn) {
    if (btn) btn.classList.add('animate-pulse');
    try {
        const rows = await fetchSupabase('/rest/v1/modul_ajar?id=eq.' + id + '&limit=1', 'GET');
        if (!rows || !rows[0]) throw new Error('Modul ajar tidak ditemukan.');
        await maExportDocx(rows[0]);
    } catch (err) {
        alert('Gagal membuat Word:\n' + (err.message || err));
    } finally {
        if (btn) btn.classList.remove('animate-pulse');
    }
}

async function maEdit(id) {
    const rows = await fetchSupabase('/rest/v1/modul_ajar?id=eq.' + id + '&limit=1', 'GET');
    if (!rows || !rows[0]) return;
    await maBukaForm(rows[0]);
}

async function maHapus(id) {
    if (!confirm('Hapus modul ajar ini? Tindakan tidak dapat dibatalkan.')) return;
    await fetchSupabase('/rest/v1/modul_ajar?id=eq.' + id, 'DELETE');
    await initHalamanModulAjar();
}

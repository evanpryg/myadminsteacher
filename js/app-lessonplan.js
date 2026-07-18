// ============================================================
// LESSON PLAN GENERATOR - UI CONTROLLER
// Flow: Form (registry-driven) -> Generate AI -> Review/Edit -> Simpan -> Export DOCX
// ============================================================

const _lpState = {
    currentId: null,        // id lesson plan yang sedang diedit (null = baru)
    aiData: null,           // hasil AI (setelah validasi / dari DB)
    modelSlug: null,
    models: [],
    templates: [],
    list: []
};

// ============================================================
// INIT + LIST VIEW
// ============================================================
async function initHalamanLessonPlan() {
    const loader = document.getElementById('lp-list-loader');
    if (loader) loader.classList.remove('hidden');
    try {
        const [models, templates, list] = await Promise.all([
            lpGetLearningModels(), lpGetTemplates(), lpGetLessonPlans()
        ]);
        _lpState.models = models;
        _lpState.templates = templates;
        _lpState.list = list;
        renderTabelLessonPlan(list);
        if (models.length === 0 || templates.length === 0) {
            alert('Tabel lesson plan belum ada di database.\nJalankan "supabase-migration-lessonplan.sql" di Supabase SQL Editor terlebih dahulu.');
        }
    } catch (err) {
        console.error(err);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
    kembaliKeListLessonPlan();
}

function renderTabelLessonPlan(list) {
    const tbody = document.getElementById('lp-table-body');
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-12 text-center text-slate-400 font-semibold">Belum ada Lesson Plan yang dibuat. Klik "+ Buat Baru".</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(lp => {
        const idn = (lp.form_data || {}).identity || {};
        const cur = (lp.form_data || {}).curriculum || {};
        const ctx = (lp.form_data || {}).ai_context || {};
        const model = _lpState.models.find(m => m.slug === lp.learning_model_slug);
        const badge = lp.status === 'final'
            ? '<span class="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">Final</span>'
            : '<span class="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase">Draft</span>';
        return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="py-3 px-4 whitespace-nowrap">${lpEscape(lpFormatTanggal(idn.date) || '-')}</td>
            <td class="py-3 px-3 font-bold text-slate-700">${lpEscape(idn.subject || '-')}</td>
            <td class="py-3 px-3">${lpEscape(idn.grade || '-')}</td>
            <td class="py-3 px-3">
                <p class="font-semibold text-slate-700">${lpEscape(cur.learning_topic || '-')}</p>
                <p class="text-[10px] text-slate-400">${lpEscape(model ? model.name : (lp.learning_model_slug || ''))}</p>
            </td>
            <td class="py-3 px-3">${lpEscape(ctx.language || '-')}</td>
            <td class="py-3 px-3 text-center">${badge}</td>
            <td class="py-3 px-3">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="lpEditLessonPlan(${lp.id})" title="Edit" class="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button onclick="lpBukaDuplikat(${lp.id})" title="Duplikat ke kelas lain" class="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><i data-lucide="copy" class="w-4 h-4"></i></button>
                    <button onclick="lpDownloadPdf(${lp.id}, this)" title="Download PDF" class="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><i data-lucide="file-text" class="w-4 h-4"></i></button>
                    <button onclick="lpDownloadDocx(${lp.id}, this)" title="Download Word" class="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><i data-lucide="file-down" class="w-4 h-4"></i></button>
                    <button onclick="lpHapusLessonPlan(${lp.id})" title="Hapus" class="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}

function kembaliKeListLessonPlan() {
    const listView = document.getElementById('lp-list-view');
    const wizard = document.getElementById('lp-wizard-view');
    if (listView) listView.classList.remove('hidden');
    if (wizard) wizard.classList.add('hidden');
}

// ============================================================
// WIZARD - STEP HANDLING
// ============================================================
function lpGoToStep(n) {
    [1, 2, 3].forEach(i => {
        const panel = document.getElementById('lp-step-' + i);
        const ind = document.getElementById('step-ind-' + i);
        if (panel) panel.classList.toggle('hidden', i !== n);
        if (ind) {
            ind.classList.toggle('bg-indigo-600', i <= n);
            ind.classList.toggle('text-white', i <= n);
            ind.classList.toggle('bg-slate-100', i > n);
            ind.classList.toggle('text-slate-400', i > n);
        }
    });
    lucide.createIcons();
}

async function bukaWizardLessonPlan(prefill) {
    _lpState.currentId = null;
    _lpState.aiData = null;
    document.getElementById('lp-list-view').classList.add('hidden');
    document.getElementById('lp-wizard-view').classList.remove('hidden');
    document.getElementById('lp-wizard-title').innerText = 'Buat Lesson Plan';
    await lpRenderForm(prefill || {});
    lpGoToStep(1);
}

// ============================================================
// WIZARD STEP 1 - FORM DINAMIS DARI REGISTRY
// ============================================================
async function lpRenderForm(prefill) {
    const container = document.getElementById('lp-form-fields');
    if (!container) return;

    // Prefill dari pengaturan (nama guru, kepala, tahun ajaran)
    const settingKeys = LP_FIELD_REGISTRY.filter(f => f.settingKey).map(f => f.settingKey);
    const settings = await getMultipleSettings(settingKeys);

    // Datalist mapel/kelas dari data kelas mengajar
    let mengajar = [];
    try { mengajar = (await getDaftarMengajar()) || []; } catch (e) { mengajar = []; }
    const datalists = {
        mapel: [...new Set(mengajar.map(m => m.mata_pelajaran).filter(Boolean))],
        kelas: [...new Set(mengajar.map(m => m.kelas).filter(Boolean))]
    };

    const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400';
    const labelHtml = f => `<label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">${lpEscape(f.label)}${f.required ? ' <span class="text-rose-500">*</span>' : ''}</label>`;

    const fieldHtml = (f) => {
        const id = `lp-f-${f.section}-${f.id}`;
        const val = (prefill[f.section] || {})[f.id] !== undefined
            ? (prefill[f.section] || {})[f.id]
            : (f.settingKey ? settings[f.settingKey] : (f.default !== undefined ? f.default : ''));
        let input = '';
        if (f.type === 'text' && f.bank) {
            // Typeahead bank (mis. MATERI) pada input teks
            input = `<div class="relative">
                <input type="text" id="${id}" value="${lpEscape(String(val))}" data-bank="${f.bank}" autocomplete="off" placeholder="Ketik untuk mencari di bank ${f.bank}, atau tulis baru" class="${inputCls}">
                <div id="lp-bank-dd-${f.id}" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-40 max-h-64 overflow-y-auto"></div>
            </div>`;
        } else if (f.type === 'text' || f.type === 'number' || f.type === 'date') {
            const listAttr = f.datalist ? ` list="lp-dl-${f.datalist}"` : '';
            input = `<input type="${f.type}" id="${id}" value="${lpEscape(String(val))}"${listAttr} class="${inputCls}">`;
        } else if (f.type === 'textarea') {
            if (f.bank) {
                // Typeahead bank CP/TP: ketik utk memfilter, pilih dari dropdown
                input = `<div class="relative">
                    <textarea id="${id}" rows="${f.rows || 3}" data-bank="${f.bank}" autocomplete="off" placeholder="Ketik untuk mencari di bank ${f.bank}, atau tulis baru (otomatis tersimpan ke bank). Kosongkan jika ingin diisi AI." class="${inputCls}">${lpEscape(String(val))}</textarea>
                    <div id="lp-bank-dd-${f.id}" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-40 max-h-64 overflow-y-auto"></div>
                </div>`;
            } else {
                input = `<textarea id="${id}" rows="${f.rows || 3}" class="${inputCls}">${lpEscape(String(val))}</textarea>`;
            }
        } else if (f.type === 'select') {
            input = `<select id="${id}" class="${inputCls} bg-white">` +
                (f.options || []).map(o => `<option value="${lpEscape(o)}"${o === val ? ' selected' : ''}>${lpEscape(o)}</option>`).join('') +
                '</select>';
        } else if (f.type === 'model-select') {
            input = `<select id="${id}" class="${inputCls} bg-white">` +
                _lpState.models.map(m => `<option value="${lpEscape(m.slug)}"${m.slug === val ? ' selected' : ''}>${lpEscape(m.name)}</option>`).join('') +
                '</select>' +
                `<p id="lp-syntax-preview" class="text-[10px] text-slate-400 mt-1.5 leading-relaxed"></p>`;
        } else if (f.type === 'checkbox-group') {
            const grp = LP_CHECKBOX_GROUPS[f.group];
            const selected = Array.isArray(val) ? val : [];
            input = '<div class="flex flex-wrap gap-x-4 gap-y-2 pt-1">' +
                grp.options.map(o =>
                    `<label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                        <input type="checkbox" name="${id}" value="${o.key}"${selected.indexOf(o.key) !== -1 ? ' checked' : ''} class="w-4 h-4 rounded text-indigo-600">${lpEscape(o.label)}
                    </label>`).join('') +
                (grp.hasOthers ? `<label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600">Others: <input type="text" id="lp-f-${f.section}-${f.group}_others" value="${lpEscape(String((prefill[f.section] || {})[f.group + '_others'] || ''))}" class="border border-slate-200 rounded-lg px-2 py-1 text-xs w-36"></label>` : '') +
                '</div>';
        }
        const span = f.type === 'checkbox-group' ? 'md:col-span-3' : (f.type === 'textarea' ? 'md:col-span-3' : (f.width === 'sm' ? '' : ''));
        return `<div class="${span}">${labelHtml(f)}${input}</div>`;
    };

    container.innerHTML =
        `<datalist id="lp-dl-mapel">${datalists.mapel.map(v => `<option value="${lpEscape(v)}">`).join('')}</datalist>` +
        `<datalist id="lp-dl-kelas">${datalists.kelas.map(v => `<option value="${lpEscape(v)}">`).join('')}</datalist>` +
        LP_SECTIONS.map(sec => {
            const fields = lpFieldsBySection(sec.id);
            if (fields.length === 0) return '';
            return `<div class="border border-slate-100 rounded-2xl p-4 space-y-3">
                <p class="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="${sec.icon}" class="w-3.5 h-3.5"></i>${lpEscape(sec.label)}</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">${fields.map(fieldHtml).join('')}</div>
            </div>`;
        }).join('');

    // Default tanggal = hari ini
    const dateEl = document.getElementById('lp-f-identity-date');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);

    // Preview syntax saat model berubah
    const modelEl = document.getElementById('lp-f-pedagogy-teaching_model');
    if (modelEl) {
        modelEl.addEventListener('change', lpTampilkanSyntaxPreview);
        lpTampilkanSyntaxPreview();
    }

    // Typeahead bank CP/TP
    LP_FIELD_REGISTRY.filter(f => f.bank).forEach(f => lpInitBankTypeahead(f));
    lucide.createIcons();
}

// ============================================================
// BANK CP/TP - TYPEAHEAD (semi text dropdown)
// Ketik di textarea -> dropdown menampilkan entri bank yang cocok.
// Klik item utk memakai; ikon x utk menghapus dari bank.
// ============================================================
function lpInitBankTypeahead(field) {
    const ta = document.getElementById(`lp-f-${field.section}-${field.id}`);
    const dd = document.getElementById(`lp-bank-dd-${field.id}`);
    if (!ta || !dd) return;

    const render = async () => {
        let items = [];
        try { items = await lpGetBankItems(field.bank); } catch (e) { items = []; }
        const subject = ((document.getElementById('lp-f-identity-subject') || {}).value || '').trim().toLowerCase();
        const q = ta.value.trim().toLowerCase();

        // Urutkan: mapel yang sama dulu; filter berdasarkan teks yang diketik
        let filtered = items.filter(i => !q || i.content.toLowerCase().includes(q) || (i.subject || '').toLowerCase().includes(q));
        filtered.sort((a, b) => {
            const am = (a.subject || '').toLowerCase() === subject ? 0 : 1;
            const bm = (b.subject || '').toLowerCase() === subject ? 0 : 1;
            return am - bm;
        });
        filtered = filtered.slice(0, 8);

        if (filtered.length === 0) { dd.classList.add('hidden'); return; }
        dd.innerHTML = filtered.map(i => `
            <div class="flex items-start gap-2 px-3 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 group/bi" data-bank-id="${i.id}">
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-black text-indigo-500 uppercase">${lpEscape(i.subject || 'Umum')}${i.phase ? ' · Fase ' + lpEscape(i.phase) : ''}</p>
                    <p class="text-xs text-slate-600 font-medium leading-snug">${lpEscape(i.content.length > 160 ? i.content.slice(0, 160) + '…' : i.content)}</p>
                </div>
                <button data-bank-del="${i.id}" title="Hapus dari bank" class="shrink-0 p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover/bi:opacity-100"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
            </div>`).join('');
        dd.classList.remove('hidden');
        lucide.createIcons();

        dd.querySelectorAll('[data-bank-id]').forEach(row => {
            row.addEventListener('mousedown', async (ev) => {
                const delBtn = ev.target.closest('[data-bank-del]');
                ev.preventDefault();
                if (delBtn) {
                    ev.stopPropagation();
                    const id = parseInt(delBtn.getAttribute('data-bank-del'), 10);
                    if (confirm('Hapus entri ini dari bank ' + field.bank + '?')) {
                        await lpHapusBankItem(field.bank, id);
                        render();
                    }
                    return;
                }
                const item = (await lpGetBankItems(field.bank)).find(x => x.id === parseInt(row.getAttribute('data-bank-id'), 10));
                if (item) { ta.value = item.content; }
                dd.classList.add('hidden');
            });
        });
    };

    let t = null;
    ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 200); });
    ta.addEventListener('focus', render);
    ta.addEventListener('blur', () => setTimeout(() => dd.classList.add('hidden'), 200));
}

function lpTampilkanSyntaxPreview() {
    const el = document.getElementById('lp-f-pedagogy-teaching_model');
    const preview = document.getElementById('lp-syntax-preview');
    if (!el || !preview) return;
    const model = _lpState.models.find(m => m.slug === el.value);
    preview.innerHTML = model
        ? '<b>Sintaks:</b> ' + model.syntax.map(s => lpEscape(s.label)).join(' → ')
        : '';
}

function lpCollectFormData() {
    const formData = {};
    const missing = [];
    LP_FIELD_REGISTRY.filter(f => f.source === 'static' || f.source === 'context').forEach(f => {
        if (!formData[f.section]) formData[f.section] = {};
        const id = `lp-f-${f.section}-${f.id}`;
        let val;
        if (f.type === 'checkbox-group') {
            val = Array.from(document.querySelectorAll(`input[name="${id}"]:checked`)).map(cb => cb.value);
            const othersEl = document.getElementById(`lp-f-${f.section}-${f.group}_others`);
            if (othersEl) formData[f.section][f.group + '_others'] = othersEl.value.trim();
        } else {
            const el = document.getElementById(id);
            val = el ? el.value.trim() : '';
            if (f.type === 'number') val = val === '' ? '' : parseInt(val, 10);
        }
        if (f.required && (val === '' || val === undefined || val === null)) missing.push(f.label);
        formData[f.section][f.id] = val;
    });
    if (missing.length > 0) {
        alert('Lengkapi field wajib berikut:\n- ' + missing.join('\n- '));
        return null;
    }
    return formData;
}

// ============================================================
// WIZARD STEP 2 - GENERATE AI
// ============================================================
async function generateLessonPlanAIStart() {
    const formData = lpCollectFormData();
    if (!formData) return;

    const modelSlug = formData.pedagogy.teaching_model;
    const model = _lpState.models.find(m => m.slug === modelSlug);
    if (!model) { alert('Model pembelajaran tidak ditemukan.'); return; }

    _lpState.formData = formData;
    _lpState.modelSlug = modelSlug;
    lpGoToStep(2);

    // Simpan CP/TP yang diisi guru ke bank (tidak menggagalkan generate jika error)
    try {
        const subject = (formData.identity || {}).subject || '';
        const phase = (formData.identity || {}).phase || '';
        for (const f of LP_FIELD_REGISTRY.filter(x => x.bank)) {
            const val = ((formData[f.section] || {})[f.id] || '').toString();
            if (val.trim()) await lpSimpanKeBank(f.bank, subject, phase, val);
        }
    } catch (e) { console.warn('Gagal menyimpan ke bank CP/TP:', e); }

    try {
        _lpState.aiData = await lpGenerateAiData(formData, model);
        lpRenderEditor(_lpState.aiData);
        lpGoToStep(3);
    } catch (err) {
        console.error(err);
        alert('Gagal generate AI:\n' + (err.message || err));
        lpGoToStep(1);
    }
}

// ============================================================
// WIZARD STEP 3 - EDITOR REVIEW (guru punya kontrol penuh)
// ============================================================
function lpRenderEditor(aiData) {
    const container = document.getElementById('lp-editor-cards');
    if (!container) return;
    const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400';

    const cardHtml = (f) => {
        if (f.type === 'activities') {
            const rows = (aiData.main_activities || []).map((a, i) => `
                <div class="border border-slate-100 rounded-xl p-3 space-y-2">
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <p class="text-xs font-black text-slate-700">${i + 1}. ${lpEscape(a.syntax_label)}</p>
                        <label class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">Durasi
                            <input type="number" id="lp-e-act-time-${i}" value="${a.time_minutes}" min="1" class="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700">
                            <span>menit</span>
                        </label>
                    </div>
                    <textarea id="lp-e-act-${i}" rows="4" class="${inputCls} text-xs">${lpEscape(a.activity)}</textarea>
                </div>`).join('');
            return `<div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <p class="text-xs font-black text-indigo-600 uppercase tracking-wider">Main Activities <span class="text-slate-400 normal-case font-semibold">(sintaks mengikuti model pembelajaran)</span></p>
                ${rows}
            </div>`;
        }
        if (f.type === 'number') {
            return `<div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">${lpEscape(f.label)}</label>
                <input type="number" id="lp-e-${f.id}" value="${aiData[f.id] || 10}" min="1" class="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold">
            </div>`;
        }
        if (f.type === 'checkbox-group') {
            const grp = LP_CHECKBOX_GROUPS[f.group];
            const selected = Array.isArray(aiData[f.id]) ? aiData[f.id] : [];
            return `<div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">${lpEscape(f.label)} <span class="text-indigo-400 normal-case font-semibold">(saran AI — sesuaikan bila perlu)</span></label>
                <div class="flex flex-wrap gap-x-4 gap-y-2">` +
                grp.options.map(o =>
                    `<label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                        <input type="checkbox" name="lp-e-grp-${f.id}" value="${o.key}"${selected.indexOf(o.key) !== -1 ? ' checked' : ''} class="w-4 h-4 rounded text-indigo-600">${lpEscape(o.label)}
                    </label>`).join('') +
                `</div></div>`;
        }
        return `<div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">${lpEscape(f.label)}</label>
            <textarea id="lp-e-${f.id}" rows="3" class="${inputCls} text-xs">${lpEscape(aiData[f.id] || '')}</textarea>
        </div>`;
    };

    // Kartu utk field statis yang dikosongkan guru & diisi AI (CP/TP/Materi)
    const fallbackCards = LP_FIELD_REGISTRY
        .filter(f => f.aiFallback && (aiData[f.id] || '').toString().trim()
            && !(((_lpState.formData || {})[f.section] || {})[f.id] || '').toString().trim())
        .map(f => `<div class="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm">
            <label class="text-[10px] font-black text-indigo-500 uppercase tracking-wider block mb-1">${lpEscape(f.label.replace(/ \(opsional[^)]*\)/i, ''))} <span class="bg-indigo-50 text-indigo-600 normal-case font-bold px-1.5 py-0.5 rounded-md">Diisi AI</span></label>
            <textarea id="lp-e-${f.id}" rows="${f.type === 'text' ? 2 : 3}" class="${inputCls} text-xs">${lpEscape(aiData[f.id])}</textarea>
        </div>`).join('');

    container.innerHTML =
        `<div class="flex justify-end">
            <button onclick="lpRegenerateAI()" class="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-xl transition-colors">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Generate Ulang AI
            </button>
        </div>` +
        fallbackCards +
        lpFieldsBySource('ai').map(cardHtml).join('');
    lucide.createIcons();
}

function lpCollectAiData() {
    const aiData = {};
    lpFieldsBySource('ai').forEach(f => {
        if (f.type === 'activities') {
            aiData.main_activities = (_lpState.aiData.main_activities || []).map((a, i) => ({
                syntax_key: a.syntax_key,
                syntax_label: a.syntax_label,
                time_minutes: parseInt((document.getElementById(`lp-e-act-time-${i}`) || {}).value, 10) || a.time_minutes,
                activity: ((document.getElementById(`lp-e-act-${i}`) || {}).value || '').trim()
            }));
        } else if (f.type === 'checkbox-group') {
            aiData[f.id] = Array.from(document.querySelectorAll(`input[name="lp-e-grp-${f.id}"]:checked`)).map(cb => cb.value);
        } else {
            const el = document.getElementById(`lp-e-${f.id}`);
            aiData[f.id] = f.type === 'number'
                ? (parseInt(el && el.value, 10) || 10)
                : ((el && el.value) || '').trim();
        }
    });
    // Field aiFallback yang tampil sebagai kartu "Diisi AI"
    LP_FIELD_REGISTRY.filter(f => f.aiFallback).forEach(f => {
        const el = document.getElementById(`lp-e-${f.id}`);
        if (el) aiData[f.id] = el.value.trim();
        else if (_lpState.aiData && _lpState.aiData[f.id]) aiData[f.id] = _lpState.aiData[f.id];
    });
    return aiData;
}

async function lpRegenerateAI() {
    if (!confirm('Generate ulang akan menimpa seluruh isi editor dengan hasil AI baru. Lanjutkan?')) return;
    const model = _lpState.models.find(m => m.slug === _lpState.modelSlug);
    lpGoToStep(2);
    try {
        _lpState.aiData = await lpGenerateAiData(_lpState.formData, model);
        lpRenderEditor(_lpState.aiData);
    } catch (err) {
        alert('Gagal generate AI:\n' + (err.message || err));
    }
    lpGoToStep(3);
}

// ============================================================
// SIMPAN + EXPORT
// ============================================================
// danDownload: 'pdf' | 'docx' | undefined
async function simpanLessonPlanSekarang(danDownload) {
    const aiData = lpCollectAiData();
    _lpState.aiData = aiData;

    // Checkbox saran AI (sudah direview guru) -> masuk ke form_data.pedagogy
    // agar flatten DOCX & fitur duplikat tetap bekerja tanpa perubahan.
    _lpState.formData.pedagogy = _lpState.formData.pedagogy || {};
    lpFieldsBySource('ai').filter(f => f.type === 'checkbox-group').forEach(f => {
        if (Array.isArray(aiData[f.id])) _lpState.formData.pedagogy[f.id] = aiData[f.id];
    });

    const isFinal = document.getElementById('lp-save-status');
    const idn = _lpState.formData.identity || {};
    const cur = _lpState.formData.curriculum || {};

    const payload = {
        title: [idn.subject, idn.grade, cur.learning_topic].filter(Boolean).join(' - '),
        status: (isFinal && isFinal.checked) ? 'final' : 'draft',
        template_id: (_lpState.templates[0] || {}).id || null,
        learning_model_slug: _lpState.modelSlug,
        form_data: _lpState.formData,
        ai_data: aiData
    };

    let saved;
    if (_lpState.currentId) {
        saved = await lpUpdateLessonPlan(_lpState.currentId, payload);
    } else {
        saved = await lpCreateLessonPlan(payload);
    }
    if (!saved) { alert('Gagal menyimpan lesson plan.\n' + (_lastSupabaseError || '')); return; }

    if (danDownload) {
        try {
            if (danDownload === 'pdf') await lpExportPdf(saved);
            else await lpExportDocx(saved);
        } catch (err) {
            alert('Tersimpan, tapi gagal membuat file:\n' + (err.message || err));
        }
    }
    await initHalamanLessonPlan();
}

async function lpDownloadPdf(id, btn) {
    if (btn) btn.classList.add('animate-pulse');
    try {
        const lp = await lpGetLessonPlan(id);
        if (!lp) throw new Error('Lesson plan tidak ditemukan.');
        await lpExportPdf(lp);
    } catch (err) {
        console.error(err);
        alert('Gagal membuat PDF:\n' + (err.message || err));
    } finally {
        if (btn) btn.classList.remove('animate-pulse');
    }
}

async function lpDownloadDocx(id, btn) {
    if (btn) btn.classList.add('animate-pulse');
    try {
        const lp = await lpGetLessonPlan(id);
        if (!lp) throw new Error('Lesson plan tidak ditemukan.');
        await lpExportDocx(lp);
    } catch (err) {
        console.error(err);
        alert('Gagal membuat file Word:\n' + (err.message || err));
    } finally {
        if (btn) btn.classList.remove('animate-pulse');
    }
}

async function lpEditLessonPlan(id) {
    const lp = await lpGetLessonPlan(id);
    if (!lp) { alert('Lesson plan tidak ditemukan.'); return; }
    _lpState.currentId = lp.id;
    _lpState.formData = lp.form_data || {};
    _lpState.aiData = lp.ai_data || null;
    _lpState.modelSlug = lp.learning_model_slug;

    document.getElementById('lp-list-view').classList.add('hidden');
    document.getElementById('lp-wizard-view').classList.remove('hidden');
    document.getElementById('lp-wizard-title').innerText = 'Edit Lesson Plan';
    await lpRenderForm(lp.form_data || {});

    if (lp.ai_data && lp.ai_data.main_activities) {
        lpRenderEditor(lp.ai_data);
        const cb = document.getElementById('lp-save-status');
        if (cb) cb.checked = lp.status === 'final';
        lpGoToStep(3);
    } else {
        lpGoToStep(1);
    }
}

// Dari step 3 kembali ke step 1 untuk ubah form
function lpKembaliKeForm() {
    lpGoToStep(1);
}

async function lpHapusLessonPlan(id) {
    if (!confirm('Hapus lesson plan ini? Tindakan tidak dapat dibatalkan.')) return;
    await lpDeleteLessonPlan(id);
    await initHalamanLessonPlan();
}

// ============================================================
// DUPLIKAT MASSAL KE BANYAK KELAS
// Isi (form_data + ai_data) disalin persis; hanya kelas, tanggal,
// pertemuan, dan karakteristik kelas yang berbeda tiap baris.
// ============================================================
const LP_KARAKTERISTIK_OPTS = (lpGetField('class_characteristics') || {}).options
    || ['Campuran', 'Tinggi (Cepat Paham)', 'Sedang (Standar)', 'Rendah (Butuh Bimbingan Lebih)'];

function lpBarisDuplikatHtml(pref) {
    pref = pref || {};
    const inputCls = 'border border-slate-200 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400';
    const opts = LP_KARAKTERISTIK_OPTS.map(o =>
        `<option value="${lpEscape(o)}"${o === pref.karakteristik ? ' selected' : ''}>${lpEscape(o)}</option>`).join('');
    return `<div class="dup-row grid grid-cols-[1fr_1fr_auto_1fr_auto] gap-2 items-center">
        <input type="text" class="dup-kelas ${inputCls}" list="dup-dl-kelas" placeholder="XI-B" value="${lpEscape(pref.kelas || '')}">
        <input type="date" class="dup-tanggal ${inputCls}" value="${lpEscape(pref.tanggal || '')}">
        <input type="number" min="1" class="dup-pertemuan ${inputCls} w-16 text-center" value="${lpEscape(String(pref.pertemuan || ''))}">
        <select class="dup-karakteristik ${inputCls} bg-white">${opts}</select>
        <button onclick="lpHapusBarisDuplikat(this)" class="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>`;
}

function lpTambahBarisDuplikat(pref) {
    const rows = document.getElementById('dup-rows');
    rows.insertAdjacentHTML('beforeend', lpBarisDuplikatHtml(pref));
    lucide.createIcons();
}

function lpHapusBarisDuplikat(btn) {
    const rows = document.getElementById('dup-rows');
    if (rows.querySelectorAll('.dup-row').length <= 1) { btn.closest('.dup-row').querySelectorAll('input,select').forEach(el => el.value = ''); return; }
    btn.closest('.dup-row').remove();
}

async function lpBukaDuplikat(id) {
    const lp = await lpGetLessonPlan(id);
    if (!lp) { alert('Lesson plan tidak ditemukan.'); return; }
    _lpState.dupSource = lp;

    const idn = (lp.form_data || {}).identity || {};
    const cur = (lp.form_data || {}).curriculum || {};
    const ctx = (lp.form_data || {}).ai_context || {};
    document.getElementById('dup-source-info').innerText =
        'Menduplikat: ' + [idn.subject, cur.learning_topic].filter(Boolean).join(' – ');

    // Datalist kelas dari data mengajar
    let kelasList = [];
    try {
        const mengajar = (await getDaftarMengajar()) || [];
        kelasList = [...new Set(mengajar.map(m => m.kelas).filter(Boolean))];
    } catch (e) { kelasList = []; }
    document.getElementById('dup-dl-kelas').innerHTML =
        kelasList.map(k => `<option value="${lpEscape(k)}">`).join('');

    // Prefill: satu baris per kelas mengajar (selain kelas sumber),
    // tanggal & pertemuan mengikuti sumber sebagai titik awal.
    const targets = kelasList.filter(k => k !== idn.grade);
    document.getElementById('dup-rows').innerHTML = '';
    if (targets.length > 0) {
        targets.forEach(k => lpTambahBarisDuplikat({
            kelas: k, tanggal: idn.date || '', pertemuan: idn.meeting || 1,
            karakteristik: ctx.class_characteristics || LP_KARAKTERISTIK_OPTS[0]
        }));
    } else {
        lpTambahBarisDuplikat({ tanggal: idn.date || '', pertemuan: idn.meeting || 1,
            karakteristik: ctx.class_characteristics || LP_KARAKTERISTIK_OPTS[0] });
    }

    document.getElementById('modal-duplikat-lp').classList.remove('hidden');
    lucide.createIcons();
}

async function lpProsesDuplikat() {
    const src = _lpState.dupSource;
    if (!src) return;

    const rows = Array.from(document.querySelectorAll('#dup-rows .dup-row')).map(r => ({
        kelas: (r.querySelector('.dup-kelas').value || '').trim(),
        tanggal: r.querySelector('.dup-tanggal').value,
        pertemuan: parseInt(r.querySelector('.dup-pertemuan').value, 10) || 1,
        karakteristik: r.querySelector('.dup-karakteristik').value
    })).filter(x => x.kelas);

    if (rows.length === 0) { alert('Isi minimal satu kelas tujuan.'); return; }

    const btn = document.getElementById('dup-submit-btn');
    btn.disabled = true; btn.classList.add('opacity-60');
    const cur = (src.form_data || {}).curriculum || {};
    const idnSrc = (src.form_data || {}).identity || {};

    let ok = 0, fail = 0;
    for (const row of rows) {
        // Clone dalam (deep) agar tiap salinan independen
        const formData = JSON.parse(JSON.stringify(src.form_data || {}));
        formData.identity = formData.identity || {};
        formData.ai_context = formData.ai_context || {};
        formData.identity.grade = row.kelas;
        formData.identity.date = row.tanggal;
        formData.identity.meeting = row.pertemuan;
        formData.ai_context.class_characteristics = row.karakteristik;

        const payload = {
            title: [idnSrc.subject, row.kelas, cur.learning_topic].filter(Boolean).join(' - '),
            status: src.status || 'draft',
            template_id: src.template_id,
            learning_model_slug: src.learning_model_slug,
            form_data: formData,
            ai_data: JSON.parse(JSON.stringify(src.ai_data || {}))
        };
        const saved = await lpCreateLessonPlan(payload);
        if (saved) ok++; else fail++;
    }

    btn.disabled = false; btn.classList.remove('opacity-60');
    document.getElementById('modal-duplikat-lp').classList.add('hidden');
    await initHalamanLessonPlan();
    alert('Berhasil membuat ' + ok + ' lesson plan baru.' + (fail ? ('\nGagal: ' + fail + '.') : ''));
}

// ============================================================
// JADWAL MINGGU DEPAN -> prefill wizard
// ============================================================
async function tampilkanJadwalMingguDepan() {
    const modal = document.getElementById('modal-jadwal-minggu-depan');
    const loaderEl = document.getElementById('jadwal-minggu-loader');
    const listEl = document.getElementById('jadwal-minggu-list');
    if (!modal) return;
    modal.classList.remove('hidden');
    loaderEl.classList.remove('hidden');
    listEl.classList.add('hidden');

    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const [jadwal, overrides] = await Promise.all([getDaftarJadwal(), getJadwalOverrides()]);

    // Tanggal Senin minggu depan
    const now = new Date();
    const senin = new Date(now);
    senin.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));

    const items = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(senin);
        d.setDate(senin.getDate() + i);
        const tglIso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const hari = HARI[d.getDay()];
        const skipIds = overrides.filter(o => o.tanggal === tglIso && o.aksi === 'skip').map(o => o.jadwalId);
        jadwal.filter(j => j.hari === hari && (j.kategori || 'Normal') === 'Normal'
            && !skipIds.includes(j.id) && jadwalSeriesAktif(j.id, tglIso, overrides)).forEach(j => {
            items.push({ jadwal: j, tanggal: tglIso, hari });
        });
        // Jadwal satu-kali (override 'tambah') yang berupa mengajar (punya kelas)
        overrides.filter(o => o.tanggal === tglIso && o.aksi === 'tambah' && o.kelas).forEach(o => {
            items.push({ jadwal: { jam_mulai: o.jam_mulai, jam_selesai: o.jam_selesai, kelas: o.kelas, mata_pelajaran: o.mata_pelajaran }, tanggal: tglIso, hari });
        });
    }

    loaderEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    if (items.length === 0) {
        listEl.innerHTML = '<p class="text-center text-slate-400 font-semibold text-sm py-8">Tidak ada jadwal mengajar minggu depan.</p>';
        return;
    }
    _lpState.jadwalItems = items.map(it => {
        const j = it.jadwal;
        let durasi = 90;
        if (j.jam_mulai && j.jam_selesai) {
            const [h1, m1] = j.jam_mulai.split(':').map(Number);
            const [h2, m2] = j.jam_selesai.split(':').map(Number);
            const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff > 0) durasi = diff;
        }
        return { subject: j.mata_pelajaran, grade: j.kelas, date: it.tanggal, duration: durasi, hari: it.hari, jam_mulai: j.jam_mulai, jam_selesai: j.jam_selesai };
    });
    listEl.innerHTML = _lpState.jadwalItems.map((d, i) =>
        `<div class="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap hover:border-indigo-300 transition-colors">
            <div>
                <p class="font-bold text-slate-800 text-sm">${lpEscape(d.subject || '-')} — ${lpEscape(d.grade || '-')}</p>
                <p class="text-xs text-slate-400">${lpEscape(d.hari)}, ${lpEscape(lpFormatTanggal(d.date))} · ${lpEscape(d.jam_mulai || '')}-${lpEscape(d.jam_selesai || '')} (${d.duration} menit)</p>
            </div>
            <button onclick="lpBuatDariJadwal(${i})"
                class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all">Buat LP</button>
        </div>`).join('');
}

async function lpBuatDariJadwal(index) {
    const d = (_lpState.jadwalItems || [])[index];
    if (!d) return;
    document.getElementById('modal-jadwal-minggu-depan').classList.add('hidden');
    await bukaWizardLessonPlan({ identity: { subject: d.subject, grade: d.grade, date: d.date, duration: d.duration } });
}

// ============================================================
// PENGATURAN: BANK MATERI / CP / TP (CRUD)
// ============================================================
let _bankItems = [];

async function muatPengaturanBank() {
    const loader = document.getElementById('bank-loader');
    if (loader) loader.classList.remove('hidden');
    try {
        _bankItems = await lpGetBankSemua();
        // Datalist mapel dari kelas mengajar
        try {
            const mengajar = (await getDaftarMengajar()) || [];
            const mapel = [...new Set(mengajar.map(m => m.mata_pelajaran).filter(Boolean))];
            const dl = document.getElementById('bank-dl-mapel');
            if (dl) dl.innerHTML = mapel.map(m => `<option value="${lpEscape(m)}">`).join('');
        } catch (e) { /* opsional */ }
        filterBankItems();
    } catch (err) {
        console.error(err);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

function filterBankItems() {
    const tbody = document.getElementById('bank-table-body');
    if (!tbody) return;
    const jenis = (document.getElementById('bank-filter-jenis') || {}).value || 'SEMUA';
    const cari = ((document.getElementById('bank-filter-cari') || {}).value || '').toLowerCase();

    let items = _bankItems;
    if (jenis !== 'SEMUA') items = items.filter(i => i.jenis === jenis);
    if (cari) items = items.filter(i => (i.content || '').toLowerCase().includes(cari) || (i.subject || '').toLowerCase().includes(cari));

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-slate-400 font-semibold">Belum ada data yang cocok. Klik "+ Tambah" untuk menyiapkan Materi/CP/TP awal semester.</td></tr>';
        return;
    }
    const jenisBadge = { MATERI: 'bg-sky-50 text-sky-600', CP: 'bg-violet-50 text-violet-600', TP: 'bg-emerald-50 text-emerald-600' };
    tbody.innerHTML = items.map(i => `<tr class="hover:bg-slate-50 transition-colors align-top">
        <td class="py-2.5 px-4"><span class="text-[10px] font-black px-2 py-1 rounded-lg ${jenisBadge[i.jenis] || 'bg-slate-100 text-slate-500'}">${lpEscape(i.jenis)}</span></td>
        <td class="py-2.5 px-3 font-bold text-slate-700">${lpEscape(i.subject || '-')}</td>
        <td class="py-2.5 px-3">${lpEscape(i.phase || '-')}</td>
        <td class="py-2.5 px-3 text-slate-600 leading-snug">${lpEscape(i.content.length > 220 ? i.content.slice(0, 220) + '…' : i.content)}</td>
        <td class="py-2.5 px-3">
            <div class="flex items-center justify-center gap-1">
                <button onclick="bukaModalBankItem(${i.id})" title="Edit" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                <button onclick="hapusBankItemUI(${i.id})" title="Hapus" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </td>
    </tr>`).join('');
    lucide.createIcons();
}

function bukaModalBankItem(id) {
    const item = id ? _bankItems.find(i => i.id === id) : null;
    document.getElementById('bank-modal-title').innerText = item ? 'Edit Entri' : 'Tambah Entri';
    document.getElementById('bank-edit-id').value = item ? item.id : '';
    document.getElementById('bank-item-jenis').value = item ? item.jenis : ((document.getElementById('bank-filter-jenis') || {}).value !== 'SEMUA' ? document.getElementById('bank-filter-jenis').value : 'MATERI');
    document.getElementById('bank-item-subject').value = item ? (item.subject || '') : '';
    document.getElementById('bank-item-phase').value = item ? (item.phase || 'F') : 'F';
    document.getElementById('bank-item-content').value = item ? item.content : '';
    document.getElementById('modal-bank-item').classList.remove('hidden');
    lucide.createIcons();
}

async function simpanBankItem() {
    const id = document.getElementById('bank-edit-id').value;
    const payload = {
        jenis: document.getElementById('bank-item-jenis').value,
        subject: document.getElementById('bank-item-subject').value.trim(),
        phase: document.getElementById('bank-item-phase').value,
        content: document.getElementById('bank-item-content').value.trim()
    };
    if (!payload.content) { alert('Isi tidak boleh kosong.'); return; }
    const btn = document.getElementById('bank-simpan-btn');
    btn.disabled = true;
    try {
        const saved = id ? await lpUpdateBankItem(parseInt(id, 10), payload) : await lpTambahBankItem(payload);
        if (!saved) throw new Error(_lastSupabaseError || 'Gagal menyimpan. Sudah menjalankan supabase-migration-cptp.sql?');
        document.getElementById('modal-bank-item').classList.add('hidden');
        await muatPengaturanBank();
    } catch (err) {
        alert('Gagal: ' + (err.message || err));
    } finally {
        btn.disabled = false;
    }
}

async function hapusBankItemUI(id) {
    const item = _bankItems.find(i => i.id === id);
    if (!item) return;
    if (!confirm('Hapus entri ' + item.jenis + (item.subject ? ' (' + item.subject + ')' : '') + ' ini dari bank?')) return;
    await lpHapusBankItem(item.jenis, id);
    lpBankInvalidate();
    await muatPengaturanBank();
}

// ============================================================
// PENGATURAN AI (panel "prompt" di halaman Pengaturan)
// ============================================================
async function muatPengaturanAI() {
    const s = await getMultipleSettings([LP_AI_SETTING_KEYS.apiKey, LP_AI_SETTING_KEYS.model, LP_AI_SETTING_KEYS.extra, 'GS_NAMA_KEPALA', 'GS_LP_PDF_URL', 'GS_LP_FILE_CODE']);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('pg-gemini-key', s[LP_AI_SETTING_KEYS.apiKey]);
    set('pg-lp-ai-model', s[LP_AI_SETTING_KEYS.model]);
    set('pg-lp-extra', s[LP_AI_SETTING_KEYS.extra]);
    set('pg-prompt-kepala', s.GS_NAMA_KEPALA);
    set('pg-lp-pdf-url', s.GS_LP_PDF_URL);
    set('pg-lp-file-code', s.GS_LP_FILE_CODE);
}

async function simpanPromptSettings() {
    const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const payload = {};
    payload[LP_AI_SETTING_KEYS.apiKey] = get('pg-gemini-key');
    payload[LP_AI_SETTING_KEYS.model] = get('pg-lp-ai-model');
    payload[LP_AI_SETTING_KEYS.extra] = get('pg-lp-extra');
    payload.GS_NAMA_KEPALA = get('pg-prompt-kepala');
    payload.GS_LP_PDF_URL = get('pg-lp-pdf-url');
    payload.GS_LP_FILE_CODE = get('pg-lp-file-code');
    await setMultipleSettings(payload);
    alert('Pengaturan AI tersimpan.');
}

async function resetPromptToDefault() {
    const el = document.getElementById('pg-lp-extra');
    if (el) el.value = '';
    const modelEl = document.getElementById('pg-lp-ai-model');
    if (modelEl) modelEl.value = '';
    alert('Instruksi tambahan dikosongkan. Klik "Simpan Pengaturan AI" untuk menyimpan.');
}

function togglePasswordVisibility(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
}

// ---------- util ----------
function lpEscape(str) {
    return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

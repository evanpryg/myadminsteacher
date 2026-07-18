// ============================================================
// LESSON PLAN - DATA ACCESS (Supabase REST)
// Tabel: lesson_plans, lp_templates, lp_learning_models
// (lihat supabase-migration-lessonplan.sql)
// ============================================================

// ---------- Model Pembelajaran (dikelola lewat DB) ----------
let _lpModelsCache = null;

async function lpGetLearningModels(force) {
    if (_lpModelsCache && !force) return _lpModelsCache;
    const data = await fetchSupabase('/rest/v1/lp_learning_models?is_active=eq.true&order=name.asc', 'GET');
    _lpModelsCache = data || [];
    return _lpModelsCache;
}

async function lpGetModelBySlug(slug) {
    const models = await lpGetLearningModels();
    return models.find(m => m.slug === slug) || null;
}

// ---------- Template DOCX (dikelola lewat DB) ----------
let _lpTemplatesCache = null;

async function lpGetTemplates(force) {
    if (_lpTemplatesCache && !force) return _lpTemplatesCache;
    const data = await fetchSupabase('/rest/v1/lp_templates?is_active=eq.true&order=id.asc', 'GET');
    _lpTemplatesCache = data || [];
    return _lpTemplatesCache;
}

async function lpGetTemplateById(id) {
    const templates = await lpGetTemplates();
    return templates.find(t => t.id === id) || templates[0] || null;
}

// Unduh file .docx template sebagai ArrayBuffer.
// file_url boleh relatif (di-hosting bareng web) atau URL penuh (Supabase Storage dll).
async function lpFetchTemplateFile(template) {
    const url = template.file_url;
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('Gagal mengunduh template DOCX (' + resp.status + '): ' + url);
    return await resp.arrayBuffer();
}

// ---------- Bank CP & TP (dikelola lewat DB, dipilih via typeahead) ----------
const _lpBankCache = {};

async function lpGetBankItems(jenis, force) {
    if (_lpBankCache[jenis] && !force) return _lpBankCache[jenis];
    const data = await fetchSupabase('/rest/v1/lp_cp_tp?jenis=eq.' + encodeURIComponent(jenis) + '&order=created_at.desc&limit=300', 'GET');
    _lpBankCache[jenis] = data || [];
    return _lpBankCache[jenis];
}

// Simpan entri baru ke bank (skip jika konten sama sudah ada)
async function lpSimpanKeBank(jenis, subject, phase, content) {
    content = (content || '').trim();
    if (!content) return null;
    const items = await lpGetBankItems(jenis);
    const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
    if (items.some(i => norm(i.content) === norm(content))) return null;
    const data = await fetchSupabase('/rest/v1/lp_cp_tp', 'POST', {
        jenis: jenis, subject: subject || '', phase: phase || '', content: content
    });
    if (data && data[0]) _lpBankCache[jenis] = [data[0], ...items];
    return (data && data[0]) || null;
}

async function lpHapusBankItem(jenis, id) {
    await fetchSupabase('/rest/v1/lp_cp_tp?id=eq.' + id, 'DELETE');
    if (_lpBankCache[jenis]) _lpBankCache[jenis] = _lpBankCache[jenis].filter(i => i.id !== id);
}

async function lpUpdateBankItem(id, payload) {
    const data = await fetchSupabase('/rest/v1/lp_cp_tp?id=eq.' + id, 'PATCH', payload);
    lpBankInvalidate();
    return (data && data[0]) || null;
}

async function lpTambahBankItem(payload) {
    const data = await fetchSupabase('/rest/v1/lp_cp_tp', 'POST', payload);
    lpBankInvalidate();
    return (data && data[0]) || null;
}

// Semua entri bank (untuk halaman pengaturan)
async function lpGetBankSemua() {
    return (await fetchSupabase('/rest/v1/lp_cp_tp?order=jenis.asc,subject.asc,created_at.desc&limit=1000', 'GET')) || [];
}

function lpBankInvalidate() {
    Object.keys(_lpBankCache).forEach(k => delete _lpBankCache[k]);
}

// ---------- Lesson Plans CRUD ----------
async function lpGetLessonPlans() {
    const data = await fetchSupabase('/rest/v1/lesson_plans?select=id,title,status,learning_model_slug,form_data,created_at,updated_at&order=created_at.desc', 'GET');
    return data || [];
}

async function lpGetLessonPlan(id) {
    const data = await fetchSupabase('/rest/v1/lesson_plans?id=eq.' + id + '&limit=1', 'GET');
    return (data && data[0]) || null;
}

async function lpCreateLessonPlan(payload) {
    const data = await fetchSupabase('/rest/v1/lesson_plans', 'POST', payload);
    return (data && data[0]) || null;
}

async function lpUpdateLessonPlan(id, payload) {
    const data = await fetchSupabase('/rest/v1/lesson_plans?id=eq.' + id, 'PATCH', payload);
    return (data && data[0]) || null;
}

async function lpDeleteLessonPlan(id) {
    return await fetchSupabase('/rest/v1/lesson_plans?id=eq.' + id, 'DELETE');
}

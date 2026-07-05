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

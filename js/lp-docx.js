// ============================================================
// LESSON PLAN - DOCX COMPOSITION
// ------------------------------------------------------------
// Menggabungkan form_data (static) + ai_data (hasil AI yang
// sudah direview guru) menjadi flat map placeholder, lalu
// merender template DOCX via docxtemplater (client-side).
//
// Nama placeholder FISIK diambil dari manifest template (DB),
// sehingga template baru dengan penamaan berbeda cukup
// didaftarkan lewat manifest — logic ini tidak berubah.
// ============================================================

const LP_CHECKED = '☑';   // ☑
const LP_UNCHECKED = '☐'; // ☐

const LP_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function lpFormatTanggal(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate + (isoDate.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return isoDate;
    return d.getDate() + ' ' + LP_BULAN[d.getMonth()] + ' ' + d.getFullYear();
}

// ---------- FLATTEN: nested form_data + ai_data -> { placeholder: value } ----------
function lpFlattenData(formData, aiData, manifest, teachingModelSlug) {
    const map = (manifest && manifest.map) || {};
    const out = {};

    // nilai logis -> kolom di form_data (nested per section) / ai_data (flat)
    const logicalValues = {};
    LP_FIELD_REGISTRY.forEach(f => {
        if (f.source === 'static' && f.placeholder) {
            logicalValues[f.placeholder] = ((formData || {})[f.section] || {})[f.id];
        } else if (f.source === 'ai' && f.placeholder) {
            logicalValues[f.placeholder] = (aiData || {})[f.id];
        }
    });

    // Formatting khusus
    if (logicalValues.date) logicalValues.date = lpFormatTanggal(logicalValues.date);
    if (logicalValues.duration) logicalValues.duration = logicalValues.duration + ' menit';
    logicalValues.date_today = lpFormatTanggal(new Date().toISOString().slice(0, 10));
    if (logicalValues.time_closing) logicalValues.time_closing = logicalValues.time_closing + "'";

    // Terjemahkan nama logis -> placeholder fisik via manifest
    Object.keys(map).forEach(logical => {
        const physical = map[logical];
        const v = logicalValues[logical];
        out[physical] = (v === undefined || v === null) ? '' : String(v);
    });

    // Loop main activities: [{time, syntax, activity}]
    const loopTag = ((manifest || {}).activities || {}).tag || 'main_activities';
    out[loopTag] = ((aiData || {}).main_activities || []).map(a => ({
        time: (a.time_minutes || 0) + "'",
        syntax: a.syntax_label || '',
        activity: a.activity || ''
    }));

    // Checkbox: konvensi chk_<docxKey>_<key> + <docxKey>_others
    // (docxKey = prefix placeholder di template; default = id grup)
    const ped = (formData || {}).pedagogy || {};
    Object.keys(LP_CHECKBOX_GROUPS).forEach(groupId => {
        const grp = LP_CHECKBOX_GROUPS[groupId];
        const prefix = grp.docxKey || groupId;
        const selected = Array.isArray(ped[groupId]) ? ped[groupId] : [];
        grp.options.forEach(opt => {
            out['chk_' + prefix + '_' + opt.key] = selected.indexOf(opt.key) !== -1 ? LP_CHECKED : LP_UNCHECKED;
        });
        const othersText = ped[groupId + '_others'] || '';
        out['chk_' + prefix + '_others'] = othersText ? LP_CHECKED : LP_UNCHECKED;
        out[prefix + '_others'] = othersText;
    });

    // Teaching model: single-select -> grup checkbox model di template
    const modelKeys = ['inquiry_based_learning', 'problem_based_learning', 'project_based_learning',
        'discovery_learning', 'contextual_teaching_learning', 'task_based_learning'];
    const isKnownModel = modelKeys.indexOf(teachingModelSlug) !== -1;
    modelKeys.forEach(k => {
        out['chk_model_' + k] = (k === teachingModelSlug) ? LP_CHECKED : LP_UNCHECKED;
    });
    out.chk_model_others = (!isKnownModel && teachingModelSlug) ? LP_CHECKED : LP_UNCHECKED;
    out.model_others = (!isKnownModel && teachingModelSlug) ? (ped.teaching_model_name || teachingModelSlug) : '';

    return out;
}

// ---------- RENDER: template ArrayBuffer + data -> Blob .docx ----------
function lpRenderDocx(templateBuffer, manifest, data) {
    if (typeof PizZip === 'undefined' || typeof docxtemplater === 'undefined') {
        throw new Error('Library DOCX belum termuat. Periksa koneksi internet lalu muat ulang halaman.');
    }
    const delims = (manifest && manifest.delimiters) || { start: '{{', end: '}}' };
    const zip = new PizZip(templateBuffer);
    const doc = new docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,                 // \n dari textarea -> line break di Word
        delimiters: delims,
        nullGetter: function () { return ''; }
    });
    doc.render(data);
    return doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
}

function lpDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// ---------- Orkestrasi export ----------
async function lpExportDocx(lessonPlan) {
    const template = await lpGetTemplateById(lessonPlan.template_id);
    if (!template) throw new Error('Template DOCX tidak ditemukan. Jalankan migration & cek tabel lp_templates.');

    const buffer = await lpFetchTemplateFile(template);
    const data = lpFlattenData(lessonPlan.form_data, lessonPlan.ai_data, template.manifest, lessonPlan.learning_model_slug);
    const blob = lpRenderDocx(buffer, template.manifest, data);

    const idn = (lessonPlan.form_data || {}).identity || {};
    const cur = (lessonPlan.form_data || {}).curriculum || {};
    const name = ['Lesson Plan', idn.subject, idn.grade, cur.learning_topic].filter(Boolean).join(' - ');
    lpDownloadBlob(blob, name.replace(/[\\/:*?"<>|]/g, '') + '.docx');
}

// ============================================================
// LESSON PLAN - AI GENERATION
// ------------------------------------------------------------
// AI HANYA menghasilkan JSON (tidak pernah menyentuh DOCX).
// - Prompt dirakit dari Field Registry + syntax model pembelajaran
//   (dari DB). Menambah template DOCX baru TIDAK mengubah prompt.
// - Provider dibungkus adapter (LP_AI_PROVIDERS) agar mudah
//   diganti/ditambah tanpa mengubah alur utama.
// ============================================================

const LP_AI_SETTING_KEYS = {
    apiKey: 'GS_GEMINI_KEY',
    model: 'GS_LP_AI_MODEL',
    extra: 'GS_LP_EXTRA_INSTRUCTIONS'
};

// ---------- Prompt Builder ----------
// formData : nested form_data (per section)
// model    : row lp_learning_models { name, syntax: [{key,label,hint}] }
// extra    : instruksi tambahan dari pengaturan (opsional)
function lpBuildPrompt(formData, model, extra) {
    const idn = formData.identity || {};
    const cur = formData.curriculum || {};
    const ped = formData.pedagogy || {};
    const res = formData.resources || {};
    const ctx = formData.ai_context || {};

    const language = ctx.language || 'English';
    const duration = parseInt(idn.duration, 10) || 90;

    const syntaxList = (model.syntax || []).map((s, i) =>
        `${i + 1}. key="${s.key}", label="${s.label}" — ${s.hint || ''}`).join('\n');

    // Field naratif AI diambil dari registry (source: 'ai'),
    // kecuali main_activities & time_closing yang punya struktur khusus.
    const narrativeFields = lpFieldsBySource('ai')
        .filter(f => f.type === 'textarea')
        .map(f => `- "${f.id}": (string) ${f.label}`)
        .join('\n');

    const checkedLabels = (groupId, keys) => {
        const grp = LP_CHECKBOX_GROUPS[groupId];
        if (!grp || !Array.isArray(keys)) return '-';
        return keys.map(k => (grp.options.find(o => o.key === k) || {}).label || k).join(', ') || '-';
    };

    return `You are an expert instructional designer for Indonesian senior high school (SMA) under Kurikulum Merdeka, working at an Islamic school (SMA Progresif Bumi Shalawat Sidoarjo).

Create the narrative content of a lesson plan based on this context:

## Lesson Context
- Subject: ${idn.subject || '-'}
- Class/Grade: ${idn.grade || '-'} (Fase ${idn.phase || 'F'})
- Meeting number: ${idn.meeting || 1}, total duration: ${duration} minutes
- Learning material: ${cur.learning_material || '-'}
- Learning topic: ${cur.learning_topic || '-'}
- Learning achievement (CP): ${cur.learning_achievement || '-'}
- Learning objectives: ${cur.learning_objectives || '-'}
- Cross-disciplinary connections: ${cur.cdc || '-'}
- Teaching strategies: ${checkedLabels('strategy', ped.strategy)}
- Teaching methods: ${checkedLabels('method', ped.method)}
- Graduate profile dimensions to develop: ${checkedLabels('dimensions', ped.dimensions)}
- Learning media: ${res.learning_media || '-'}
- Learning resources: ${res.resources || '-'}
- Class characteristics: ${ctx.class_characteristics || 'Campuran'}
- Teacher's special notes: ${ctx.teacher_notes || '-'}

## Teaching Model: ${model.name}
The main activities MUST follow these syntax steps, in this exact order:
${syntaxList}

## Time budget
Opening is fixed at 5 minutes. Distribute the remaining ~${duration - 5} minutes across the main activity steps and the closing (closing usually 5-10 minutes). Time values are integers (minutes).

## Output
Respond ONLY with a single valid JSON object (no markdown, no commentary), with EXACTLY these keys:
${narrativeFields}
- "main_activities": (array) one object PER syntax step above, in order: { "syntax_key": string (use the exact key), "syntax_label": string (use the exact label), "time_minutes": integer, "activity": string (concrete, numbered student & teacher activities for this step) }
- "time_closing": (integer) closing duration in minutes

Guidance for specific fields:
- "students": brief profile of the learners (count unknown — describe typical class of ${idn.grade || 'this level'}, characteristics: ${ctx.class_characteristics || 'mixed'}).
- "islamic_value": relevant Qur'anic verse/hadith or Islamic value connected to the topic, with brief explanation.
- "prior_knowledge": prerequisite competencies students should already have.
- "review": how the teacher reviews previous material.
- "alpha_zone": short fun warm-up (ice breaking/brain gym) relevant to the topic.
- "application": everyday phenomenon connecting the topic to real life.
- "closing": reflection, conclusion, follow-up plan, and closing prayer.

Write all narrative content in ${language}. Be concrete and practical (mention actual tools/media above where relevant), not generic.
${extra ? '\n## Additional instructions from the teacher\n' + extra : ''}`;
}

// ---------- Validasi output AI ----------
// Memastikan JSON sesuai kontrak sebelum dipakai (AI tidak dipercaya begitu saja).
function lpValidateAiData(json, model) {
    if (!json || typeof json !== 'object') throw new Error('Output AI bukan objek JSON.');

    const result = {};
    lpFieldsBySource('ai').filter(f => f.type === 'textarea').forEach(f => {
        const v = json[f.id];
        result[f.id] = (typeof v === 'string') ? v.trim() : '';
    });

    const syntax = model.syntax || [];
    let acts = Array.isArray(json.main_activities) ? json.main_activities : [];
    // Paksa jumlah & urutan langkah = syntax model (kontrak #9)
    result.main_activities = syntax.map((s, i) => {
        const a = acts.find(x => x && x.syntax_key === s.key) || acts[i] || {};
        return {
            syntax_key: s.key,
            syntax_label: s.label,
            time_minutes: parseInt(a.time_minutes, 10) || 10,
            activity: (typeof a.activity === 'string') ? a.activity.trim() : ''
        };
    });

    result.time_closing = parseInt(json.time_closing, 10) || 10;
    return result;
}

// ---------- Provider Adapter ----------
const LP_AI_PROVIDERS = {
    gemini: {
        defaultModel: 'gemini-2.5-flash',
        async generateJSON(prompt, apiKey, modelName) {
            const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
                + encodeURIComponent(modelName || this.defaultModel)
                + ':generateContent?key=' + encodeURIComponent(apiKey);
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        responseMimeType: 'application/json'
                    }
                })
            });
            if (!resp.ok) {
                const errText = await resp.text();
                let msg = 'Gemini API error (' + resp.status + ')';
                try { msg += ': ' + (JSON.parse(errText).error || {}).message; } catch (e) { /* raw */ }
                throw new Error(msg);
            }
            const data = await resp.json();
            const text = (((((data.candidates || [])[0] || {}).content || {}).parts || [])[0] || {}).text;
            if (!text) throw new Error('Gemini tidak mengembalikan konten. Coba lagi.');
            return JSON.parse(text);
        }
    }
};

// ---------- Orkestrasi generate (dengan 1x retry) ----------
async function lpGenerateAiData(formData, model) {
    const settings = await getMultipleSettings([
        LP_AI_SETTING_KEYS.apiKey, LP_AI_SETTING_KEYS.model, LP_AI_SETTING_KEYS.extra
    ]);
    const apiKey = settings[LP_AI_SETTING_KEYS.apiKey];
    if (!apiKey) throw new Error('API Key Gemini belum diisi. Buka Pengaturan → tab AI Lesson Plan.');

    const provider = LP_AI_PROVIDERS.gemini;
    const prompt = lpBuildPrompt(formData, model, settings[LP_AI_SETTING_KEYS.extra]);

    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const raw = await provider.generateJSON(prompt, apiKey, settings[LP_AI_SETTING_KEYS.model]);
            return lpValidateAiData(raw, model);
        } catch (e) {
            lastErr = e;
            // API key salah / kuota habis: tidak perlu retry
            if (String(e.message).indexOf('API error (4') !== -1 && String(e.message).indexOf('429') === -1) break;
        }
    }
    throw lastErr;
}

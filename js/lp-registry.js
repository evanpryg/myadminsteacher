// ============================================================
// LESSON PLAN - FIELD REGISTRY (Single Source of Truth)
// ------------------------------------------------------------
// Semua field lesson plan dideklarasikan di sini.
// - Form input, prompt AI, editor review, dan mapping DOCX
//   semuanya DITURUNKAN dari registry ini.
// - Menambah field baru = tambah entri di sini + placeholder
//   di template DOCX + mapping di manifest template (DB).
//   Logic utama TIDAK perlu diubah.
//
// Struktur field:
//   id          : key internal (dipakai di form_data / ai_data)
//   label       : label di UI
//   type        : text | textarea | date | number | select |
//                 model-select | checkbox-group | activities
//   source      : 'static' (form guru) | 'ai' (hasil AI) |
//                 'context' (hanya untuk prompt, tidak masuk DOCX)
//   placeholder : nama LOGIS placeholder (dipetakan ke nama fisik
//                 lewat manifest template di DB)
//   section     : pengelompokan di form (form_data nested per section)
// ============================================================

const LP_SECTIONS = [
    { id: 'identity',   label: 'Identitas',              icon: 'id-card' },
    { id: 'curriculum', label: 'Kurikulum',              icon: 'book-open' },
    { id: 'pedagogy',   label: 'Praktik Pedagogis',      icon: 'shapes' },
    { id: 'resources',  label: 'Media & Sumber Belajar', icon: 'monitor-play' },
    { id: 'ai_context', label: 'Konteks untuk AI',       icon: 'sparkles' }
];

// Opsi grup checkbox. Key HARUS cocok dengan placeholder chk_<group>_<key>
// di template DOCX. Menambah opsi = tambah di sini + placeholder di template.
const LP_CHECKBOX_GROUPS = {
    dimensions: {
        label: 'Dimensi Profil Lulusan',
        docxKey: 'dim',       // prefix placeholder di template: chk_dim_<key>
        options: [
            { key: 'faith',             label: 'Faith and devotion to God Almighty' },
            { key: 'collaboration',     label: 'Collaboration' },
            { key: 'citizenship',       label: 'Citizenship' },
            { key: 'independence',      label: 'Independence' },
            { key: 'critical_thinking', label: 'Critical thinking' },
            { key: 'health',            label: 'Health' },
            { key: 'creativity',        label: 'Creativity' },
            { key: 'communication',     label: 'Communication' }
        ]
    },
    strategy: {
        label: 'Teaching Strategy',
        hasOthers: true,
        options: [
            { key: 'discussion',    label: 'Discussion' },
            { key: 'collaborative', label: 'Collaborative' },
            { key: 'contextual',    label: 'Contextual' },
            { key: 'reflective',    label: 'Reflective' },
            { key: 'explorative',   label: 'Explorative' }
        ]
    },
    method: {
        label: 'Teaching Method',
        hasOthers: true,
        options: [
            { key: 'interactive_lecture', label: 'Interactive Lecture' },
            { key: 'group_discussion',    label: 'Group Discussion' },
            { key: 'experiment',          label: 'Experiment' },
            { key: 'presentation',        label: 'Presentation' },
            { key: 'gallery_walk',        label: 'Gallery Walk' },
            { key: 'peer_review',         label: 'Peer Review' }
        ]
    },
    assessment: {
        label: 'Formative Assessment Strategies',
        docxKey: 'assess',    // prefix placeholder di template: chk_assess_<key>
        hasOthers: true,
        options: [
            { key: 'question_answer',   label: 'Question and Answer' },
            { key: 'presentation',      label: 'Group/Individual presentation' },
            { key: 'individual_review', label: 'Individual Learner Review' },
            { key: 'focus_group',       label: 'Focus Group Task' },
            { key: 'observation',       label: 'Observation' },
            { key: 'peer_assessment',   label: 'Peer Assessment' },
            { key: 'project',           label: 'Project' }
        ]
    }
};

const LP_FIELD_REGISTRY = [
    // ---------- STATIC: identitas ----------
    { id: 'teacher_name',   label: 'Nama Guru',           type: 'text',   source: 'static', placeholder: 'teacher_name',   section: 'identity', settingKey: 'GS_NAMA_GURU', required: true },
    { id: 'principal_name', label: 'Nama Kepala Sekolah', type: 'text',   source: 'static', placeholder: 'principal_name', section: 'identity', settingKey: 'GS_NAMA_KEPALA' },
    { id: 'subject',        label: 'Mata Pelajaran',      type: 'text',   source: 'static', placeholder: 'subject',        section: 'identity', required: true, datalist: 'mapel' },
    { id: 'grade',          label: 'Kelas',               type: 'text',   source: 'static', placeholder: 'grade',          section: 'identity', required: true, datalist: 'kelas', width: 'sm' },
    { id: 'phase',          label: 'Fase',                type: 'select', source: 'static', placeholder: 'phase',          section: 'identity', options: ['E', 'F'], default: 'F', width: 'sm' },
    { id: 'school_year',    label: 'Tahun Ajaran',        type: 'text',   source: 'static', placeholder: 'school_year',    section: 'identity', settingKey: 'GS_TAHUN_AJARAN', width: 'sm' },
    { id: 'date',           label: 'Tanggal Pembelajaran',type: 'date',   source: 'static', placeholder: 'date',           section: 'identity', required: true, width: 'sm' },
    { id: 'duration',       label: 'Durasi (menit)',      type: 'number', source: 'static', placeholder: 'duration',       section: 'identity', default: 90, width: 'sm' },
    { id: 'meeting',        label: 'Pertemuan Ke-',       type: 'number', source: 'static', placeholder: 'meeting',        section: 'identity', default: 1, width: 'sm' },

    // ---------- STATIC: kurikulum ----------
    { id: 'learning_material',    label: 'Materi Pelajaran',                 type: 'text',     source: 'static', placeholder: 'learning_material',    section: 'curriculum', required: true },
    { id: 'learning_topic',       label: 'Topik Pembelajaran',               type: 'text',     source: 'static', placeholder: 'learning_topic',       section: 'curriculum', required: true },
    { id: 'learning_achievement', label: 'Capaian Pembelajaran (CP)',        type: 'textarea', source: 'static', placeholder: 'learning_achievement', section: 'curriculum' },
    { id: 'learning_objectives',  label: 'Tujuan Pembelajaran',              type: 'textarea', source: 'static', placeholder: 'learning_objectives',  section: 'curriculum' },
    { id: 'cdc',                  label: 'Lintas Disiplin Ilmu',             type: 'textarea', source: 'static', placeholder: 'cdc',                  section: 'curriculum', rows: 2 },

    // ---------- STATIC: pedagogi ----------
    { id: 'teaching_model', label: 'Model Pembelajaran',             type: 'model-select',   source: 'static', placeholder: null, section: 'pedagogy', required: true },
    { id: 'strategy',       label: 'Teaching Strategy',              type: 'checkbox-group', source: 'static', placeholder: null, section: 'pedagogy', group: 'strategy' },
    { id: 'method',         label: 'Teaching Method',                type: 'checkbox-group', source: 'static', placeholder: null, section: 'pedagogy', group: 'method' },
    { id: 'dimensions',     label: 'Dimensi Profil Lulusan',         type: 'checkbox-group', source: 'static', placeholder: null, section: 'pedagogy', group: 'dimensions' },
    { id: 'assessment',     label: 'Formative Assessment',           type: 'checkbox-group', source: 'static', placeholder: null, section: 'pedagogy', group: 'assessment' },

    // ---------- STATIC: media & sumber ----------
    { id: 'learning_media', label: 'Media Pembelajaran', type: 'textarea', source: 'static', placeholder: 'learning_media', section: 'resources', rows: 2, hintAI: true },
    { id: 'resources',      label: 'Sumber Belajar',     type: 'textarea', source: 'static', placeholder: 'resources',      section: 'resources', rows: 2, hintAI: true },

    // ---------- CONTEXT: hanya untuk prompt AI ----------
    { id: 'language',              label: 'Bahasa Lesson Plan',       type: 'select',   source: 'context', placeholder: null, section: 'ai_context', options: ['Bahasa Indonesia', 'English'], default: 'English' },
    { id: 'class_characteristics', label: 'Karakteristik Kelas',      type: 'select',   source: 'context', placeholder: null, section: 'ai_context', options: ['Campuran', 'Tinggi (Cepat Paham)', 'Sedang (Standar)', 'Rendah (Butuh Bimbingan Lebih)'], default: 'Campuran' },
    { id: 'teacher_notes',         label: 'Catatan Khusus (Opsional)',type: 'textarea', source: 'context', placeholder: null, section: 'ai_context', rows: 2 },

    // ---------- AI GENERATED (semua bisa diedit guru sebelum export) ----------
    { id: 'students',            label: 'Identifikasi Peserta Didik',  type: 'textarea', source: 'ai', placeholder: 'students' },
    { id: 'prior_knowledge',     label: 'Prior Knowledge',             type: 'textarea', source: 'ai', placeholder: 'prior_knowledge' },
    { id: 'partnerships',        label: 'Learning Partnerships',       type: 'textarea', source: 'ai', placeholder: 'partnerships' },
    { id: 'learning_environment',label: 'Learning Environment',        type: 'textarea', source: 'ai', placeholder: 'learning_environment' },
    { id: 'digital_utilization', label: 'Digital Utilization',         type: 'textarea', source: 'ai', placeholder: 'digital_utilization' },
    { id: 'islamic_value',       label: 'Islamic Value',               type: 'textarea', source: 'ai', placeholder: 'islamic_value' },
    { id: 'review',              label: 'Review',                      type: 'textarea', source: 'ai', placeholder: 'review' },
    { id: 'alpha_zone',          label: 'Alpha Zone',                  type: 'textarea', source: 'ai', placeholder: 'alpha_zone' },
    { id: 'application',         label: 'Application',                 type: 'textarea', source: 'ai', placeholder: 'application' },
    { id: 'main_activities',     label: 'Main Activities',             type: 'activities', source: 'ai', placeholder: 'main_activities' },
    { id: 'closing',             label: 'Closing',                     type: 'textarea', source: 'ai', placeholder: 'closing' },
    { id: 'time_closing',        label: 'Durasi Closing (menit)',      type: 'number',   source: 'ai', placeholder: 'time_closing' }
];

// ---------- helpers ----------
function lpFieldsBySource(source) {
    return LP_FIELD_REGISTRY.filter(f => f.source === source);
}
function lpFieldsBySection(sectionId) {
    return LP_FIELD_REGISTRY.filter(f => f.section === sectionId);
}
function lpGetField(id) {
    return LP_FIELD_REGISTRY.find(f => f.id === id);
}

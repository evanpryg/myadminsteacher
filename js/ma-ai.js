// ============================================================
// MODUL AJAR - AI GENERATION
// ------------------------------------------------------------
// AI menghasilkan SELURUH isi modul ajar (JSON), aplikasi yang
// merakit DOCX. Aturan penilai (komentar "Feedback FF" pada
// contoh modul ajar sekolah) dibakukan ke dalam prompt supaya
// hasil generate langsung memenuhi standar reviewer.
// Provider memakai adapter Gemini yang sama dgn lesson plan
// (LP_AI_PROVIDERS, API key GS_GEMINI_KEY).
// ============================================================

// Dimensi Profil Lulusan (key harus cocok dgn placeholder chk_dpl_*)
const MA_DPL = [
    { key: 'keimanan', label: 'Keimanan dan Ketakwaan terhadap Tuhan YME' },
    { key: 'penalaran_kritis', label: 'Penalaran Kritis' },
    { key: 'kolaborasi', label: 'Kolaborasi' },
    { key: 'kesehatan', label: 'Kesehatan' },
    { key: 'kewargaan', label: 'Kewargaan' },
    { key: 'kreativitas', label: 'Kreativitas' },
    { key: 'kemandirian', label: 'Kemandirian' },
    { key: 'komunikasi', label: 'Komunikasi' }
];

// Field teks flat yang dihasilkan AI (di luar array & pertemuan)
const MA_TEXT_FIELDS = [
    ['tujuan_pembelajaran', 'daftar bernomor tujuan pembelajaran (turunan CP, terukur)'],
    ['topik_pembelajaran', 'judul topik pembelajaran yang menarik (1 kalimat)'],
    ['strategi', 'strategi pembelajaran'],
    ['metode', 'metode pembelajaran (dipisah koma)'],
    ['kemitraan', 'kemitraan pembelajaran'],
    ['lingkungan', 'lingkungan pembelajaran'],
    ['digital', 'pemanfaatan digital (satu per baris)'],
    ['indikator_pengetahuan', 'indikator penilaian pengetahuan (satu per baris, awali "✔ ")'],
    ['bentuk_pengetahuan', 'bentuk penilaian pengetahuan yang sesuai topik (satu per baris)'],
    ['produk_keterampilan', 'nama produk penilaian keterampilan'],
    ['daftar_pustaka', 'daftar pustaka relevan (format APA, satu per baris)'],
    ['cp', 'Capaian Pembelajaran resmi mapel ini utk fase tsb'],
    ['diagnostik_kognitif', 'soal diagnostik kognitif (5 soal bernomor)'],
    ['refleksi_murid', 'pernyataan refleksi murid (satu per baris, awali "□ ")'],
    ['refleksi_guru', 'pertanyaan refleksi guru (bernomor)'],
    ['pengayaan', 'kegiatan pengayaan utk murid yang sudah mencapai TP'],
    ['remedial', 'kegiatan remedial utk murid yang belum mencapai TP'],
    ['diferensiasi', 'diferensiasi pembelajaran (konten, proses, produk)']
];

function maBuildPrompt(form, extra) {
    const dplList = MA_DPL.map(d => `"${d.key}" (${d.label})`).join(', ');
    const textFields = MA_TEXT_FIELDS.map(([k, desc]) => `- "${k}": (string) ${desc}`).join('\n');

    return `You are an expert Indonesian instructional designer for SMA under Kurikulum Merdeka with the Deep Learning approach (berkesadaran, bermakna, menggembirakan), working at an Islamic school (SMA Progresif Bumi Shalawat Sidoarjo).

Create a COMPLETE "Modul Ajar" (teaching module) as JSON.

## Context
- Mata pelajaran: ${form.mapel}
- Fase/Kelas: ${form.fase} / ${form.kelas}
- Topik/Materi: ${form.topik}
- Jumlah pertemuan: ${form.jumlah_pertemuan}, tiap pertemuan ${form.jp} JP x ${form.menit} menit
- Model pembelajaran: ${form.model}
${form.cp ? '- Capaian Pembelajaran (CP) dari guru: ' + form.cp : '- CP: kosong — buatkan dari panduan kurikulum resmi mapel & fase ini'}
${form.catatan ? '- Catatan khusus guru: ' + form.catatan : ''}

## ATURAN REVIEWER (WAJIB DIPATUHI — dari standar penilai sekolah)
1. "kemitraan": sebutkan mitra secara KONKRET dan deskriptif — murid-murid, murid-guru, guru mapel lain yang relevan (sebut mapelnya & perannya), orang tua (sebut bentuk penguatannya), lingkungan sekitar. Jangan hanya menulis "Murid-Guru".
2. "lingkungan": WAJIB dibagi tiga bagian dgn label: "Ruang Fisik:" (kelas/lab/perpus dsb), "Ruang Virtual:" (aplikasi/platform yang benar-benar dipakai), "Budaya Pembelajaran:" (mis. kolaboratif, reflektif).
3. KONSISTENSI: setiap media/aplikasi digital yang kamu tulis di "digital" HARUS benar-benar muncul dipakai dalam langkah pembelajaran (awal/memahami/mengaplikasi). Jangan mencantumkan alat yang tidak dipakai.
4. "merefleksi" pada tiap pertemuan = refleksi EXTENDED ABSTRACT: murid mengaitkan ilmu dengan kehidupan nyata, format pertanyaan reflektif, contoh: "Bagaimana pemahaman saya tentang [topik] mempengaruhi cara saya [tindakan nyata]?" — BUKAN exit ticket biasa.
5. Exit ticket / refleksi kegiatan biasa diletakkan di "penutup", bukan di "merefleksi".
6. "tujuan_pembelajaran" & "cp" harus selaras dgn panduan kurikulum resmi mapel ini.

## Output
Respond ONLY with one valid JSON object (no markdown), keys EXACTLY:
${textFields}
- "dpl": (array) 3-5 key dimensi profil lulusan paling relevan dari: ${dplList}
- "indikator": (array 4-6 objek) pemetaan indikator: { "indikator": string, "asesmen": string (Diagnostik/LKPD/Observasi/Tes formatif/HOTS/dll), "aktivitas": string (aktivitas + durasi, mis. "Diskusi kelompok (20 menit)") }
- "asesmen": (array 4-6 objek) { "jenis": string (Diagnostik Kognitif/Nonkognitif, Formatif 1..n, Sumatif), "teknik": string, "instrumen": string, "waktu": string (mis. "Awal Pertemuan 1"), "tujuan": string }
- "rubrik_produk": (array 4-5) { "aspek": string, "skor": integer } total skor = 100
- "rubrik_presentasi": (array 4-5) { "aspek": string, "skor": integer } total = 100
- "rubrik_diskusi": (array 4-5) { "aspek": string, "skor": integer } total = 100
- "rubrik_sikap": (array 4-6 string) aspek sikap yang dinilai relevan pembelajaran ini (mis. disiplin, kerja sama)
- "observasi_aspek": (array TEPAT 4 string) aspek kolom lembar observasi diskusi (singkat, 1-3 kata)
- "diagnostik_pernyataan": (array 5-6 string) pernyataan diagnostik non-kognitif (dijawab Ya/Tidak)
- "glosarium": (array 6-10 objek) { "istilah": string, "arti": string }
- "pertemuan": (array TEPAT ${form.jumlah_pertemuan} objek, satu per pertemuan) {
    "subtopik": string,
    "ayat_sumber": string (mis. "QS. Al-Hujurat ayat 13" atau "HR Muslim"),
    "ayat_arab": string (teks Arab ayat/hadith SINGKAT yang relevan dgn subtopik),
    "ayat_arti": string (terjemahan Indonesia),
    "implementasi": string (kaitan nilai islami dgn pembelajaran, 1-2 kalimat),
    "zona_alfa": string (nama permainan/ice breaking + langkah singkat, relevan topik),
    "awal": string (langkah kegiatan awal bernomor, sudut pandang murid),
    "memahami": string (langkah bernomor tahap Memahami),
    "mengaplikasi": string (langkah bernomor tahap Mengaplikasi),
    "merefleksi": string (refleksi extended abstract — lihat aturan 4),
    "penutup": string (langkah penutup bernomor: kesimpulan, apresiasi, exit ticket, tindak lanjut, doa),
    "lkpd": string (isi LKPD lengkap pertemuan ini: 2-3 Activity dgn instruksi & soal),
    "kunci_lkpd": string (kunci jawaban LKPD pertemuan ini)
  }

Tulis seluruh konten dalam Bahasa Indonesia (istilah asing mapel boleh tetap). Konten harus konkret & siap pakai, bukan generik. Alur antar pertemuan harus berkesinambungan (pertemuan 2 melanjutkan pertemuan 1, dst). JANGAN gunakan sintaks markdown (###, **, -, dll) — semua teks polos; daftar memakai penomoran "1." atau simbol yang diminta.
${extra ? '\n## Instruksi tambahan dari guru\n' + extra : ''}`;
}

// ---------- Validasi & koersi output AI ----------
function maValidateAiData(json, form) {
    if (!json || typeof json !== 'object') throw new Error('Output AI bukan objek JSON.');

    const asText = v => {
        if (typeof v === 'string') return v.trim();
        if (typeof v === 'number') return String(v);
        if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n').trim();
        if (v && typeof v === 'object') return Object.values(v).filter(x => typeof x === 'string').join('\n').trim();
        return '';
    };
    const asArr = (v, mapFn) => (Array.isArray(v) ? v.map(mapFn).filter(Boolean) : []);

    const out = {};
    MA_TEXT_FIELDS.forEach(([k]) => { out[k] = asText(json[k]); });

    const validDpl = MA_DPL.map(d => d.key);
    out.dpl = asArr(json.dpl, x => (validDpl.indexOf(x) !== -1 ? x : null));
    if (out.dpl.length === 0) out.dpl = ['keimanan', 'penalaran_kritis', 'komunikasi'];

    out.indikator = asArr(json.indikator, x => x && ({ indikator: asText(x.indikator), asesmen: asText(x.asesmen), aktivitas: asText(x.aktivitas) }));
    out.asesmen = asArr(json.asesmen, x => x && ({ jenis: asText(x.jenis), teknik: asText(x.teknik), instrumen: asText(x.instrumen), waktu: asText(x.waktu), tujuan: asText(x.tujuan) }));
    ['rubrik_produk', 'rubrik_presentasi', 'rubrik_diskusi'].forEach(k => {
        out[k] = asArr(json[k], x => x && ({ aspek: asText(x.aspek), skor: parseInt(x.skor, 10) || 0 }));
    });
    out.rubrik_sikap = asArr(json.rubrik_sikap, x => {
        const a = asText(x && x.aspek !== undefined ? x.aspek : x);
        return a ? { aspek: a } : null;
    });
    if (out.rubrik_sikap.length === 0) out.rubrik_sikap = [{ aspek: 'Disiplin' }, { aspek: 'Tanggung jawab' }, { aspek: 'Kerja sama' }, { aspek: 'Percaya diri' }, { aspek: 'Santun' }];
    out.observasi_aspek = asArr(json.observasi_aspek, x => asText(x)).filter(Boolean).slice(0, 4);
    while (out.observasi_aspek.length < 4) out.observasi_aspek.push('Aspek ' + (out.observasi_aspek.length + 1));
    out.diagnostik_pernyataan = asArr(json.diagnostik_pernyataan, x => ({ p: asText(x && x.p !== undefined ? x.p : x) })).filter(x => x.p);
    out.glosarium = asArr(json.glosarium, x => x && ({ istilah: asText(x.istilah), arti: asText(x.arti) }));

    // Pertemuan: paksa jumlah sesuai form
    const n = parseInt(form.jumlah_pertemuan, 10) || 2;
    const raw = Array.isArray(json.pertemuan) ? json.pertemuan : [];
    out.pertemuan = [];
    for (let i = 0; i < n; i++) {
        const p = raw[i] || {};
        out.pertemuan.push({
            nomor: i + 1,
            jp: form.jp + ' JP x ' + form.menit + ' menit',
            subtopik: asText(p.subtopik) || (form.topik + ' (' + (i + 1) + ')'),
            ayat_sumber: asText(p.ayat_sumber), ayat_arab: asText(p.ayat_arab),
            ayat_arti: asText(p.ayat_arti), implementasi: asText(p.implementasi),
            zona_alfa: asText(p.zona_alfa), awal: asText(p.awal),
            memahami: asText(p.memahami), mengaplikasi: asText(p.mengaplikasi),
            merefleksi: asText(p.merefleksi), penutup: asText(p.penutup),
            lkpd: asText(p.lkpd), kunci_lkpd: asText(p.kunci_lkpd)
        });
    }
    return out;
}

// ---------- Orkestrasi generate (retry 1x, reuse adapter Gemini LP) ----------
async function maGenerateAiData(form) {
    const settings = await getMultipleSettings([
        LP_AI_SETTING_KEYS.apiKey, LP_AI_SETTING_KEYS.model, LP_AI_SETTING_KEYS.extra
    ]);
    const apiKey = settings[LP_AI_SETTING_KEYS.apiKey];
    if (!apiKey) throw new Error('API Key Gemini belum diisi. Buka Pengaturan → tab AI Lesson Plan.');

    const prompt = maBuildPrompt(form, settings[LP_AI_SETTING_KEYS.extra]);
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const raw = await LP_AI_PROVIDERS.gemini.generateJSON(prompt, apiKey, settings[LP_AI_SETTING_KEYS.model]);
            return maValidateAiData(raw, form);
        } catch (e) {
            lastErr = e;
            if (String(e.message).indexOf('API error (4') !== -1 && String(e.message).indexOf('429') === -1) break;
        }
    }
    throw lastErr;
}

// ============================================================
// MODUL AJAR - DOCX COMPOSITION
// Merakit data render dari form + ai_data lalu memakai
// lpRenderDocx/lpDownloadBlob (renderer docxtemplater yang sama
// dengan lesson plan). Template: templates/modul-ajar-sma-v1.docx
// ============================================================

const MA_TEMPLATE_URL = 'templates/modul-ajar-sma-v1.docx';

function maFlattenData(form, aiData, settings) {
    const n = parseInt(form.jumlah_pertemuan, 10) || 2;
    const jpTotal = n * (parseInt(form.jp, 10) || 2);

    const data = {
        Nama_Penyusun: settings.GS_NAMA_GURU || '',
        Tahun_Ajaran: settings.GS_TAHUN_AJARAN || '',
        Mapel: form.mapel || '',
        Fase_Kelas: (form.fase || 'F') + ' / ' + (form.kelas || ''),
        Topik_Materi: form.topik || '',
        Alokasi_Waktu: n + ' Pertemuan (' + jpTotal + ' JP x ' + (form.menit || 40) + ' menit)',
        Model_Pembelajaran: form.model || '',
        CP: (form.cp || '').trim() || aiData.cp || '',
        Tujuan_Pembelajaran: aiData.tujuan_pembelajaran || '',
        Topik_Pembelajaran: aiData.topik_pembelajaran || '',
        Strategi: aiData.strategi || '',
        Metode: aiData.metode || '',
        Kemitraan: aiData.kemitraan || '',
        Lingkungan: aiData.lingkungan || '',
        Digital: aiData.digital || '',
        Indikator_Pengetahuan: aiData.indikator_pengetahuan || '',
        Bentuk_Pengetahuan: aiData.bentuk_pengetahuan || '',
        Aspek_Sikap: (aiData.rubrik_sikap || []).map(r => r.aspek).join('\n'),
        Produk_Keterampilan: aiData.produk_keterampilan || '',
        Daftar_Pustaka: aiData.daftar_pustaka || '',
        Diagnostik_Kognitif: aiData.diagnostik_kognitif || '',
        Refleksi_Murid: aiData.refleksi_murid || '',
        Refleksi_Guru: aiData.refleksi_guru || '',
        Pengayaan: aiData.pengayaan || '',
        Remedial: aiData.remedial || '',
        Diferensiasi: aiData.diferensiasi || '',
        indikator: aiData.indikator || [],
        asesmen: aiData.asesmen || [],
        rubrik_produk: aiData.rubrik_produk || [],
        rubrik_presentasi: aiData.rubrik_presentasi || [],
        rubrik_diskusi: aiData.rubrik_diskusi || [],
        rubrik_sikap: aiData.rubrik_sikap || [],
        diagnostik_pernyataan: aiData.diagnostik_pernyataan || [],
        glosarium: aiData.glosarium || [],
        pertemuan: aiData.pertemuan || []
    };

    // Kolom aspek lembar observasi (tetap 4 kolom)
    (aiData.observasi_aspek || []).forEach((a, i) => { data['obs_aspek_' + (i + 1)] = a; });
    for (let i = 1; i <= 4; i++) if (!data['obs_aspek_' + i]) data['obs_aspek_' + i] = 'Aspek ' + i;

    // Checkbox Dimensi Profil Lulusan
    const dipilih = aiData.dpl || [];
    MA_DPL.forEach(d => {
        data['chk_dpl_' + d.key] = dipilih.indexOf(d.key) !== -1 ? LP_CHECKED : LP_UNCHECKED;
    });
    return data;
}

async function maExportDocx(row) {
    const settings = await getMultipleSettings(['GS_NAMA_GURU', 'GS_TAHUN_AJARAN', 'GS_LP_FILE_CODE']);
    // Cache-buster: CDN GitHub Pages cache 10 menit & abaikan no-cache browser
    const resp = await fetch(MA_TEMPLATE_URL + '?v=' + Date.now(), { cache: 'no-cache' });
    if (!resp.ok) throw new Error('Gagal mengunduh template modul ajar (' + resp.status + ')');
    const buffer = await resp.arrayBuffer();

    const data = maFlattenData(row.form_data, row.ai_data, settings);
    const blob = lpRenderDocx(buffer, { delimiters: { start: '{{', end: '}}' } }, data);

    const code = settings.GS_LP_FILE_CODE || 'M16';
    const name = ['MA', code, row.form_data.kelas || 'Kelas', (row.form_data.topik || 'Topik')]
        .join('_').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-');
    lpDownloadBlob(blob, name + '.docx');
}

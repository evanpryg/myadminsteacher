/**
 * ============================================================
 * TeachMate - Konverter DOCX -> PDF (Google Apps Script)
 * ============================================================
 * Menerima file .docx (base64) dari aplikasi TeachMate,
 * mengubahnya menjadi PDF lewat mesin Google Docs, lalu
 * mengembalikan PDF (base64). File sementara langsung dihapus.
 *
 * CARA SETUP (sekali saja, +-3 menit):
 * 1. Buka https://script.google.com -> "Proyek baru"
 * 2. Hapus isi editor, tempel seluruh isi file ini, simpan (Ctrl+S)
 * 3. Di panel kiri, klik ikon "+" di sebelah "Layanan" (Services)
 *    -> pilih "Drive API" -> Tambahkan
 * 4. Klik "Terapkan" (Deploy) -> "Deployment baru"
 *    - Jenis: "Aplikasi web" (Web app)
 *    - Jalankan sebagai: "Saya"
 *    - Yang memiliki akses: "Siapa saja" (Anyone)
 *    -> Deploy -> salin URL yang berakhiran /exec
 * 5. Tempel URL tersebut di TeachMate:
 *    Pengaturan -> tab "AI Lesson Plan" -> "URL Konverter PDF"
 *
 * Catatan: saat deploy pertama Google akan minta izin akses
 * Drive akun Anda sendiri - klik Advanced/Lanjutan -> Izinkan.
 * ============================================================
 */

function doPost(e) {
  var tempId = null;
  try {
    var data = JSON.parse(e.postData.contents);
    var bytes = Utilities.base64Decode(data.docx);
    var blob = Utilities.newBlob(
      bytes,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      (data.filename || 'lessonplan') + '.docx'
    );

    // Upload ke Drive sambil dikonversi menjadi Google Doc
    var file;
    if (Drive.Files.create) {
      // Drive API v3
      file = Drive.Files.create(
        { name: blob.getName(), mimeType: 'application/vnd.google-apps.document' },
        blob
      );
    } else {
      // Drive API v2 (proyek lama)
      file = Drive.Files.insert({ title: blob.getName() }, blob, { convert: true });
    }
    tempId = file.id;

    // Export sebagai PDF
    var pdf = DriveApp.getFileById(tempId).getAs('application/pdf');
    var result = {
      ok: true,
      pdf: Utilities.base64Encode(pdf.getBytes())
    };
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    // Bersihkan file sementara dari Drive
    if (tempId) {
      try { DriveApp.getFileById(tempId).setTrashed(true); } catch (ignore) {}
    }
  }
}

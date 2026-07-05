// =========================================================
// DARK MODE & MOBILE SIDEBAR
// =========================================================
function toggleDarkMode() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('gs-dark-mode', isDark ? '1' : '0');
    lucide.createIcons();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-main');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// Restore dark mode preference on load
(function() {
    if (localStorage.getItem('gs-dark-mode') === '1') {
        document.documentElement.classList.add('dark');
    }
})();

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar-main');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

// Inisialisasi awal
document.addEventListener("DOMContentLoaded", function() {
    lucide.createIcons();
    if (typeof muatDaftarKelasDanMapel === 'function') {
        muatDaftarKelasDanMapel();
    }
    if (typeof initHalamanDashboard === 'function') {
        initHalamanDashboard();
    }
});

function pindahHalaman(target) {
    const daftarHalaman = {
        'dashboard':      document.getElementById('halaman-dashboard'),
        'nilai':          document.getElementById('halaman-nilai'),
        'presensi':       document.getElementById('halaman-presensi'),
        'keaktifan':      document.getElementById('halaman-keaktifan'),
        'catatansiswa':   document.getElementById('halaman-catatansiswa'),
        'jurnalmengajar': document.getElementById('halaman-jurnalmengajar'),
        'jadwalview':     document.getElementById('halaman-jadwalview'),
        'datamaster':     document.getElementById('halaman-datamaster'),
        'lessonplan':     document.getElementById('halaman-lessonplan'),
        'quicklinks':     document.getElementById('halaman-quicklinks'),
        'pengaturan':     document.getElementById('halaman-pengaturan')
    };

    const daftarTombol = {
        'dashboard':      document.getElementById('btn-nav-dashboard'),
        'nilai':          document.getElementById('btn-nav-nilai'),
        'presensi':       document.getElementById('btn-nav-presensi'),
        'keaktifan':      document.getElementById('btn-nav-keaktifan'),
        'catatansiswa':   document.getElementById('btn-nav-catatansiswa'),
        'jurnalmengajar': document.getElementById('btn-nav-jurnalmengajar'),
        'jadwalview':     document.getElementById('btn-nav-jadwalview'),
        'datamaster':     document.getElementById('btn-nav-datamaster'),
        'lessonplan':     document.getElementById('btn-nav-lessonplan'),
        'quicklinks':     document.getElementById('btn-nav-quicklinks'),
        'pengaturan':     document.getElementById('btn-nav-pengaturan')
    };

    const judul = document.getElementById('judul-halaman');

    Object.keys(daftarHalaman).forEach(key => {
        if (daftarHalaman[key]) {
            daftarHalaman[key].classList.add('hidden');
            daftarHalaman[key].classList.remove('block');
        }
        if (daftarTombol[key]) {
            daftarTombol[key].className = "w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium text-sm transition-all text-left";
        }
    });

    if (daftarHalaman[target]) {
        daftarHalaman[target].classList.remove('hidden');
        daftarHalaman[target].classList.add('block');
    }
    if (daftarTombol[target]) {
        daftarTombol[target].className = "w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-semibold text-sm transition-all text-left";
    }

    const judulMap = {
        'dashboard':      'Dashboard Overview',
        'nilai':          'Lembar Pengolahan Nilai',
        'presensi':       'Presensi Siswa',
        'keaktifan':      'Keaktifan Siswa',
        'catatansiswa':   'Catatan Siswa',
        'jurnalmengajar': 'Jurnal Mengajar',
        'jadwalview':     'Jadwal Mengajar',
        'datamaster':     'Data',
        'lessonplan':     'Lesson Plan Generator',
        'quicklinks':     'Quick Links',
        'pengaturan':     'Kelola Data & Semester'
    };
    if (judul) judul.innerText = judulMap[target] || 'TeachMate';

    closeSidebarMobile();

    // Trigger page-specific init
    if (target === 'dashboard' && typeof initHalamanDashboard === 'function') initHalamanDashboard();
    if (target === 'presensi' && typeof initHalamanPresensi === 'function') initHalamanPresensi();
    if (target === 'keaktifan' && typeof initHalamanKeaktifan === 'function') initHalamanKeaktifan();
    if (target === 'jadwalview' && typeof initHalamanJadwalView === 'function') initHalamanJadwalView();
    if (target === 'datamaster' && typeof initHalamanDataMaster === 'function') initHalamanDataMaster();
    if (target === 'pengaturan' && typeof initHalamanPengaturan === 'function') initHalamanPengaturan();
    if (target === 'lessonplan' && typeof initHalamanLessonPlan === 'function') initHalamanLessonPlan();
    if (target === 'quicklinks' && typeof initHalamanQuickLinks === 'function') initHalamanQuickLinks();
    if (target === 'catatansiswa' && typeof initHalamanCatatanSiswa === 'function') initHalamanCatatanSiswa();
    if (target === 'jurnalmengajar' && typeof initHalamanJurnalMengajar === 'function') initHalamanJurnalMengajar();

    lucide.createIcons();
}

function bukaNilaiDariDashboard() {
    const kelasDipilih = document.getElementById('select-kelas-dashboard')?.value;
    if (!kelasDipilih) return;
    document.getElementById('select-kelas-nilai').value = kelasDipilih;
    pindahHalaman('nilai');
}

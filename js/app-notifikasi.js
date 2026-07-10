// ============================================================
// BROWSER NOTIFICATIONS - Jadwal & Todo Deadline
// Uses Web Notifications API (requires user permission)
// ============================================================

const _NOTIF_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const _NOTIF_SENT_KEY = 'gs-notif-sent'; // localStorage key for sent notifications

let _notifCheckTimer = null;

// ── Permission & Initialization ─────────────────────────────

function initBrowserNotifications() {
    if (!('Notification' in window)) {
        console.warn('Browser tidak mendukung notifikasi.');
        return;
    }

    if (Notification.permission === 'granted') {
        _startNotificationChecker();
    } else if (Notification.permission !== 'denied') {
        // Show permission banner
        _showNotifPermissionBanner();
    }
}

function _showNotifPermissionBanner() {
    // Don't show if already dismissed today
    const dismissed = localStorage.getItem('gs-notif-banner-dismissed');
    if (dismissed === new Date().toISOString().split('T')[0]) return;

    const banner = document.createElement('div');
    banner.id = 'notif-permission-banner';
    banner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-[60] animate-slide-up';
    banner.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
            <div class="flex items-start gap-3">
                <div class="bg-indigo-100 dark:bg-indigo-900 p-2.5 rounded-xl shrink-0">
                    <i data-lucide="bell-ring" class="w-5 h-5 text-indigo-600 dark:text-indigo-400"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 dark:text-white text-sm">Aktifkan Notifikasi</h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Dapatkan pengingat 5 menit sebelum jadwal mengajar dan deadline tugas Anda.</p>
                </div>
                <button onclick="document.getElementById('notif-permission-banner').remove(); localStorage.setItem('gs-notif-banner-dismissed', new Date().toISOString().split('T')[0])"
                        class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg shrink-0">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="flex gap-2">
                <button onclick="_requestNotifPermission()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2">
                    <i data-lucide="bell" class="w-3.5 h-3.5"></i>Izinkan Notifikasi
                </button>
                <button onclick="document.getElementById('notif-permission-banner').remove(); localStorage.setItem('gs-notif-banner-dismissed', new Date().toISOString().split('T')[0])"
                        class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all">
                    Nanti
                </button>
            </div>
        </div>`;
    document.body.appendChild(banner);
    lucide.createIcons();
}

async function _requestNotifPermission() {
    try {
        const permission = await Notification.requestPermission();
        const banner = document.getElementById('notif-permission-banner');
        if (banner) banner.remove();

        if (permission === 'granted') {
            // Show confirmation notification
            new Notification('TeachMate 🎓', {
                body: 'Notifikasi aktif! Anda akan mendapat pengingat jadwal & deadline.',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎓</text></svg>'
            });
            _startNotificationChecker();
        }
    } catch (e) {
        console.error('Gagal meminta izin notifikasi:', e);
    }
}

// ── Notification Checker Engine ──────────────────────────────

function _startNotificationChecker() {
    if (_notifCheckTimer) clearInterval(_notifCheckTimer);
    // Run immediately, then every 30 seconds
    _checkAndSendNotifications();
    _notifCheckTimer = setInterval(_checkAndSendNotifications, _NOTIF_CHECK_INTERVAL);
}

async function _checkAndSendNotifications() {
    if (Notification.permission !== 'granted') return;

    try {
        await Promise.all([
            _checkJadwalNotifications(),
            _checkTodoNotifications()
        ]);
    } catch (e) {
        console.warn('Error checking notifications:', e);
    }
}

// ── Sent Notification Tracking ──────────────────────────────

function _getSentNotifs() {
    try {
        const raw = localStorage.getItem(_NOTIF_SENT_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw);
        // Clean old entries (older than 2 days)
        const cutoff = Date.now() - (2 * 24 * 60 * 60 * 1000);
        Object.keys(data).forEach(k => {
            if (data[k] < cutoff) delete data[k];
        });
        return data;
    } catch (e) { return {}; }
}

function _markNotifSent(key) {
    const data = _getSentNotifs();
    data[key] = Date.now();
    localStorage.setItem(_NOTIF_SENT_KEY, JSON.stringify(data));
}

function _isNotifSent(key) {
    const data = _getSentNotifs();
    return !!data[key];
}

// ── Jadwal Notifications (5 min before) ─────────────────────

async function _checkJadwalNotifications() {
    const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const hariIni = hariList[now.getDay()];
    const todayStr = now.toISOString().split('T')[0];

    // Fetch today's schedule
    let jadwal = null;
    try {
        jadwal = await fetchSupabase(
            "/rest/v1/jadwal_mengajar?hari=eq." + encodeURIComponent(hariIni),
            "GET"
        );
    } catch (e) { return; }

    if (!jadwal || jadwal.length === 0) return;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    jadwal.forEach(j => {
        // Parse jam_ke format "07:00 - 08:30" or jam_mulai field
        let jamMulai = '';
        if (j.jam_ke) {
            const parts = j.jam_ke.split('-');
            jamMulai = (parts[0] || '').trim();
        }
        if (!jamMulai) return;

        try {
            const [h, m] = jamMulai.split(':').map(Number);
            if (isNaN(h) || isNaN(m)) return;
            const jadwalMinutes = h * 60 + m;

            // Notify 5 minutes before
            const diff = jadwalMinutes - nowMinutes;
            if (diff >= 0 && diff <= 5) {
                const notifKey = `jadwal_${todayStr}_${jamMulai}_${j.kelas || ''}`;
                if (!_isNotifSent(notifKey)) {
                    const kelas = j.kelas || 'Tanpa Kelas';
                    const mapel = j.mata_pelajaran || '';
                    const ruang = j.ruangan ? ` · ${j.ruangan}` : '';

                    _sendNotification(
                        `⏰ Jadwal ${diff === 0 ? 'Dimulai Sekarang' : diff + ' Menit Lagi'}!`,
                        `${kelas} — ${mapel}${ruang}\nPukul ${jamMulai}`,
                        'jadwal'
                    );
                    _markNotifSent(notifKey);
                }
            }
        } catch (e) { /* skip invalid time format */ }
    });
}

// ── Todo Deadline Notifications ─────────────────────────────

async function _checkTodoNotifications() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Calculate tomorrow's date string
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get todos from cache or fetch
    let todos = [];
    if (typeof _todoList !== 'undefined' && _todoList.length > 0) {
        todos = _todoList;
    } else {
        try {
            const raw = await getAppSetting('GS_TODO_LIST', '[]');
            todos = JSON.parse(raw);
        } catch (e) { return; }
    }

    if (!todos || todos.length === 0) return;

    // Filter only incomplete tasks with deadlines
    const pendingWithDeadline = todos.filter(t => !t.done && t.deadline);

    pendingWithDeadline.forEach(t => {
        const deadline = t.deadline; // format: "YYYY-MM-DD"

        // ─── H-1 Notification (day before deadline, triggered between 8:00-8:05 AM) ───
        if (deadline === tomorrowStr) {
            // Send at ~8 AM on the day before
            if (currentHour === 8 && currentMinute < 5) {
                const notifKey = `todo_h1_${t.id}_${todayStr}`;
                if (!_isNotifSent(notifKey)) {
                    _sendNotification(
                        '📋 Deadline Besok!',
                        `"${t.judul}" harus diselesaikan besok (${_formatTanggalNotif(deadline)}).`,
                        'todo-h1'
                    );
                    _markNotifSent(notifKey);
                }
            }
        }

        // ─── D-Day Notification (on deadline day, triggered between 8:00-8:05 AM) ───
        if (deadline === todayStr) {
            if (currentHour === 8 && currentMinute < 5) {
                const notifKey = `todo_dday_${t.id}_${todayStr}`;
                if (!_isNotifSent(notifKey)) {
                    _sendNotification(
                        '🚨 Deadline Hari Ini!',
                        `"${t.judul}" harus diselesaikan hari ini!`,
                        'todo-dday'
                    );
                    _markNotifSent(notifKey);
                }
            }
        }
    });
}

// ── Send Notification Helper ────────────────────────────────

function _sendNotification(title, body, tag) {
    if (Notification.permission !== 'granted') return;

    try {
        const notif = new Notification(title, {
            body: body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎓</text></svg>',
            tag: tag, // Prevents duplicate notifications with same tag
            requireInteraction: tag.startsWith('todo'), // Todo notifications stay until dismissed
            silent: false
        });

        // Auto-close jadwal notifications after 10 seconds
        if (tag === 'jadwal') {
            setTimeout(() => notif.close(), 10000);
        }

        // Click handler: focus the app window
        notif.onclick = function () {
            window.focus();
            notif.close();
        };
    } catch (e) {
        console.warn('Failed to send notification:', e);
    }
}

// ── Date Formatting Helper ──────────────────────────────────

function _formatTanggalNotif(dateStr) {
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${d} ${bulan[m - 1]} ${y}`;
    } catch (e) { return dateStr; }
}

// ── Auto-start on DOMContentLoaded ──────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    // Delay notification init by 3 seconds to let the app load first
    setTimeout(initBrowserNotifications, 3000);
});

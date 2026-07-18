// =========================================================
// DASHBOARD - Direct Supabase version
// =========================================================
let _dbData = null;
let _dbCacheTime = 0;
const _DB_CACHE_TTL = 3 * 60 * 1000;
let _todoList = [];

async function initHalamanDashboard(forceRefresh) {
    const loader = document.getElementById('db-loader');
    const content = document.getElementById('db-content');

    const now = Date.now();
    if (!forceRefresh && _dbData && (now - _dbCacheTime) < _DB_CACHE_TTL) {
        _todoList = _dbData.todos || [];
        if (loader) loader.classList.add('hidden');
        if (content) { content.innerHTML = _buildDashboardHTML(_dbData); content.classList.remove('hidden'); }
        lucide.createIcons();
        if (typeof hideSplashScreen === 'function') hideSplashScreen();
        return;
    }

    if (loader) { loader.classList.remove('hidden'); loader.textContent = 'Memuat dashboard...'; }
    if (content) content.classList.add('hidden');

    try {
        // Clear settings cache to get fresh data
        if (typeof _settingsCache !== 'undefined') {
            Object.keys(_settingsCache).forEach(k => delete _settingsCache[k]);
        }
        const data = await getDashboardData();
        _dbData = data;
        _dbCacheTime = Date.now();
        _todoList = (data && data.todos) || [];
        if (loader) loader.classList.add('hidden');
        if (content) { content.innerHTML = _buildDashboardHTML(data); content.classList.remove('hidden'); }
        lucide.createIcons();
        if (typeof hideSplashScreen === 'function') hideSplashScreen();
    } catch (err) {
        if (loader) loader.innerHTML = `<span class="text-rose-500 font-bold">Gagal memuat dashboard: ${err.message || err}</span>`;
        if (typeof hideSplashScreen === 'function') hideSplashScreen();
    }
}

function refreshDashboardManual() { _dbData = null; initHalamanDashboard(true); }

// =========================================================
// BUILDER UTAMA
// =========================================================
function _buildDashboardHTML(data) {
    if (!data || !data.configured) {
        return `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center max-w-md mx-auto">
            <div class="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><i data-lucide="alert-triangle" class="w-7 h-7 text-amber-600"></i></div>
            <h3 class="font-black text-amber-800 text-lg mb-2">Database Belum Dikonfigurasi</h3>
            <p class="text-amber-700 text-sm mb-5">Pastikan tabel <code>app_settings</code> sudah dibuat di Supabase dan migration SQL sudah dijalankan.</p>
        </div>`;
    }
    return `
        ${_buildHeader(data.profil)}
        ${_buildStatCards(data.stats, data.profil.kkm)}
        ${_buildQuickLinks(data.quickLinks)}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="space-y-5">${_buildAgenda(data.agenda, data.hariIni)}</div>
            <div class="space-y-5">${_buildTodo(data.todos)}</div>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="space-y-5">${_buildPerhatian(data.siswaPerluPerhatian)}</div>
            <div class="space-y-5">${_buildApresiasi(data.apresiasi)}</div>
        </div>`;
}

function _buildHeader(profil) {
    const jam = new Date().getHours();
    const sapa = jam < 10 ? '🌅 Selamat Pagi' : jam < 15 ? '☀️ Selamat Siang' : jam < 18 ? '🌤 Selamat Sore' : '🌙 Selamat Malam';
    const tgl = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const nama = _esc(profil.nama || 'Guru');
    return `
    <div class="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-2xl p-7 text-white overflow-hidden shadow-xl shadow-indigo-300/30">
        <div class="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full pointer-events-none"></div>
        <div class="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
            <div>
                <p class="text-indigo-200 text-sm font-medium mb-0.5">${sapa},</p>
                <h2 class="text-3xl font-black tracking-tight mb-1">${nama}</h2>
                ${profil.sekolah ? `<p class="text-indigo-200 text-sm font-medium">${_esc(profil.sekolah)}</p>` : ''}
                <div class="mt-4 flex flex-wrap gap-2">
                    <span class="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl"><i data-lucide="calendar" class="w-3.5 h-3.5"></i>${tgl}</span>
                    <span class="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl"><i data-lucide="book-open" class="w-3.5 h-3.5"></i>TA ${_esc(profil.tahunAjaran)} · Sem. ${_esc(profil.semester)}</span>
                    <span class="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl"><i data-lucide="target" class="w-3.5 h-3.5"></i>KKM ${profil.kkm}</span>
                </div>
            </div>
            <button onclick="refreshDashboardManual()" title="Refresh" class="shrink-0 inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold px-3 py-2.5 rounded-xl transition-all"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
        </div>
    </div>`;
}

function _buildStatCards(stats, kkm) {
    const rn = stats.rataRataNilai, rh = stats.rataRataKehadiran;
    const cards = [
        { label: 'Total Siswa', value: stats.jumlahSiswa, sub: stats.jumlahKelas + ' kelas diampu', icon: 'users', iconBg: 'bg-indigo-600', valColor: 'text-indigo-600' },
        { label: 'Jumlah Kelas', value: stats.jumlahKelas, sub: 'Kelas yang diampu', icon: 'layout-grid', iconBg: 'bg-violet-600', valColor: 'text-violet-600' },
        { label: 'Rata-rata Nilai', value: rn !== null ? rn : '—', sub: rn !== null ? (rn >= kkm ? '✅ Di atas KKM' : '⚠️ Di bawah KKM') : 'Belum ada data', icon: 'bar-chart-2', iconBg: rn !== null && rn >= kkm ? 'bg-emerald-500' : 'bg-amber-500', valColor: rn !== null && rn >= kkm ? 'text-emerald-600' : 'text-amber-600' },
        { label: 'Rata-rata Kehadiran', value: rh !== null ? rh + '%' : '—', sub: rh !== null ? (rh >= 80 ? '✅ Baik' : '⚠️ Perlu perhatian') : 'Belum ada data', icon: 'user-check', iconBg: rh !== null && rh >= 80 ? 'bg-sky-500' : 'bg-rose-500', valColor: rh !== null && rh >= 80 ? 'text-sky-600' : 'text-rose-500' }
    ];
    return `<div class="grid grid-cols-2 xl:grid-cols-4 gap-4">${cards.map(c => `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-all">
            <div class="flex items-center justify-between"><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${c.label}</span><div class="${c.iconBg} p-2 rounded-xl shadow-sm"><i data-lucide="${c.icon}" class="w-4 h-4 text-white"></i></div></div>
            <div><p class="text-3xl font-black ${c.valColor} tabular-nums">${c.value}</p><p class="text-[11px] font-medium text-slate-400 mt-1">${c.sub}</p></div>
        </div>`).join('')}</div>`;
}

function _buildAgenda(agenda, hariIni) {
    let body;
    if (!agenda || agenda.length === 0) {
        body = `<div class="py-10 text-center"><div class="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto"><i data-lucide="calendar-x" class="w-6 h-6 text-slate-400"></i></div><p class="text-sm font-semibold text-slate-500 mt-2">Tidak ada jadwal hari ini</p></div>`;
    } else {
        body = `<div class="space-y-2">${agenda.map((a, i) => {
            const isNow = _isCurrentTime(a.jamMulai, a.jamSelesai);
            return `
            <div class="flex items-start gap-3 p-3.5 ${isNow ? 'bg-indigo-50 border border-indigo-200 ring-1 ring-indigo-100' : 'bg-slate-50 hover:bg-indigo-50/40'} rounded-xl transition-all">
                <div class="bg-indigo-600 text-white rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[56px] shadow-sm">
                    <p class="text-xs font-black leading-none">${_esc(a.jamMulai || '?')}</p>
                    <div class="w-3 h-px bg-white/40 mx-auto my-1"></div>
                    <p class="text-[10px] font-bold leading-none opacity-70">${_esc(a.jamSelesai || '?')}</p>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <p class="font-bold text-slate-800 text-sm">${_esc(a.kelas || 'Tanpa Kelas')}</p>
                        ${isNow ? '<span class="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full animate-pulse">SEDANG BERLANGSUNG</span>' : ''}
                    </div>
                    <p class="text-xs text-indigo-600 font-semibold mt-0.5">${_esc(a.mapel)}</p>
                    ${a.ruang ? `<p class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i>${_esc(a.ruang)}</p>` : ''}
                </div>
                <span class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg ${a.kategori === 'Intensif' ? 'bg-amber-100 text-amber-700' : a.kategori === 'Kegiatan' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-700'}">${_esc(a.kategori || 'Normal')}</span>
            </div>`;
        }).join('')}</div>`;
    }
    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-3"><div class="bg-indigo-600 p-2 rounded-xl"><i data-lucide="calendar-days" class="w-4 h-4 text-white"></i></div><div><h3 class="font-bold text-slate-800 text-sm">Agenda Hari Ini</h3><p class="text-[11px] text-slate-400">${_esc(hariIni)} · ${agenda ? agenda.length : 0} jadwal</p></div></div>
            <button onclick="pindahHalaman('jadwalview')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800">Lihat Semua →</button>
        </div>
        <div class="p-4">${body}</div></div>`;
}

function _isCurrentTime(mulai, selesai) {
    if (!mulai || !selesai) return false;
    try {
        const now = new Date();
        const h = now.getHours(), m = now.getMinutes();
        const nowMin = h * 60 + m;
        const [mH, mM] = mulai.split(':').map(Number);
        const [sH, sM] = selesai.split(':').map(Number);
        return nowMin >= (mH * 60 + mM) && nowMin <= (sH * 60 + sM);
    } catch(e) { return false; }
}

function _buildTodo(todos) {
    _todoList = todos || [];
    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-3"><div class="bg-amber-500 p-2 rounded-xl"><i data-lucide="list-todo" class="w-4 h-4 text-white"></i></div><div><h3 class="font-bold text-slate-800 text-sm">To-Do List</h3><p id="todo-counter" class="text-[11px] text-slate-400">${_todoCounter()}</p></div></div>
            <button onclick="bukaModalTodo()" class="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Tambah</button>
        </div>
        <div id="todo-body" class="p-4 space-y-2 max-h-72 overflow-y-auto">${_renderTodoItems()}</div></div>`;
}

function _todoCounter() {
    const p = _todoList.filter(t => !t.done).length;
    const d = _todoList.filter(t => t.done).length;
    return `${p} tugas belum · ${d} selesai`;
}

function _renderTodoItems() {
    if (_todoList.length === 0) return `<div class="py-8 text-center"><i data-lucide="party-popper" class="w-8 h-8 mx-auto text-emerald-400"></i><p class="text-sm font-semibold text-slate-500 mt-2">Tidak ada tugas! 🎉</p></div>`;
    const sorted = [..._todoList.filter(t => !t.done), ..._todoList.filter(t => t.done).slice(0, 3)];
    const today = new Date().toISOString().split('T')[0];
    return sorted.map(t => {
        const soon = !t.done && t.deadline && t.deadline <= today;
        return `<div class="flex items-start gap-3 p-3 rounded-xl transition-colors group ${t.done ? 'opacity-50' : soon ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 hover:bg-indigo-50/40'}">
            <button onclick="_toggleTodo('${t.id}')" class="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${t.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-indigo-500'}">${t.done ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}</button>
            <div class="flex-1 min-w-0"><p class="text-sm font-semibold text-slate-800 ${t.done ? 'line-through text-slate-400' : ''}">${_esc(t.judul)}</p>${t.deadline ? `<span class="text-[11px] ${soon ? 'text-rose-600 font-bold' : 'text-slate-400'}">${_fmtTgl(t.deadline)}</span>` : ''}</div>
            <button onclick="_hapusTodo('${t.id}')" class="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>`;
    }).join('');
}

function _refreshTodo() {
    const body = document.getElementById('todo-body');
    const counter = document.getElementById('todo-counter');
    if (body) body.innerHTML = _renderTodoItems();
    if (counter) counter.textContent = _todoCounter();
    lucide.createIcons();
}

function _toggleTodo(id) {
    const t = _todoList.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    _saveTodos();
    _refreshTodo();
}

function _hapusTodo(id) {
    _todoList = _todoList.filter(x => x.id !== id);
    _saveTodos();
    _refreshTodo();
}

async function _saveTodos() {
    try { await saveTodoList(_todoList); } catch (e) { console.warn('Gagal simpan todo:', e); }
}

function _buildQuickLinks(links) {
    let linkArray = [];
    if (Array.isArray(links)) linkArray = links;
    else if (links && links.links) linkArray = links.links;
    if (!linkArray || linkArray.length === 0) return '';
    // Tampilkan 4 link yang paling sering diakses (hits); sisanya lewat menu Quick Links
    const top4 = linkArray.slice().sort((a, b) => (b.hits || 0) - (a.hits || 0)).slice(0, 4);
    const colorMap = { emerald: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700', amber: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700', sky: 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-700', indigo: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700', rose: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700', violet: 'bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-700' };
    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between"><div class="flex items-center gap-3"><div class="bg-slate-700 p-2 rounded-xl"><i data-lucide="link" class="w-4 h-4 text-white"></i></div><div><h3 class="font-bold text-slate-800 text-sm">Quick Links</h3><p class="text-[10px] text-slate-400">4 paling sering diakses</p></div></div><button onclick="pindahHalaman('quicklinks')" class="text-xs font-bold text-indigo-600">Lihat Semua (${linkArray.length}) →</button></div>
        <div class="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">${top4.map(l => `<a href="${_esc(l.url)}" data-ql-track="${_esc(l.url)}" target="_blank" class="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${colorMap[l.color] || colorMap.indigo}"><i data-lucide="${l.icon || 'link'}" class="w-4 h-4 shrink-0"></i><span class="flex-1 truncate text-xs">${_esc(l.label)}</span></a>`).join('')}</div></div>`;
}

// ── Siswa Perlu Perhatian ────────────────────────────────────
function _buildPerhatian(list) {
    let body;
    if (!list || list.length === 0) {
        body = `<div class="py-10 text-center space-y-2">
            <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto"><i data-lucide="smile" class="w-6 h-6 text-emerald-600"></i></div>
            <p class="text-sm font-semibold text-slate-600">Semua siswa dalam kondisi baik! 🎉</p>
            <p class="text-xs text-slate-400">Tidak ada siswa yang memerlukan perhatian khusus</p>
        </div>`;
    } else {
        body = `<div class="space-y-2">${list.map(s => {
            const badges = (s.alasan || []).map(a => {
                const cls = a.tipe === 'nilai' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                return `<span class="${cls} text-[10px] font-bold px-2 py-0.5 rounded-lg">${_esc(a.label)}</span>`;
            }).join('');
            const inisial = (s.nama || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            return `
            <div class="flex items-center gap-3 p-3 bg-slate-50 hover:bg-rose-50/30 rounded-xl transition-colors">
                <div class="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center font-bold text-rose-700 text-sm shrink-0">${inisial}</div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800 leading-tight truncate">${_esc(s.nama)}</p>
                    <p class="text-[11px] text-slate-400">${_esc(s.kelas || '')}</p>
                    <div class="flex flex-wrap gap-1 mt-1">${badges}</div>
                </div>
            </div>`;
        }).join('')}</div>`;
    }
    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center gap-3"><div class="bg-rose-500 p-2 rounded-xl"><i data-lucide="alert-circle" class="w-4 h-4 text-white"></i></div><div><h3 class="font-bold text-slate-800 text-sm">Siswa Perlu Perhatian</h3><p class="text-[11px] text-slate-400">${list ? list.length : 0} siswa teridentifikasi</p></div></div>
        <div class="p-4">${body}</div></div>`;
}

// ── Apresiasi Siswa ─────────────────────────────────────────
function _buildApresiasi(apr) {
    if (!apr) apr = {};
    const mkCard = (icon, iconBg, label, siswa, valueStr) => {
        if (!siswa) return `
        <div class="flex-1 min-w-[130px] bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-2">
            <div class="${iconBg} w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"><i data-lucide="${icon}" class="w-4 h-4 text-white"></i></div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight">${label}</p>
            <p class="text-xs text-slate-400 font-medium">Belum ada data</p>
        </div>`;
        const inisial = (siswa.nama || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        return `
        <div class="flex-1 min-w-[130px] bg-gradient-to-br from-slate-50 to-slate-100/30 rounded-2xl p-4 border border-slate-200 flex flex-col gap-2">
            <div class="${iconBg} w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"><i data-lucide="${icon}" class="w-4 h-4 text-white"></i></div>
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider leading-tight">${label}</p>
            <div class="flex items-center gap-2 mt-0.5">
                <div class="w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center text-[10px] font-black text-white">${inisial}</div>
                <div class="min-w-0"><p class="font-bold text-slate-800 text-xs leading-tight truncate">${_esc(siswa.nama)}</p><p class="text-[10px] text-slate-500 truncate">${_esc(siswa.kelas || '')}</p></div>
            </div>
            <p class="text-base font-black text-indigo-600">${valueStr}</p>
        </div>`;
    };

    const starVal = apr.academicStar ? 'Nilai ' + apr.academicStar.nilai : null;
    const growthVal = apr.growthChampion ? '+' + apr.growthChampion.delta + ' poin' : null;
    const activeVal = apr.activeLearner ? apr.activeLearner.poin + ' poin' : null;

    return `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center gap-3"><div class="bg-amber-500 p-2 rounded-xl"><i data-lucide="award" class="w-4 h-4 text-white"></i></div><div><h3 class="font-bold text-slate-800 text-sm">Apresiasi Siswa</h3><p class="text-[11px] text-slate-400">Penghargaan periode ini</p></div></div>
        <div class="p-4 flex flex-wrap gap-3">
            ${mkCard('star', 'bg-amber-500', '⭐ Academic Star', apr.academicStar, starVal)}
            ${mkCard('trending-up', 'bg-emerald-500', '📈 Growth Champion', apr.growthChampion, growthVal)}
            ${mkCard('zap', 'bg-indigo-600', '⚡ Active Learner', apr.activeLearner, activeVal)}
        </div></div>`;
}

// ── Modal Todo ──────────────────────────────────────────────
function bukaModalTodo() {
    const modal = document.getElementById('modal-tambah-todo');
    if (!modal) return;
    modal.classList.remove('hidden');
    lucide.createIcons();
    setTimeout(() => document.getElementById('todo-judul')?.focus(), 100);
}
function tutupModalTodo() { document.getElementById('modal-tambah-todo')?.classList.add('hidden'); }
function simpanTodoBaru() {
    const judul = document.getElementById('todo-judul')?.value?.trim();
    if (!judul) return;
    _todoList.push({ id: 'td_' + Date.now(), judul, deadline: document.getElementById('todo-deadline')?.value || '', prioritas: document.getElementById('todo-prioritas')?.value || 'Sedang', done: false });
    _saveTodos(); _refreshTodo(); tutupModalTodo();
    const el = document.getElementById('todo-judul'); if (el) el.value = '';
}

// ── Helpers ─────────────────────────────────────────────────
function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _fmtTgl(tgl) { if (!tgl) return ''; try { return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return tgl; } }

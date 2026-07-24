// ============================================================
// SUPABASE CLIENT - Direct REST API calls from frontend
// ============================================================
const SUPABASE_URL = "https://ypaummypsupytjiagqoj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwYXVtbXlwc3VweXRqaWFncW9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MTI0MDIsImV4cCI6MjA5ODM4ODQwMn0.Gw2GWz59HmqZu5VDWKetQBFAxzzci2h2gSOdKO_8gBU";

/**
 * Core Supabase REST API fetch (replaces google.script.run + server-side fetchSupabase)
 */
let _lastSupabaseError = '';

// PostgREST/Supabase membatasi hasil GET maksimal 1000 baris per permintaan.
// Tanpa paging, data ke-1001 dst tidak pernah terbaca (mis. siswa > 1000).
const SUPABASE_PAGE_SIZE = 1000;
const SUPABASE_MAX_ROWS = 100000;   // pengaman agar tidak berputar tanpa henti

async function _fetchSupabaseOnce(path, method, payload, extraHeaders) {
    const url = SUPABASE_URL + path;
    const options = {
        method: method || "GET",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    };

    if (extraHeaders) {
        Object.keys(extraHeaders).forEach(k => { options.headers[k] = extraHeaders[k]; });
    }
    if (payload) {
        options.body = JSON.stringify(payload);
    }

    try {
        const response = await fetch(url, options);
        const text = await response.text();
        if (response.ok) {
            _lastSupabaseError = '';
            return text ? JSON.parse(text) : [];
        } else {
            _lastSupabaseError = text;
            console.error("Supabase API Error (" + response.status + "):", text);
            return null;
        }
    } catch (e) {
        _lastSupabaseError = e.message || e.toString();
        console.error("Network Error:", e);
        return null;
    }
}

// Ambil SEMUA baris dgn paging Range. Tabel <= 1000 baris tetap 1 permintaan.
async function _fetchSupabaseAllPages(path, extraHeaders) {
    let hasil = [];
    let dari = 0;
    while (dari < SUPABASE_MAX_ROWS) {
        const headers = Object.assign({}, extraHeaders || {}, {
            "Range-Unit": "items",
            "Range": dari + "-" + (dari + SUPABASE_PAGE_SIZE - 1)
        });
        const halaman = await _fetchSupabaseOnce(path, "GET", null, headers);
        if (halaman === null) return dari === 0 ? null : hasil;   // gagal di halaman pertama
        if (!Array.isArray(halaman)) return halaman;              // bukan daftar baris
        hasil = hasil.concat(halaman);
        if (halaman.length < SUPABASE_PAGE_SIZE) break;           // halaman terakhir
        dari += SUPABASE_PAGE_SIZE;
    }
    return hasil;
}

async function fetchSupabase(path, method, payload, extraHeaders) {
    const m = (method || "GET").toUpperCase();
    // GET tanpa limit/Range eksplisit -> ambil seluruh baris (auto-paging)
    const adaLimit = /[?&]limit=/.test(path);
    const adaRange = extraHeaders && (extraHeaders.Range || extraHeaders.range);
    if (m === "GET" && !adaLimit && !adaRange) {
        return await _fetchSupabaseAllPages(path, extraHeaders);
    }
    return await _fetchSupabaseOnce(path, m, payload, extraHeaders);
}

/**
 * Fetch multiple endpoints in parallel (replaces fetchSupabaseParallel)
 */
async function fetchSupabaseParallel(paths) {
    const promises = paths.map(path => fetchSupabase(path, "GET"));
    try {
        return await Promise.all(promises);
    } catch (e) {
        console.error("Parallel fetch error:", e);
        return paths.map(() => null);
    }
}

// ============================================================
// APP SETTINGS (replaces PropertiesService.getScriptProperties)
// Stored in 'app_settings' table: { key: string, value: string }
// ============================================================
const _settingsCache = {};

async function getAppSetting(key, defaultValue) {
    if (_settingsCache[key] !== undefined) return _settingsCache[key];
    const data = await fetchSupabase("/rest/v1/app_settings?key=eq." + encodeURIComponent(key) + "&limit=1", "GET");
    if (data && data.length > 0) {
        _settingsCache[key] = data[0].value;
        return data[0].value;
    }
    return defaultValue || '';
}

async function setAppSetting(key, value) {
    _settingsCache[key] = value;
    await fetchSupabase("/rest/v1/app_settings", "POST", { key, value: String(value) }, {
        "Prefer": "return=representation,resolution=merge-duplicates"
    });
}

async function getMultipleSettings(keys) {
    // Filter out keys already in cache
    const missing = keys.filter(k => _settingsCache[k] === undefined);
    if (missing.length > 0) {
        const filter = missing.map(k => "key.eq." + encodeURIComponent(k)).join(",");
        const data = await fetchSupabase("/rest/v1/app_settings?or=(" + filter + ")", "GET");
        if (data) {
            data.forEach(d => { _settingsCache[d.key] = d.value; });
        }
    }
    const result = {};
    keys.forEach(k => { result[k] = _settingsCache[k] || ''; });
    return result;
}

async function setMultipleSettings(obj) {
    const payload = Object.keys(obj).map(k => {
        _settingsCache[k] = String(obj[k]);
        return { key: k, value: String(obj[k]) };
    });
    await fetchSupabase("/rest/v1/app_settings", "POST", payload, {
        "Prefer": "return=representation,resolution=merge-duplicates"
    });
}

// ============================================================
// PERIODE AKTIF
// ============================================================
async function getPeriodeAktif() {
    const settings = await getMultipleSettings(['GS_TAHUN_AJARAN', 'GS_SEMESTER']);
    const ta = settings.GS_TAHUN_AJARAN || '2025/2026';
    const sem = settings.GS_SEMESTER || 'Ganjil';
    return ta + '-' + sem;
}

async function getInfoPeriodeAktif() {
    const settings = await getMultipleSettings(['GS_TAHUN_AJARAN', 'GS_SEMESTER']);
    const ta = settings.GS_TAHUN_AJARAN || '2025/2026';
    const sem = settings.GS_SEMESTER || 'Ganjil';
    return { tahunAjaran: ta, semester: sem, periode: ta + '-' + sem };
}

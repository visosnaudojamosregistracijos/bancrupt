// server/visitStats.js
// 📊 Sava lankytojų statistika – BE SLAPUKŲ ir be asmens duomenų.
//
// Kaip skaičiuojama:
//  • „Lankytojai“ – unikalūs žmonės per dieną, kurių naršyklė iš tikrųjų atidarė žaidimą
//    (prisijungė per socket.io). Botai, paieškos robotai ir nuorodų peržiūros (Facebook,
//    TikTok, Viber...) JavaScript nevykdo, todėl jų čia nebūna.
//  • Unikalumas nustatomas iš IP + naršyklės (User-Agent) maišos su KASDIEN NAUJA atsitiktine
//    „druska“. Maiša laikoma tik atmintyje ir tik tą dieną, į DB rašomi tik skaičiai –
//    atgal žmogaus atsekti neįmanoma, todėl sutikimo (BDAR) nereikia.
//  • Papildomai: puslapio atidarymai (be botų), sukurti / pradėti / baigti žaidimai.

const crypto = require('crypto');

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|embedly|quora|pinterest|vkshare|whatsapp|telegram|viber|discord|skype|slack|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|java\/|go-http|axios|node-fetch|okhttp|httpclient|scrapy|semrush|ahrefs|mj12|dotbot|petal|yandex|bingpreview|googleother|feedfetcher/i;

let pool = null;
let day = null;          // 'YYYY-MM-DD' (Lietuvos laiku)
let salt = null;
let seenVisitors = new Set();
let seenPages = new Set();

function todayLt() {
    // Diena pagal Lietuvos laiką, kad „šiandien“ sutaptų su tavo kalendoriumi
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vilnius' }).format(new Date());
}
function rollDay() {
    const d = todayLt();
    if (d !== day) {
        day = d;
        salt = crypto.randomBytes(16).toString('hex');
        seenVisitors = new Set();
        seenPages = new Set();
    }
}
function hashOf(ip, ua) {
    rollDay();
    return crypto.createHash('sha256').update(salt + '|' + (ip || '') + '|' + (ua || '')).digest('hex').slice(0, 24);
}
function isBot(ua) {
    return !ua || BOT_RE.test(ua);
}

async function bump(column, by = 1) {
    if (!pool) return;
    rollDay();
    try {
        await pool.query(
            `INSERT INTO site_daily (day, ${column}) VALUES ($1, $2)
             ON CONFLICT (day) DO UPDATE SET ${column} = site_daily.${column} + $2`,
            [day, by]
        );
    } catch (err) {
        console.error('📊 statistikos klaida:', err.message);
    }
}

async function init(dbPool) {
    pool = dbPool;
    rollDay();
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS site_daily (
                day DATE PRIMARY KEY,
                visitors INTEGER NOT NULL DEFAULT 0,
                pageviews INTEGER NOT NULL DEFAULT 0,
                registered INTEGER NOT NULL DEFAULT 0,
                games_created INTEGER NOT NULL DEFAULT 0,
                games_started INTEGER NOT NULL DEFAULT 0,
                games_finished INTEGER NOT NULL DEFAULT 0
            )
        `);
        console.log('📊 Lankytojų statistika (be slapukų) paruošta');
    } catch (err) {
        console.error('📊 site_daily lentelės klaida:', err.message);
    }
}

// Puslapio atidarymas (HTML), botus praleidžiam
function trackPage(req) {
    try {
        const ua = req.headers['user-agent'] || '';
        if (isBot(ua)) return;
        const accept = req.headers.accept || '';
        if (!accept.includes('text/html')) return;
        bump('pageviews');
    } catch (e) {}
}

// Tikras lankytojas – naršyklė prisijungė prie žaidimo serverio
function trackSocket(socket, ip) {
    try {
        const ua = (socket.handshake.headers || {})['user-agent'] || '';
        if (isBot(ua)) return;
        const h = hashOf(ip, ua);
        if (seenVisitors.has(h)) return;
        seenVisitors.add(h);
        bump('visitors');
        if (!socket.isGuest && socket.userId) bump('registered');
    } catch (e) {}
}

function trackGame(kind) {
    if (kind === 'created') bump('games_created');
    else if (kind === 'started') bump('games_started');
    else if (kind === 'finished') bump('games_finished');
}

async function getSummary(days = 30) {
    if (!pool) return null;
    rollDay();
    const n = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
    const r = await pool.query(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, visitors, pageviews, registered, games_created, games_started, games_finished
         FROM site_daily WHERE day > ($1::date - $2::int) ORDER BY day ASC`,
        [day, n]
    );
    const rows = r.rows;
    const byDay = {};
    rows.forEach(x => { byDay[x.day] = x; });
    const empty = d => ({ day: d, visitors: 0, pageviews: 0, registered: 0, games_created: 0, games_started: 0, games_finished: 0 });
    const series = [];
    const base = new Date(day + 'T12:00:00Z');
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(base.getTime() - i * 86400000).toISOString().slice(0, 10);
        series.push(byDay[d] || empty(d));
    }
    const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
    const last7 = series.slice(-7);
    const t = series[series.length - 1], y = series[series.length - 2] || empty('');
    return {
        today: t, yesterday: y,
        last7: { visitors: sum(last7, 'visitors'), games_started: sum(last7, 'games_started') },
        lastN: { days: n, visitors: sum(series, 'visitors'), games_started: sum(series, 'games_started'), games_created: sum(series, 'games_created') },
        series
    };
}

module.exports = { init, trackPage, trackSocket, trackGame, getSummary, isBot };

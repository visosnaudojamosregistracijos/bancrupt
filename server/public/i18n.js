// ============================================
// i18n.js – KALBŲ SISTEMA
// ============================================

const SUPPORTED_LANGS = ['lt', 'en', 'ru', 'de', 'es', 'fr'];
let currentLang = (() => {
    try { const l = localStorage.getItem('bancrupt_lang'); return SUPPORTED_LANGS.includes(l) ? l : 'lt'; }
    catch (e) { return 'lt'; }
})();
let translations = {};   // pasirinkta kalba
let ltRef = {};          // lietuviški šablonai (serverio tekstams atpažinti)

// Kalba įkeliama iškart (sinchroniškai), kad pirmi užrašai jau būtų teisinga kalba
function loadLangSync(lang) {
    if (window.__LANGS && window.__LANGS[lang]) return window.__LANGS[lang];   // peržiūra
    try {
        const x = new XMLHttpRequest();
        x.open('GET', '/lang/' + lang + '.json', false);
        x.send(null);
        if (x.status === 200) return JSON.parse(x.responseText);
    } catch (e) { /* įkels vėliau per fetch */ }
    return null;
}
ltRef = loadLangSync('lt') || {};
translations = currentLang === 'lt' ? ltRef : (loadLangSync(currentLang) || ltRef);

// ============================================
// ĮKELTI KALBĄ
// ============================================
async function fetchLang(lang) {
    const response = await fetch(`/lang/${lang}.json`);
    if (!response.ok) throw new Error('Nepavyko įkelti kalbos ' + lang);
    return response.json();
}

async function loadLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) lang = 'lt';
    try {
        const data = await fetchLang(lang);
        if (lang === 'lt') ltRef = data;
        else if (!ltRef || !Object.keys(ltRef).length) {
            try { ltRef = await fetchLang('lt'); } catch (e) { ltRef = {}; }
        }
        const prevDict = translations, prevLang = currentLang;
        translations = data;
        currentLang = lang;
        try { localStorage.setItem('bancrupt_lang', lang); } catch (e) {}
        try { document.documentElement.lang = lang; } catch (e) {}
        srvMatchers = null;
        srvCache.clear();
        updateAllTexts();
        if (prevLang !== lang) { try { retranslateDom(prevDict); } catch (e) { console.warn('retranslateDom:', e); } }
        startSrvObserver();
        return true;
    } catch (err) {
        console.error('❌ Kalbos klaida:', err);
        return false;
    }
}

// ============================================
// GAUTI VERTIMĄ
// ============================================
function t(key) {
    const v = translations[key];
    if (typeof v === 'string') return v;
    const l = ltRef[key];
    return typeof l === 'string' ? l : key;
}

// Lietuviškas langelio pavadinimas (iš serverio/lentos) → pasirinkta kalba
let cellNameMap = null, cellNameMapSrc = null;
function trCellName(v) {
    if (!v || currentLang === 'lt') return v;
    if (!cellNameMap || cellNameMapSrc !== ltRef) {
        cellNameMap = new Map(); cellNameMapSrc = ltRef;
        for (const [k, tpl] of Object.entries(ltRef || {})) {
            if (typeof tpl === 'string' && /^cell\.\d+\.name$/.test(k)) cellNameMap.set(tpl.trim(), k);
        }
    }
    const key = cellNameMap.get(v.trim());
    return key ? t(key) : v;
}

// Vertimas su duomenimis: tf('cli.kodas_nukopijuotas', { gameId: 'ABC' })
function tf(key, data) {
    let text = t(key);
    if (data) {
        for (const k of Object.keys(data)) {
            let v = data[k];
            if (currentLang !== 'lt' && typeof v === 'string') v = trCellName(v);   // langelio pavadinimas – pasirinkta kalba
            text = text.split('{' + k + '}').join(v === undefined || v === null ? '' : String(v));
        }
    }
    return text;
}

// ============================================
// 🌐 SERVERIO TEKSTŲ VERTIMAS
// Serveris rašo lietuviškai pagal lt.json šablonus (srv.*, bot.*). Naršyklė atpažįsta
// šabloną ir parodo tą patį tekstą pasirinkta kalba.
// ============================================
let srvMatchers = null;
const srvCache = new Map();
function buildSrvMatchers() {
    const exact = new Map(), patterns = [], cellNames = new Map();
    for (const [key, tpl] of Object.entries(ltRef || {})) {
        if (typeof tpl === 'string' && /^cell\.\d+\.name$/.test(key)) cellNames.set(tpl.trim(), key);   // langelių pavadinimai
        if (typeof tpl !== 'string' || !(key.startsWith('srv.') || key.startsWith('bot.'))) continue;
        if (!/\{\w+\}/.test(tpl)) { exact.set(tpl, key); continue; }
        const names = [];
        const re = tpl.split(/(\{\w+\})/).map(part => {
            const m = part.match(/^\{(\w+)\}$/);
            if (m) { names.push(m[1]); return '([\\s\\S]*?)'; }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('');
        patterns.push({ key, names, re: new RegExp('^' + re + '$'), lit: tpl.replace(/\{\w+\}/g, '').length });
    }
    patterns.sort((a, b) => b.lit - a.lit);   // konkretesni šablonai – pirmiau
    srvMatchers = { exact, patterns, names: cellNames };
}
function trSrv(text, depth) {
    if (currentLang === 'lt' || typeof text !== 'string' || text.length < 2 || text.length > 1500) return text;
    if (srvCache.has(text)) return srvCache.get(text);
    if (!srvMatchers) buildSrvMatchers();
    let out = text;
    const trimmed = text.trim();
    const lead = text.slice(0, text.indexOf(trimmed)), tail = text.slice(text.indexOf(trimmed) + trimmed.length);
    const exactKey = srvMatchers.exact.get(trimmed);
    if (exactKey) out = lead + t(exactKey) + tail;
    else {
        for (const p of srvMatchers.patterns) {
            const m = trimmed.match(p.re);
            if (!m) continue;
            const data = {};
            p.names.forEach((n, i) => {
                const v = m[i + 1], nk = srvMatchers.names.get(v.trim());
                data[n] = nk ? t(nk) : ((depth || 0) < 2 ? trSrv(v, (depth || 0) + 1) : v);
            });
            out = lead + tf(p.key, data) + tail;
            break;
        }
    }
    if (srvCache.size > 3000) srvCache.clear();
    srvCache.set(text, out);
    return out;
}

// Saugumo klausimas DB saugomas lietuviškai – parodyti pasirinkta kalba (register.q1–q10)
function trQuestion(q) {
    if (!q || currentLang === 'lt') return q;
    for (let i = 1; i <= 10; i++) {
        if (ltRef && ltRef['register.q' + i] === q) return t('register.q' + i);
    }
    return q;
}

// ============================================
// 🌐 PERJUNGUS KALBĄ – jau ekrane esantys tekstai (pranešimai, žurnalas, užrašai)
// atpažįstami pagal ankstesnės kalbos šablonus ir perrašomi nauja kalba
// ============================================
function retranslateDom(fromDict) {
    if (!fromDict || fromDict === translations || !document.body) return;
    const exact = new Map(), patterns = [];
    for (const [key, tpl] of Object.entries(fromDict)) {
        if (typeof tpl !== 'string' || key.startsWith('_comment') || tpl.length < 2) continue;
        const target = translations[key];
        if (typeof target !== 'string' || target === tpl) continue;
        if (!/\{\w+\}/.test(tpl)) { if (!exact.has(tpl.trim())) exact.set(tpl.trim(), key); continue; }
        const chunks = tpl.split(/\{\w+\}/).map(c => c.trim()).filter(Boolean);
        const longest = chunks.sort((x, y) => y.length - x.length)[0] || '';
        if (longest.length < 3) continue;   // per bendras šablonas – praleisti
        const names = [];
        const re = tpl.split(/(\{\w+\})/).map(part => {
            const m = part.match(/^\{(\w+)\}$/);
            if (m) { names.push(m[1]); return '([\\s\\S]*?)'; }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('');
        patterns.push({ key, names, longest, re: new RegExp('^' + re.trim() + '$'), lit: tpl.replace(/\{\w+\}/g, '').length });
    }
    patterns.sort((x, y) => y.lit - x.lit);
    const conv = (text) => {
        const trimmed = text.trim();
        if (!trimmed) return text;
        const lead = text.slice(0, text.indexOf(trimmed)), tail = text.slice(text.indexOf(trimmed) + trimmed.length);
        const k = exact.get(trimmed);
        if (k) return lead + t(k) + tail;
        for (const p of patterns) {
            if (!trimmed.includes(p.longest)) continue;
            const m = trimmed.match(p.re);
            if (!m) continue;
            const data = {};
            p.names.forEach((n, i) => { const v = m[i + 1], kk = exact.get(v.trim()); data[n] = kk ? t(kk) : v; });
            return lead + tf(p.key, data) + tail;
        }
        // Sudėtiniai užrašai („Statybų taisyklė: 2. Atsistojus…“) – verčiam dalimis
        const parts = trimmed.split(/(: |\. )/);
        if (parts.length > 2) {
            let changed = false, ok = true;
            const outParts = parts.map(seg => {
                if (seg === ': ' || seg === '. ' || /^[\d\s🏗️👉#]*$/u.test(seg)) return seg;
                const m = seg.match(/^(\S+\s)?(.+)$/u);
                const kk = exact.get(seg.trim()) || (m && exact.get(m[2].trim()));
                if (kk) { changed = true; return (exact.get(seg.trim()) ? '' : (m[1] || '')) + t(kk); }
                ok = false; return seg;
            });
            if (changed && ok) return lead + outParts.join('') + tail;
        }
        return text;
    };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|INPUT)$/.test(n.parentNode.nodeName))
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
        const v = n.nodeValue;
        if (!v || v.length < 2 || v.length > 1500 || !/[A-Za-zĄ-žА-я]/.test(v)) continue;
        const out = conv(v);
        if (out !== v) n.nodeValue = out;
    }
    // užrašai mygtukų/laukų title ir placeholder atributuose
    document.querySelectorAll('[title],[placeholder]').forEach(el => {
        ['title', 'placeholder'].forEach(a => {
            const v = el.getAttribute(a);
            if (v && v.length > 1 && v.length < 300) { const o = conv(v); if (o !== v) el.setAttribute(a, o); }
        });
    });
}

// Iššokantys langai rodomi pasirinkta kalba
(function () {
    const _alert = window.alert, _confirm = window.confirm;
    window.alert = function (msg) { return _alert.call(window, trSrv(String(msg ?? ''))); };
    window.confirm = function (msg) { return _confirm.call(window, trSrv(String(msg ?? ''))); };
})();

// Ekrane atsiradę serverio tekstai (žurnalas, pranešimai, chat) – verčiami automatiškai
let srvObserver = null;
function translateNodeTree(root) {
    if (!root) return;
    if (root.nodeType === 3) {
        const v = root.nodeValue;
        const par = root.parentNode;
        if (par && /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(par.nodeName)) return;
        if (v && v.length > 2 && v.length < 1500 && /[A-Za-zĄ-ž]/.test(v)) {
            const tr = trSrv(v);
            if (tr !== v) root.nodeValue = tr;
        }
        return;
    }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.tagName === 'INPUT' || root.tagName === 'TEXTAREA') return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(n.parentNode.nodeName))
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => translateNodeTree(n));
}
function startSrvObserver() {
    if (currentLang === 'lt') { if (srvObserver) { srvObserver.disconnect(); srvObserver = null; } return; }
    if (srvObserver || !document.body || typeof MutationObserver === 'undefined') { if (document.body) translateNodeTree(document.body); return; }
    srvObserver = new MutationObserver(muts => {
        for (const m of muts) {
            if (m.type === 'characterData') translateNodeTree(m.target);
            else m.addedNodes.forEach(n => translateNodeTree(n));
        }
    });
    srvObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    translateNodeTree(document.body);
}

// ============================================
// ATNAUJINTI VISUS TEKSTUS
// ============================================
function updateAllTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key);
        if (text) el.textContent = text;
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = t(key);
        if (text) el.placeholder = text;
    });
    
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const text = t(key);
        if (text) el.title = text;
    });
    
    // 🆕 data-i18n-html — leidžia naudoti HTML žymas (<br>, <strong>)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const text = t(key);
        if (text) el.innerHTML = text;
    });
}

// ============================================
// PAKEISTI KALBĄ
// ============================================
async function changeLanguage(lang) {
    const success = await loadLanguage(lang);
    if (success) {
        updateLangButtons();
        
        // 🆕 Atnaujinti visus tekstus po kalbos pakeitimo
        setTimeout(() => {
            updateAllTexts();
            
            // 🆕 Atnaujinti lentą ir sąsają pagal naują kalbą
            if (typeof gameState !== 'undefined' && gameState && typeof updateBoard === 'function') {
                updateBoard(gameState);
                if (typeof updateUI === 'function') { try { updateUI(gameState); } catch (e) {} }
            }
            if (typeof waitingRoomState !== 'undefined' && waitingRoomState && typeof updateWaitingRoom === 'function') {
                try { updateWaitingRoom(waitingRoomState); } catch (e) {}
            }
        }, 100);
    }
}

// ============================================
// ATNAUJINTI KALBOS MYGTUKUS
// ============================================
function updateLangButtons() {
    document.querySelectorAll('.lang-select').forEach(sel => { if (sel.value !== currentLang) sel.value = currentLang; });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.dataset.lang === currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ============================================
// INICIJAVIMAS
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadLanguage(currentLang);
    updateLangButtons();
});

// ============================================
// 🆕 AUTOMATINIS data-i18n PRIDĖJIMAS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        autoAddDataI18n();
        // 🆕 Po autoAddDataI18n atnaujinti tekstus
        updateAllTexts();
        // console.log('🔄 updateAllTexts() po autoAddDataI18n');   ← 🆕 UŽKOMENTUOTA
    }, 500);
    
    // 🆕 Papildomas atnaujinimas po 1500ms (jei script.js ką nors perpiešė)
    setTimeout(() => {
        updateAllTexts();
        // console.log('🔄 Papildomas updateAllTexts() po 1500ms');   ← 🆕 UŽKOMENTUOTA
    }, 1500);
});

function autoAddDataI18n() {
    // Automatiškai prideda data-i18n prie visų elementų su tekstu
    const textMappings = {
        '📝 Registruotis': 'landing.register',
        '🔑 Prisijungti': 'landing.login',
        '🏆 Lyderiai': 'landing.leaders',
        '📖 Taisyklės': 'landing.rules',
        '🎮 Žaisti kaip svečias': 'landing.playAsGuest',
        '🎮 Žaisti': 'landing.play',
        '📊 Mano statistika': 'landing.stats',
        '🚪 Atsijungti': 'landing.logout',
        '🆕 Sukurti žaidimą': 'menu.createGame',
        '🔗 Prisijungti prie žaidimo': 'menu.joinGame',
        '🌐 Vieši stalai': 'menu.publicGames',
        '🔙 Atgal': 'menu.back',
        '🎲 Mesti': 'game.rollDice',
        '🏪 Prekyba': 'game.trade',
        '🏠 Statyti namą': 'game.buildHouse',
        '💀 Bankrotuoju': 'game.bankrupt',
        '🏚️ Griauti': 'game.demolish',
        '🏃 Pasitraukti': 'game.leave',
        '🗳️ Balsuoti': 'game.voteKick',
        '💬 CHAT': 'game.chat',
        '👥 ŽAIDĖJAI': 'game.players',
        '📜 ŽURNALAS': 'game.journal',
        '📢 PRANEŠIMAI': 'game.notifications',
        '👤 AŠ': 'game.iAm'
    };
    
    // Ieškome visų elementų, kurių tekstas sutampa su mappings
    document.querySelectorAll('button, h1, h2, h3, h4, p, label, span, a').forEach(el => {
        const text = el.textContent.trim();
        
        // Jei elementas jau turi data-i18n – praleisti
        if (el.hasAttribute('data-i18n')) return;
        if (el.hasAttribute('data-i18n-placeholder')) return;
        
        // Ieškome atitikmens
        for (const [key, i18nKey] of Object.entries(textMappings)) {
            if (text === key) {
                el.setAttribute('data-i18n', i18nKey);
                break;
            }
        }
    });
    
    // Placeholder'iai
    const placeholderMappings = {
        'Vardas (3-20 simbolių)': 'register.username',
        'El. paštas': 'register.email',
        'Slaptažodis (bent 6 simboliai)': 'register.password',
        'Pakartok slaptažodį': 'register.passwordConfirm',
        'Atsakymas (pvz., Rexas)': 'register.answer',
        'Vardas': 'login.username',
        'Slaptažodis': 'login.password',
        'Įvesk savo vardą': 'create.playerName',
        'Žaidimo kodas (pvz., ABC123)': 'join.gameCode',
        'Rašyk žinutę...': 'game.chatPlaceholder',
        'Dabartinis slaptažodis': 'stats.currentPassword',
        'Naujas slaptažodis (bent 6 simboliai)': 'stats.newPassword',
        'Pakartok naują slaptažodį': 'stats.confirmPassword'
    };
    
    document.querySelectorAll('input, select').forEach(el => {
        if (el.hasAttribute('data-i18n-placeholder')) return;
        
        const placeholder = el.getAttribute('placeholder');
        if (placeholder) {
            for (const [key, i18nKey] of Object.entries(placeholderMappings)) {
                if (placeholder === key) {
                    el.setAttribute('data-i18n-placeholder', i18nKey);
                    break;
                }
            }
        }
    });
    
    // console.log('✅ Automatinis data-i18n pridėjimas baigtas');   ← 🆕 UŽKOMENTUOTA
}
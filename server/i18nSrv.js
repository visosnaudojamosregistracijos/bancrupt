// ============================================
// server/i18nSrv.js – serverio tekstai iš public/lang/lt.json
// Serveris tekstus rašo lietuviškai (iš lt.json šablonų), o naršyklė juos
// atpažįsta pagal tą patį šabloną ir parodo žaidėjo pasirinkta kalba.
// ============================================

let LT = null;

function load() {
    if (LT) return LT;
    try {
        if (typeof window === 'undefined') {
            const fs = require('fs');
            const path = require('path');
            LT = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'lang', 'lt.json'), 'utf8'));
        } else {
            if (!window.__LT) return {};   // peržiūra naršyklėje: vertimai dar neįkelti
            LT = window.__LT;
        }
    } catch (e) {
        console.error('❌ Nepavyko įkelti public/lang/lt.json:', e.message);
        LT = {};
    }
    return LT;
}

// L('srv.game.notYourTurn', { player: 'Tomas' }) → „Ne tavo eilė“
function L(key, data) {
    let text = load()[key];
    if (typeof text !== 'string') {
        console.warn('⚠️ lt.json neturi rakto:', key);
        return key;
    }
    if (data) {
        for (const k of Object.keys(data)) {
            const v = data[k];
            text = text.split('{' + k + '}').join(v === undefined || v === null ? '' : String(v));
        }
    }
    return text;
}

// Atsitiktinė frazė iš sąrašo: raktai bot.start.1, bot.start.2 …
function Lpick(prefix) {
    const all = load();
    const keys = Object.keys(all).filter(k => k.startsWith(prefix + '.'));
    if (keys.length === 0) return null;
    return keys[Math.floor(Math.random() * keys.length)];
}

module.exports = { L, Lpick, reload() { LT = null; } };

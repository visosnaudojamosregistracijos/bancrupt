// ============================================
// i18n.js – KALBŲ SISTEMA
// ============================================

let currentLang = 'lt';  // 🔒 VISADA LT
let translations = {};

// ============================================
// ĮKELTI KALBĄ
// ============================================
async function loadLanguage(lang) {
    lang = 'lt';  // 🔒 VISADA LT
    
    try {
        const response = await fetch(`/lang/${lang}.json`);
        if (!response.ok) throw new Error('Nepavyko įkelti kalbos');
        translations = await response.json();
        currentLang = lang;
        localStorage.setItem('bancrupt_lang', lang);
        // console.log(`🌐 Kalba įkelta: ${lang}`);
        updateAllTexts();
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
    return translations[key] || key;
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
            console.log('🔄 updateAllTexts() po kalbos pakeitimo');
            
            // 🆕 Atnaujinti lentą pagal naują kalbą
            if (typeof gameState !== 'undefined' && gameState && typeof updateBoard === 'function') {
                updateBoard(gameState);
                console.log('🔄 updateBoard() po kalbos pakeitimo');
            }
        }, 100);
    }
}

// ============================================
// ATNAUJINTI KALBOS MYGTUKUS
// ============================================
function updateLangButtons() {
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
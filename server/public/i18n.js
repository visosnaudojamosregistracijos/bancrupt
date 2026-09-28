// ============================================
// i18n.js – KALBŲ SISTEMA
// ============================================

let currentLang = localStorage.getItem('bancrupt_lang') || 'lt';
let translations = {};

// ============================================
// ĮKELTI KALBĄ
// ============================================
async function loadLanguage(lang) {
    try {
        const response = await fetch(`/lang/${lang}.json`);
        if (!response.ok) throw new Error('Nepavyko įkelti kalbos');
        translations = await response.json();
        currentLang = lang;
        localStorage.setItem('bancrupt_lang', lang);
        console.log(`🌐 Kalba įkelta: ${lang}`);
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
}

// ============================================
// PAKEISTI KALBĄ
// ============================================
async function changeLanguage(lang) {
    const success = await loadLanguage(lang);
    if (success) {
        updateLangButtons();
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
    }, 500);
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
        '💀 BANKROTAS': 'game.bankrupt',
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
    
    console.log('✅ Automatinis data-i18n pridėjimas baigtas');
}
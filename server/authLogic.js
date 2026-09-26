// ============================================
// server/authLogic.js
// Registracijos, prisijungimo ir slaptažodžio atstatymo logika
// ============================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

// ============================================
// JWT KONFIGŪRACIJA
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'bancrupt-slaptas-raktas-2026';
const JWT_EXPIRES_IN = '7d'; // Tokenas galioja 7 dienas

// ============================================
// SAUGUMO KLAUSIMAI
// ============================================
const SECURITY_QUESTIONS = [
    'Koks tavo augintinio vardas?',
    'Kokiame mieste gimei?',
    'Koks tavo mėgstamiausias filmas?',
    'Koks tavo mokyklos pavadinimas?',
    'Koks tavo mėgstamiausias maistas?',
    'Koks tavo automobilio modelis?',
    'Kokia tavo motinos mergautinė pavardė?',
    'Koks tavo mėgstamiausias muzikos atlikėjas?',
    'Koks tavo svajonių atostogų tikslas?',
    'Koks tavo mėgstamiausias sportas?'
];

// ============================================
// PAGALBINĖS FUNKCIJOS
// ============================================

function generateToken(userId) {
    return jwt.sign(
        { userId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

function isValidUsername(username) {
    if (!username || typeof username !== 'string') return false;
    if (username.length < 3 || username.length > 20) return false;
    return /^[a-zA-Z0-9_-]+$/.test(username);
}

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 6;
}

function isValidSecurityQuestion(question) {
    return SECURITY_QUESTIONS.includes(question);
}

function isValidSecurityAnswer(answer) {
    if (!answer || typeof answer !== 'string') return false;
    return answer.trim().length >= 2 && answer.trim().length <= 100;
}

// ============================================
// REGISTRACIJA
// ============================================
async function register(username, email, password, securityQuestion, securityAnswer) {
    // Validacija
    if (!isValidUsername(username)) {
        return { error: 'Vardas turi būti 3-20 simbolių, tik raidės, skaičiai, _ ir -' };
    }
    if (!isValidEmail(email)) {
        return { error: 'Neteisingas el. pašto formatas' };
    }
    if (!isValidPassword(password)) {
        return { error: 'Slaptažodis turi būti bent 6 simbolių' };
    }
    if (!isValidSecurityQuestion(securityQuestion)) {
        return { error: 'Pasirink saugumo klausimą iš sąrašo' };
    }
    if (!isValidSecurityAnswer(securityAnswer)) {
        return { error: 'Atsakymas turi būti 2-100 simbolių' };
    }

    // Patikrinti ar vardas užimtas
    const existingUsername = await db.findUserByUsername(username);
    if (existingUsername) {
        return { error: 'Toks vardas jau užimtas' };
    }

    // Patikrinti ar el. paštas užimtas
    const existingEmail = await db.findUserByEmail(email);
    if (existingEmail) {
        return { error: 'Toks el. paštas jau registruotas' };
    }

    // Hash'uoti slaptažodį ir atsakymą
    const passwordHash = await bcrypt.hash(password, 10);
    const answerHash = await bcrypt.hash(securityAnswer.trim(), 10);

    // Sukurti vartotoją
    try {
        const userId = await db.createUser(
            username,
            email,
            passwordHash,
            securityQuestion,
            answerHash
        );
        const token = generateToken(userId);

        console.log(`✅ Naujas vartotojas: ${username} (ID: ${userId})`);

        return {
            success: true,
            userId,
            username,
            email,
            token
        };
    } catch (err) {
        console.error('❌ Registracijos klaida:', err);
        return { error: 'Nepavyko užregistruoti. Bandyk dar kartą.' };
    }
}

// ============================================
// PRISIJUNGIMAS
// ============================================
async function login(username, password) {
    if (!username || !password) {
        return { error: 'Įvesk vardą ir slaptažodį' };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: 'Neteisingas vardas arba slaptažodis' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
        return { error: 'Neteisingas vardas arba slaptažodis' };
    }

    await db.updateLastLogin(user.id);
    const token = generateToken(user.id);

    console.log(`✅ Prisijungė: ${user.username} (ID: ${user.id})`);

    return {
        success: true,
        userId: user.id,
        username: user.username,
        email: user.email,
        token
    };
}

// ============================================
// GAUTI VARTOTOJĄ PAGAL TOKENĄ
// ============================================
async function getUserFromToken(token) {
    const decoded = verifyToken(token);
    if (!decoded) return null;

    const user = await db.findUserById(decoded.userId);
    if (!user) return null;

    return {
        userId: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        lastLogin: user.last_login
    };
}

// ============================================
// SLAPTAŽODŽIO ATSTATYMAS – 1 ETAPAS
// Patikrinti vardą + el. paštą, grąžinti klausimą
// ============================================
async function verifyUserAndGetQuestion(username, email) {
    if (!username || !email) {
        return { error: 'Įvesk vardą ir el. paštą' };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: 'Vartotojas su tokiu vardu nerastas' };
    }

    if (user.email.toLowerCase() !== email.toLowerCase().trim()) {
        return { error: 'El. paštas nesutampa su registruotu' };
    }

    if (!user.security_question) {
        return { error: 'Šis vartotojas neturi saugumo klausimo. Susisiek su administratoriumi.' };
    }

    return {
        success: true,
        username: user.username,
        question: user.security_question
    };
}

// ============================================
// SLAPTAŽODŽIO ATSTATYMAS – 2 ETAPAS
// Patikrinti atsakymą
// ============================================
async function verifySecurityAnswer(username, email, answer) {
    if (!username || !email || !answer) {
        return { error: 'Trūksta duomenų' };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: 'Vartotojas nerastas' };
    }

    if (user.email.toLowerCase() !== email.toLowerCase().trim()) {
        return { error: 'El. paštas nesutampa' };
    }

    if (!user.security_answer_hash) {
        return { error: 'Šis vartotojas neturi saugumo atsakymo' };
    }

    // Tikslus palyginimas (ne jautrus dydžiui)
    const answerMatch = await bcrypt.compare(answer.trim(), user.security_answer_hash);
    if (!answerMatch) {
        return { error: 'Neteisingas atsakymas' };
    }

    return {
        success: true,
        username: user.username
    };
}

// ============================================
// SLAPTAŽODŽIO ATSTATYMAS – 3 ETAPAS
// Pakeisti slaptažodį
// ============================================
async function resetPassword(username, email, answer, newPassword) {
    // Patikrinti atsakymą
    const verifyResult = await verifySecurityAnswer(username, email, answer);
    if (verifyResult.error) {
        return { error: verifyResult.error };
    }

    // Patikrinti naują slaptažodį
    if (!isValidPassword(newPassword)) {
        return { error: 'Naujas slaptažodis turi būti bent 6 simbolių' };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: 'Vartotojas nerastas' };
    }

    // Hash'uoti naują slaptažodį
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atnaujinti DB
    await db.updatePassword(user.id, newPasswordHash);

    console.log(`🔑 Slaptažodis pakeistas: ${username} (ID: ${user.id})`);

    return {
        success: true,
        username: user.username
    };
}

// ============================================
// EKSPORTAS
// ============================================
module.exports = {
    register,
    login,
    verifyToken,
    getUserFromToken,
    verifyUserAndGetQuestion,
    verifySecurityAnswer,
    resetPassword,
    isValidUsername,
    isValidEmail,
    isValidPassword,
    SECURITY_QUESTIONS
};
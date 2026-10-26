// ============================================
// server/authLogic.js
// Registracijos, prisijungimo ir slaptažodžio atstatymo logika
// ============================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { L } = require('./i18nSrv');

// ============================================
// JWT KONFIGŪRACIJA
// ============================================
// 🆕 Saugumo patikra – JWT_SECRET privalomas
if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET nenustatytas! Sustabdomas serveris.');
    console.error('💡 Railway → Variables → pridėk JWT_SECRET');
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
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

function generateToken(userId, isAdmin = false) {
    return jwt.sign(
        { userId, is_admin: isAdmin },
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
        return { error: L('srv.auth.usernameRule') };
    }
    if (!isValidEmail(email)) {
        return { error: L('srv.auth.emailFormat') };
    }
    if (!isValidPassword(password)) {
        return { error: L('srv.auth.passwordMin') };
    }
    if (!isValidSecurityQuestion(securityQuestion)) {
        return { error: L('srv.auth.pickQuestion') };
    }
    if (!isValidSecurityAnswer(securityAnswer)) {
        return { error: L('srv.auth.answerLen') };
    }

    // Patikrinti ar vardas užimtas
    const existingUsername = await db.findUserByUsername(username);
    if (existingUsername) {
        return { error: L('srv.auth.usernameTaken') };
    }

    // Patikrinti ar el. paštas užimtas
    const existingEmail = await db.findUserByEmail(email);
    if (existingEmail) {
        return { error: L('srv.auth.emailTaken') };
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
        const token = generateToken(userId, false);   // ← PAKEISTA

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
        return { error: L('srv.auth.registerFailed') };
    }
}

// ============================================
// PRISIJUNGIMAS
// ============================================
async function login(username, password) {
    if (!username || !password) {
        return { error: L('srv.auth.enterNamePass') };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: L('srv.auth.wrongCredentials') };
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
        return { error: L('srv.auth.wrongCredentials') };
    }

    await db.updateLastLogin(user.id);
const token = generateToken(user.id, user.is_admin === true);

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
        isAdmin: user.is_admin === true,      // ← NAUJA
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
        return { error: L('srv.auth.enterNameEmail') };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: L('srv.auth.userNotFoundByName') };
    }

    if (user.email.toLowerCase() !== email.toLowerCase().trim()) {
        return { error: L('srv.auth.emailMismatchReg') };
    }

    if (!user.security_question) {
        return { error: L('srv.auth.noQuestion') };
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
        return { error: L('srv.auth.missingData') };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: L('srv.auth.userNotFound') };
    }

    if (user.email.toLowerCase() !== email.toLowerCase().trim()) {
        return { error: L('srv.auth.emailMismatch') };
    }

    if (!user.security_answer_hash) {
        return { error: L('srv.auth.noAnswer') };
    }

    // Tikslus palyginimas (ne jautrus dydžiui)
    const answerMatch = await bcrypt.compare(answer.trim(), user.security_answer_hash);
    if (!answerMatch) {
        return { error: L('srv.auth.wrongAnswer') };
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
        return { error: L('srv.auth.newPasswordMin') };
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: L('srv.auth.userNotFound') };
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
// 🆕 SLAPTAŽODŽIO KEITIMAS (prisijungus)
// ============================================
async function changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
        return { error: L('srv.auth.enterCurNew') };
    }

    if (!isValidPassword(newPassword)) {
        return { error: L('srv.auth.newPasswordMin') };
    }

    if (currentPassword === newPassword) {
        return { error: L('srv.auth.sameAsCurrent') };
    }

    const user = await db.findUserById(userId);
    if (!user) {
        return { error: L('srv.auth.userNotFound') };
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
        return { error: L('srv.auth.wrongCurrent') };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await db.updatePassword(userId, newPasswordHash);

    console.log(`🔑 Slaptažodis pakeistas: ${user.username} (ID: ${userId})`);

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
    changePassword,        // 🆕
    isValidUsername,
    isValidEmail,
    isValidPassword,
    SECURITY_QUESTIONS
};
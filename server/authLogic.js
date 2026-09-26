// ============================================
// server/authLogic.js
// Registracijos ir prisijungimo logika
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
// PAGALBINĖS FUNKCIJOS
// ============================================

// Sukurti JWT tokeną
function generateToken(userId) {
    return jwt.sign(
        { userId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// Patikrinti JWT tokeną
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// Patikrinti ar vardas tinkamas
function isValidUsername(username) {
    if (!username || typeof username !== 'string') return false;
    if (username.length < 3 || username.length > 20) return false;
    // Tik raidės, skaičiai, _ ir -
    return /^[a-zA-Z0-9_-]+$/.test(username);
}

// Patikrinti ar el. paštas tinkamas
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Patikrinti ar slaptažodis pakankamai stiprus
function isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 6;
}

// ============================================
// REGISTRACIJA
// ============================================
async function register(username, email, password) {
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

    // Hash'uoti slaptažodį
    const passwordHash = await bcrypt.hash(password, 10);

    // Sukurti vartotoją
    try {
        const userId = await db.createUser(username, email, passwordHash);
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
    // Validacija
    if (!username || !password) {
        return { error: 'Įvesk vardą ir slaptažodį' };
    }

    // Rasti vartotoją
    const user = await db.findUserByUsername(username);
    if (!user) {
        return { error: 'Neteisingas vardas arba slaptažodis' };
    }

    // Patikrinti slaptažodį
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
        return { error: 'Neteisingas vardas arba slaptažodis' };
    }

    // Atnaujinti paskutinį prisijungimą
    await db.updateLastLogin(user.id);

    // Sukurti tokeną
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
// EKSPORTAS
// ============================================
module.exports = {
    register,
    login,
    verifyToken,
    getUserFromToken,
    isValidUsername,
    isValidEmail,
    isValidPassword
};
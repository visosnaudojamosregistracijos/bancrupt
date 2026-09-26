// ============================================
// server/routes/auth.js
// Registracijos, prisijungimo ir slaptažodžio atstatymo API
// ============================================

const express = require('express');
const router = express.Router();
const authLogic = require('../authLogic');
const db = require('../db');

// ============================================
// GET /api/auth/security-questions
// Grąžinti saugumo klausimų sąrašą
// ============================================
router.get('/security-questions', (req, res) => {
    res.json({
        success: true,
        questions: authLogic.SECURITY_QUESTIONS
    });
});

// ============================================
// POST /api/auth/register
// Registracija
// ============================================
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, securityQuestion, securityAnswer } = req.body;

        if (!username || !email || !password || !securityQuestion || !securityAnswer) {
            return res.status(400).json({ 
                error: 'Trūksta duomenų (username, email, password, securityQuestion, securityAnswer)' 
            });
        }

        const result = await authLogic.register(
            username, 
            email, 
            password, 
            securityQuestion, 
            securityAnswer
        );

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            userId: result.userId,
            username: result.username,
            email: result.email,
            token: result.token
        });

    } catch (err) {
        console.error('❌ /register klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

// ============================================
// POST /api/auth/login
// Prisijungimas
// ============================================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Įvesk vardą ir slaptažodį' 
            });
        }

        const result = await authLogic.login(username, password);

        if (result.error) {
            return res.status(401).json({ error: result.error });
        }

        res.json({
            success: true,
            userId: result.userId,
            username: result.username,
            email: result.email,
            token: result.token
        });

    } catch (err) {
        console.error('❌ /login klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

// ============================================
// GET /api/auth/me
// Gauti savo profilį (pagal tokeną)
// ============================================
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Nėra tokeno' });
        }

        const token = authHeader.substring(7);
        const user = await authLogic.getUserFromToken(token);

        if (!user) {
            return res.status(401).json({ error: 'Neteisingas arba pasibaigęs tokenas' });
        }

        const stats = await db.getUserStats(user.userId);

        res.json({
            success: true,
            user: {
                userId: user.userId,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            },
            stats: stats || {
                games_played: 0,
                games_won: 0,
                total_money_won: 0,
                total_money_lost: 0,
                houses_built: 0,
                properties_bought: 0
            }
        });

    } catch (err) {
        console.error('❌ /me klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

// ============================================
// GET /api/auth/stats/:userId
// Gauti kito žaidėjo statistiką
// ============================================
router.get('/stats/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Neteisingas userId' });
        }

        const user = await db.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Vartotojas nerastas' });
        }

        const stats = await db.getUserStats(userId);

        res.json({
            success: true,
            username: user.username,
            stats: stats || {
                games_played: 0,
                games_won: 0,
                total_money_won: 0,
                total_money_lost: 0,
                houses_built: 0,
                properties_bought: 0
            }
        });

    } catch (err) {
        console.error('❌ /stats klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

// ============================================
// 🆕 GET /api/auth/leaders
// Gauti Top 10 žaidėjų
// ============================================
router.get('/leaders', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const leaders = await db.getTopPlayers(limit);

        res.json({
            success: true,
            leaders: leaders,
            count: leaders.length
        });

    } catch (err) {
        console.error('❌ /leaders klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

// ============================================
// SLAPTAŽODŽIO ATSTATYMAS
// ============================================

// 1 ETAPAS: Patikrinti vardą + el. paštą, grąžinti klausimą
router.post('/forgot-password/verify-user', async (req, res) => {
    try {
        const { username, email } = req.body;

        if (!username || !email) {
            return res.status(400).json({ error: 'Įvesk vardą ir el. paštą' });
        }

        const result = await authLogic.verifyUserAndGetQuestion(username, email);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            username: result.username,
            question: result.question
        });

    } catch (err) {
        console.error('❌ /forgot-password/verify-user klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

// 2 ETAPAS: Patikrinti atsakymą
router.post('/forgot-password/verify-answer', async (req, res) => {
    try {
        const { username, email, answer } = req.body;

        if (!username || !email || !answer) {
            return res.status(400).json({ error: 'Trūksta duomenų' });
        }

        const result = await authLogic.verifySecurityAnswer(username, email, answer);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            username: result.username,
            message: 'Atsakymas teisingas. Galite pakeisti slaptažodį.'
        });

    } catch (err) {
        console.error('❌ /forgot-password/verify-answer klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

// 3 ETAPAS: Pakeisti slaptažodį
router.post('/forgot-password/reset', async (req, res) => {
    try {
        const { username, email, answer, newPassword } = req.body;

        if (!username || !email || !answer || !newPassword) {
            return res.status(400).json({ error: 'Trūksta duomenų' });
        }

        const result = await authLogic.resetPassword(username, email, answer, newPassword);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            username: result.username,
            message: 'Slaptažodis sėkmingai pakeistas!'
        });

    } catch (err) {
        console.error('❌ /forgot-password/reset klaida:', err);
        res.status(500).json({ error: 'Serverio klaida' });
    }
});

module.exports = router;
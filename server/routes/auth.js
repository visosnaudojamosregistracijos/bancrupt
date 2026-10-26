// ============================================
// server/routes/auth.js
// Registracijos, prisijungimo ir slaptažodžio atstatymo API
// ============================================

const express = require('express');
const router = express.Router();
const authLogic = require('../authLogic');
const db = require('../db');
const { L } = require('../i18nSrv');
const jwt = require('jsonwebtoken');

// ============================================
// GET /api/auth/security-questions
// ============================================
router.get('/security-questions', (req, res) => {
    res.json({
        success: true,
        questions: authLogic.SECURITY_QUESTIONS
    });
});

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, securityQuestion, securityAnswer } = req.body;

        if (!username || !email || !password || !securityQuestion || !securityAnswer) {
            return res.status(400).json({ 
                error: L('srv.auth.missingRegData') 
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
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                error: L('srv.auth.enterNamePass') 
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
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// GET /api/auth/me
// ============================================
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: L('srv.auth.noToken') });
        }

        const token = authHeader.substring(7);
        const user = await authLogic.getUserFromToken(token);

        if (!user) {
            return res.status(401).json({ error: L('srv.auth.badToken') });
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
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// GET /api/auth/stats/:userId
// ============================================
router.get('/stats/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ error: L('srv.auth.badUserId') });
        }

        const user = await db.findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: L('srv.auth.userNotFound') });
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
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// GET /api/auth/leaders
// ============================================
router.get('/leaders', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);   // 🛡️ ne daugiau 100
        const leaders = await db.getTopPlayers(limit);

        res.json({
            success: true,
            leaders: leaders,
            count: leaders.length
        });

    } catch (err) {
        console.error('❌ /leaders klaida:', err);
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// GET /api/auth/history
// ============================================
router.get('/history', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: L('srv.auth.noToken') });
        }

        const token = authHeader.substring(7);
        const user = await authLogic.getUserFromToken(token);
        if (!user) {
            return res.status(401).json({ error: L('srv.auth.badTokenShort') });
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);   // 🛡️ ne daugiau 100
        const history = await db.getGameHistory(user.userId, limit);

        res.json({
            success: true,
            history: history,
            count: history.length
        });

    } catch (err) {
        console.error('❌ /history klaida:', err);
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// SLAPTAŽODŽIO ATSTATYMAS
// ============================================

// 1 ETAPAS: Patikrinti vardą + el. paštą
router.post('/forgot-password/verify-user', async (req, res) => {
    try {
        const { username, email } = req.body;

        if (!username || !email) {
            return res.status(400).json({ error: L('srv.auth.enterNameEmail') });
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
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// 2 ETAPAS: Patikrinti atsakymą
router.post('/forgot-password/verify-answer', async (req, res) => {
    try {
        const { username, email, answer } = req.body;

        if (!username || !email || !answer) {
            return res.status(400).json({ error: L('srv.auth.missingData') });
        }

        const result = await authLogic.verifySecurityAnswer(username, email, answer);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            username: result.username,
            message: L('srv.auth.answerOk')
        });

    } catch (err) {
        console.error('❌ /forgot-password/verify-answer klaida:', err);
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// 3 ETAPAS: Pakeisti slaptažodį
router.post('/forgot-password/reset', async (req, res) => {
    try {
        const { username, email, answer, newPassword } = req.body;

        if (!username || !email || !answer || !newPassword) {
            return res.status(400).json({ error: L('srv.auth.missingData') });
        }

        const result = await authLogic.resetPassword(username, email, answer, newPassword);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            username: result.username,
            message: L('srv.auth.passwordChanged')
        });

    } catch (err) {
        console.error('❌ /forgot-password/reset klaida:', err);
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// POST /api/auth/change-password
// ============================================
router.post('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: L('srv.auth.noToken') });
        }

        const token = authHeader.substring(7);
        const user = await authLogic.getUserFromToken(token);
        if (!user) {
            return res.status(401).json({ error: L('srv.auth.badToken') });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: L('srv.auth.enterCurNew') });
        }

        const result = await authLogic.changePassword(user.userId, currentPassword, newPassword);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            username: result.username,
            message: L('srv.auth.passwordChanged')
        });

    } catch (err) {
        console.error('❌ /change-password klaida:', err);
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

// ============================================
// 📬 MANO PRANEŠIMAI
// ============================================

// GET /api/auth/my-feedback — žaidėjo pranešimai
router.get('/my-feedback', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let userId = null;
        
        // Jei prisijungęs — gauti userId
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId;
            } catch (err) {
                console.warn('⚠️ Blogas token my-feedback:', err.message);
            }
        }
        
        // Jei nėra userId — grąžinti tuščią
        if (!userId) {
            return res.json({ feedback: [] });
        }
        
        const result = await db.pool.query(`
            SELECT id, type, message, status, admin_response, 
                   responded_at, responded_by, created_at
            FROM feedback
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId]);
        
        console.log(`📬 Mano pranešimai (userId=${userId}): ${result.rows.length}`);
        
        res.json({ feedback: result.rows });
        
    } catch (err) {
        console.error('❌ my-feedback klaida:', err);
        res.status(500).json({ error: L('srv.auth.serverError') });
    }
});

module.exports = router;
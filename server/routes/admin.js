// Server/routes/admin.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { getServerStats, getStatsSummary } = require('../stats');  // ← NAUJA

// 🆕 WebSocket instancija (bus nustatyta iš server.js)
let io = null;

function setIO(ioInstance) {
    io = ioInstance;
    console.log('🔌 adminRoutes: io prijungtas');
}

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: false
});

// Middleware: tik admin
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Nėra token' });
    }
    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.is_admin) {
            return res.status(403).json({ error: 'Ne admin' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Blogas token' });
    }
}

// GET /api/admin/users — visi vartotojai
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, emoji, is_admin, created_at FROM users ORDER BY id'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('admin/users klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// POST /api/admin/emoji — priskirti emoji
router.post('/emoji', requireAdmin, async (req, res) => {
    const { userId, emoji } = req.body;
    if (!userId || !emoji) {
        return res.status(400).json({ error: 'Trūksta userId arba emoji' });
    }
    try {
        await pool.query(
            'UPDATE users SET emoji = $1 WHERE id = $2',
            [emoji, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('admin/emoji klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// ============================================
// 🆕 BOARD CELLS API
// ============================================

// GET /api/admin/board — visi langeliai (boardData + DB override)
router.get('/board', requireAdmin, async (req, res) => {
    try {
        const boardData = require('../boardData');
        const dbOverrides = await db.getBoardCells();

        const overrideMap = new Map();
        dbOverrides.forEach(o => overrideMap.set(o.cell_index, o));

        const merged = boardData.map(cell => {
            const override = overrideMap.get(cell.id);
            if (!override) {
                return { ...cell, _hasOverride: false };
            }
            return {
                id: cell.id,
                name: override.name ?? cell.name,
                type: override.type ?? cell.type,
                color: override.color ?? cell.color,
                color2: override.color2 ?? null,
                cost: override.cost ?? cell.cost,
                icon: override.icon ?? cell.icon,
                music: override.music ?? null,
                font_size: override.font_size ?? 14,
                font_color: override.font_color ?? null,
                description: override.description ?? null,
                custom_data: override.custom_data ?? null,
                _hasOverride: true,
                _updatedAt: override.updated_at
            };
        });

        res.json(merged);
    } catch (err) {
        console.error('admin/board klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// GET /api/admin/board/:index — vienas langelis
router.get('/board/:index', requireAdmin, async (req, res) => {
    try {
        const cellIndex = parseInt(req.params.index);
        if (isNaN(cellIndex) || cellIndex < 0 || cellIndex > 51) {
            return res.status(400).json({ error: 'Neteisingas indeksas (0-51)' });
        }

        const boardData = require('../boardData');
        const defaultCell = boardData.find(c => c.id === cellIndex);
        const override = await db.getBoardCell(cellIndex);

        const merged = {
            id: cellIndex,
            name: override?.name ?? defaultCell?.name,
            type: override?.type ?? defaultCell?.type,
            color: override?.color ?? defaultCell?.color,
            color2: override?.color2 ?? null,
            cost: override?.cost ?? defaultCell?.cost,
            icon: override?.icon ?? defaultCell?.icon,
            music: override?.music ?? null,
            font_size: override?.font_size ?? 14,
            font_color: override?.font_color ?? null,
            description: override?.description ?? null,
            custom_data: override?.custom_data ?? null,
            _hasOverride: !!override
        };

        res.json(merged);
    } catch (err) {
        console.error('admin/board/:index klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// POST /api/admin/board/:index — išsaugoti pakeitimą
router.post('/board/:index', requireAdmin, async (req, res) => {
    try {
        const cellIndex = parseInt(req.params.index);
        if (isNaN(cellIndex) || cellIndex < 0 || cellIndex > 51) {
            return res.status(400).json({ error: 'Neteisingas indeksas (0-51)' });
        }

        const {
            name, type, color, color2, cost, icon,
            music, font_size, font_color,
            description, custom_data
        } = req.body;

        await db.upsertBoardCell(cellIndex, {
            name, type, color, color2, cost, icon,
            music, font_size, font_color,
            description, custom_data
        });

        // 🆕 Atnaujinti cache ir pranešti visiems žaidėjams
        const Game = require('../gameLogic');
        await Game.loadBoardCache();

        if (io) {
            const updatedBoard = Game.getBoardCache();
            io.emit('boardUpdated', updatedBoard);
            console.log(`📡 boardUpdated išsiųstas (langelis ${cellIndex})`);
        }

        res.json({ success: true, cell_index: cellIndex });
    } catch (err) {
        console.error('admin/board POST klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// DELETE /api/admin/board/:index — ištrinti override
router.delete('/board/:index', requireAdmin, async (req, res) => {
    try {
        const cellIndex = parseInt(req.params.index);
        if (isNaN(cellIndex) || cellIndex < 0 || cellIndex > 51) {
            return res.status(400).json({ error: 'Neteisingas indeksas (0-51)' });
        }

        await db.deleteBoardCellOverride(cellIndex);

        // 🆕 Atnaujinti cache ir pranešti visiems žaidėjams
        const Game = require('../gameLogic');
        await Game.loadBoardCache();

        if (io) {
            const updatedBoard = Game.getBoardCache();
            io.emit('boardUpdated', updatedBoard);
            console.log(`📡 boardUpdated išsiųstas (ištrintas override ${cellIndex})`);
        }

        res.json({ success: true, cell_index: cellIndex });
    } catch (err) {
        console.error('admin/board DELETE klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// ============================================
// 🆕 CENTER CELLS API (vidurio langeliai)
// ============================================

// GET /api/admin/center — visi 6 vidurio langeliai
router.get('/center', requireAdmin, async (req, res) => {
    try {
        const cells = await db.getCenterCells();
        res.json(cells);
    } catch (err) {
        console.error('admin/center klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// POST /api/admin/center/:id — išsaugoti vidurio langelį
router.post('/center/:id', requireAdmin, async (req, res) => {
    try {
        const cellId = parseInt(req.params.id);
        if (isNaN(cellId) || cellId < 1 || cellId > 6) {
            return res.status(400).json({ error: 'Neteisingas ID (1-6)' });
        }

        const {
            title, title_color, title_size,
            title_size_min, title_size_max,
            bg_color, bg_color2, border_color,
            font_color, font_size,
            font_size_min, font_size_max,
            icon, custom_data,
            myinfo_name_size, myinfo_name_color,
            myinfo_money_size, myinfo_money_color,
            myinfo_text_size, myinfo_text_color
        } = req.body;

        await db.upsertCenterCell(cellId, {
            title, title_color, title_size,
            title_size_min, title_size_max,
            bg_color, bg_color2, border_color,
            font_color, font_size,
            font_size_min, font_size_max,
            icon, custom_data,
            myinfo_name_size, myinfo_name_color,
            myinfo_money_size, myinfo_money_color,
            myinfo_text_size, myinfo_text_color
        });

        // 🆕 Pranešti visiems žaidėjams
        if (io) {
            const updatedCells = await db.getCenterCells();
            io.emit('centerUpdated', updatedCells);
            console.log(`📡 centerUpdated išsiųstas (langelis ${cellId})`);
        }

        res.json({ success: true, cell_id: cellId });
    } catch (err) {
        console.error('admin/center POST klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// ============================================
// 🆕 SOUND SETTINGS API (garso nustatymai)
// ============================================

// GET /api/admin/sounds — gauti garso nustatymus
router.get('/sounds', requireAdmin, async (req, res) => {
    try {
        const settings = await db.getSoundSettings();
        res.json(settings);
    } catch (err) {
        console.error('admin/sounds GET klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// POST /api/admin/sounds — išsaugoti garso nustatymus
router.post('/sounds', requireAdmin, async (req, res) => {
    try {
        const {
            player_control_enabled,
            default_mode,
            default_sfx_volume,
            default_sound_levels
        } = req.body;

        await db.updateSoundSettings({
            player_control_enabled,
            default_mode,
            default_sfx_volume,
            default_sound_levels
        });

        // 🆕 Pranešti visiems žaidėjams, kad nustatymai pasikeitė
        if (io) {
            const updatedSettings = await db.getSoundSettings();
            io.emit('soundSettingsUpdated', updatedSettings);
            console.log(`📡 soundSettingsUpdated išsiųstas`);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('admin/sounds POST klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// ============================================
// 🆕 SOUND FILES API (garso failai)
// ============================================

// GET /api/admin/sound-files — gauti visus garso failus
router.get('/sound-files', requireAdmin, async (req, res) => {
    try {
        const files = await db.getSoundFiles();
        res.json(files);
    } catch (err) {
        console.error('admin/sound-files GET klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// POST /api/admin/sound-files/:name — išsaugoti garso failą
router.post('/sound-files/:name', requireAdmin, async (req, res) => {
    try {
        const soundName = req.params.name;
        const { file_path } = req.body;

        if (!file_path) {
            return res.status(400).json({ error: 'Trūksta file_path' });
        }

        await db.updateSoundFile(soundName, file_path);

        // 🆕 Pranešti visiems žaidėjams
        if (io) {
            const updatedFiles = await db.getSoundFiles();
            io.emit('soundFilesUpdated', updatedFiles);
            console.log(`📡 soundFilesUpdated išsiųstas`);
        }

        res.json({ success: true, sound_name: soundName });
    } catch (err) {
        console.error('admin/sound-files POST klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// ============================================
// 🆕 SOUNDS LIST API (visi .mp3 failai)
// ============================================

// GET /api/admin/sounds-list — visi .mp3 failai sounds/ kataloge
router.get('/sounds-list', requireAdmin, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const soundsDir = path.join(__dirname, '..', 'public', 'sounds');
        
        console.log(`📁 Skaitoma: ${soundsDir}`);
        
        const files = fs.readdirSync(soundsDir)
            .filter(f => f.endsWith('.mp3'))
            .sort()
            .map(f => 'sounds/' + f);
        
        console.log(`📁 Rasta ${files.length} .mp3 failų`);
        
        res.json(files);
    } catch (err) {
        console.error('admin/sounds-list klaida:', err);
        res.status(500).json({ error: 'Klaida skaitant failus' });
    }
});

// ============================================
// 🆕 STATISTIKA   ← NAUJA SEKCIJA!
// ============================================

// GET /api/admin/stats — pilna statistika
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const games = global.games || req.app.get('games') || {};
        const stats = getServerStats(games);
        res.json(stats);
    } catch (err) {
        console.error('admin/stats klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// GET /api/admin/stats/summary — trumpa statistika
router.get('/stats/summary', requireAdmin, async (req, res) => {
    try {
        const games = global.games || req.app.get('games') || {};
        const stats = getStatsSummary(games);
        res.json(stats);
    } catch (err) {
        console.error('admin/stats/summary klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// ============================================
// 🆕 BOARD SETTINGS (lentos nustatymai)
// ============================================

// GET /api/admin/board-settings — gauti lentos nustatymus
router.get('/board-settings', requireAdmin, async (req, res) => {
    try {
        const settings = await db.getBoardSettings();
        res.json(settings);
    } catch (err) {
        console.error('admin/board-settings GET klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

// POST /api/admin/board-settings — išsaugoti lentos nustatymus
router.post('/board-settings', requireAdmin, async (req, res) => {
    try {
        // 🆕 Perduodam VISKĄ, ką gaunam iš frontend (senus + naujus laukus)
        await db.updateBoardSettings(req.body);

        // 🆕 Pranešti visiems žaidėjams
        if (io) {
            const updatedSettings = await db.getBoardSettings();
            io.emit('boardSettingsUpdated', updatedSettings);
            console.log(`📡 boardSettingsUpdated išsiųstas`);
        }

        res.json({ success: true, settings: await db.getBoardSettings() });
    } catch (err) {
        console.error('admin/board-settings POST klaida:', err);
        res.status(500).json({ error: 'DB klaida' });
    }
});

module.exports = router;
module.exports.setIO = setIO;
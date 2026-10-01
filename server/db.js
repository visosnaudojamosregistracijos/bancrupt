// ============================================
// server/db.js
// PostgreSQL duomenų bazės valdymas
// ============================================

// Lokaliai įkelti .env (Railway'e environment variable)
require('dotenv').config();

const { Pool } = require('pg');

// ============================================
// POSTGRESQL PRISIJUNGIMAS
// ============================================
const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGHOST === 'localhost' ? false : {
        rejectUnauthorized: false,
        require: true
    }
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL klaida:', err);
});

// ============================================
// LENTELIŲ SUKŪRIMAS
// ============================================
async function initDatabase() {
    try {
        // Vartotojų lentelė
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                security_question TEXT,
                security_answer_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);

        // 🆕 Pridėti stulpelius prie esamos lentelės
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS security_question TEXT,
            ADD COLUMN IF NOT EXISTS security_answer_hash TEXT
        `);

        // Statistikos lentelė
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stats (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                games_played INTEGER DEFAULT 0,
                games_won INTEGER DEFAULT 0,
                total_money_won INTEGER DEFAULT 0,
                total_money_lost INTEGER DEFAULT 0,
                houses_built INTEGER DEFAULT 0,
                properties_bought INTEGER DEFAULT 0,
                bankrupts INTEGER DEFAULT 0
            )
        `);

        // 🆕 Pridėti stulpelį prie esamos lentelės (jei jos nėra)
        await pool.query(`
            ALTER TABLE stats 
            ADD COLUMN IF NOT EXISTS bankrupts INTEGER DEFAULT 0
        `);

        // 🆕 Žaidimų istorijos lentelė
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                game_id VARCHAR(20),
                result VARCHAR(20) NOT NULL,
                money INTEGER DEFAULT 0,
                players_count INTEGER DEFAULT 0,
                houses_built INTEGER DEFAULT 0,
                properties_bought INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 🆕 Lentos langelių override lentelė
        await pool.query(`
            CREATE TABLE IF NOT EXISTS board_cells (
                cell_index INTEGER PRIMARY KEY,
                name TEXT,
                type TEXT,
                color TEXT,
                color2 TEXT,
                cost INTEGER,
                icon TEXT,
                music TEXT,
                font_size INTEGER DEFAULT 14,
                font_color TEXT,
                description TEXT,
                custom_data JSONB,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Pridėti color2 stulpelį jei jo nėra
        await pool.query(`
            ALTER TABLE board_cells 
            ADD COLUMN IF NOT EXISTS color2 TEXT
        `);

        // 🆕 Vidurio langelių lentelė
        await pool.query(`
            CREATE TABLE IF NOT EXISTS center_cells (
                cell_id INTEGER PRIMARY KEY,
                title TEXT,
                title_color TEXT,
                title_size INTEGER DEFAULT 10,
                title_size_min INTEGER DEFAULT 8,
                title_size_max INTEGER DEFAULT 16,
                bg_color TEXT,
                bg_color2 TEXT,
                border_color TEXT,
                font_color TEXT,
                font_size INTEGER DEFAULT 13,
                font_size_min INTEGER DEFAULT 10,
                font_size_max INTEGER DEFAULT 18,
                icon TEXT,
                custom_data JSONB,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 🆕 Pridėti 6 naujus stulpelius (jei jų nėra)
        await pool.query(`
            ALTER TABLE center_cells 
            ADD COLUMN IF NOT EXISTS myinfo_name_size INTEGER,
            ADD COLUMN IF NOT EXISTS myinfo_name_color TEXT,
            ADD COLUMN IF NOT EXISTS myinfo_money_size INTEGER,
            ADD COLUMN IF NOT EXISTS myinfo_money_color TEXT,
            ADD COLUMN IF NOT EXISTS myinfo_text_size INTEGER,
            ADD COLUMN IF NOT EXISTS myinfo_text_color TEXT
        `);

        // 🆕 Garso nustatymų lentelė   ← NAUJA! ČIA!
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sound_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                player_control_enabled BOOLEAN DEFAULT true,
                default_mode TEXT DEFAULT 'my',
                default_sfx_volume INTEGER DEFAULT 50,
                default_sound_levels JSONB DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 🆕 Įterpti default reikšmę (jei nėra)
        await pool.query(`
            INSERT INTO sound_settings (id) 
            VALUES (1) 
            ON CONFLICT (id) DO NOTHING
        `);

        // 🆕 Garso failų lentelė   ← NAUJA!
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sound_files (
                sound_name TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 🆕 Užpildyti default garso failais   ← NAUJA!
        await pool.query(`
            INSERT INTO sound_files (sound_name, file_path, description) VALUES
                ('dice', 'sounds/dice.mp3', '🎲 Kauliukų metimas'),
                ('move', 'sounds/move.mp3', '🚶 Judėjimas'),
                ('click', 'sounds/click.mp3', '👆 Paspaudimas'),
                ('your-turn', 'sounds/your-turn.mp3', '🎵 Tavo eilė'),
                ('cash', 'sounds/cash.mp3', '💰 Pinigų gavimas'),
                ('pay', 'sounds/pay.mp3', '💸 Pinigų mokėjimas'),
                ('pay1', 'sounds/pay1.mp3', '💸 Nuomos mokėjimas'),
                ('rent-received', 'sounds/cash.mp3', '💰 Nuomos gavimas'),
                ('buy', 'sounds/buy.mp3', '🏠 Pirkimas'),
                ('build', 'sounds/build.mp3', '🏗️ Statyba'),
                ('hotel', 'sounds/hotel.mp3', '🏨 Viešbutis'),
                ('demolish', 'sounds/demolish.mp3', '🏚️ Griovimas'),
                ('tax', 'sounds/tax.mp3', '💸 Mokesčiai'),
                ('latras', 'sounds/latras.mp3', '🍺 Latrų baras'),
                ('pirtis', 'sounds/pirtis.mp3', '🧖 Pirtis'),
                ('hospital', 'sounds/hospital.mp3', '🏥 Ligoninė'),
                ('birthday', 'sounds/birthday.mp3', '🎂 Gimtadienis'),
                ('chance', 'sounds/chance.mp3', '🎲 Šansas'),
                ('special', 'sounds/special.mp3', '⭐ Specialus'),
                ('dujos', 'sounds/dujos.mp3', '🔥 Dujos'),
                ('siuksles', 'sounds/siuksles.mp3', '🗑️ Šiukšlės'),
                ('elektra', 'sounds/elektra.mp3', '💡 Elektra'),
                ('vanduo', 'sounds/vanduo.mp3', '💧 Vanduo'),
                ('air-port', 'sounds/air-port.mp3', '✈️ Oro uostas'),
                ('train', 'sounds/train.mp3', '🚂 Traukinių stotis'),
                ('port', 'sounds/port.mp3', '⚓ Uostas'),
                ('bus', 'sounds/bus.mp3', '🚌 Autobusų stotis'),
                ('spa', 'sounds/spa.mp3', '🛀 SPA'),
                ('baseinas', 'sounds/baseinas.mp3', '🏊 Baseinas'),
                ('papludimys', 'sounds/papludimys.mp3', '🏖️ Paplūdimys'),
                ('jail', 'sounds/jail.mp3', '⛓️ Kalėjimas'),
                ('jail_in', 'sounds/jail_in.mp3', '🚔 Į kalėjimą'),
                ('jail_out', 'sounds/jail_out.mp3', '🚪 Iš kalėjimo'),
                ('trade', 'sounds/trade.mp3', '🤝 Prekyba'),
                ('auction', 'sounds/auction.mp3', '🔨 Aukcionas'),
                ('start', 'sounds/start.mp3', '🏁 Start'),
                ('game-start', 'sounds/game-start.mp3', '🎮 Žaidimo startas'),
                ('win', 'sounds/win.mp3', '🏆 Laimėjimas'),
                ('celebrate', 'sounds/celebrate.mp3', '🎉 Šventimas'),
                ('gameover', 'sounds/gameover.mp3', '🏁 Žaidimo pabaiga'),
                ('bankrupt', 'sounds/bankrupt.mp3', '💀 Bankrotas'),
                ('notification', 'sounds/notification.mp3', '📢 Pranešimas'),
                ('error', 'sounds/error.mp3', '❌ Klaida')
            ON CONFLICT (sound_name) DO NOTHING
        `);

        // Indeksai
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history(user_id, created_at DESC)`);

        console.log('💾 PostgreSQL duomenų bazė paruošta');
    } catch (err) {
        console.error('❌ DB inicializavimo klaida:', err);
        throw err;
    }
}

// ============================================
// PAGALBINĖS FUNKCIJOS
// ============================================
const dbHelpers = {
    // Vartotojai
    async findUserByUsername(username) {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0] || null;
    },

    async findUserByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    },

    async findUserById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    },

    async createUser(username, email, passwordHash, securityQuestion, securityAnswerHash) {
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, security_question, security_answer_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [username, email, passwordHash, securityQuestion, securityAnswerHash]
        );
        const userId = result.rows[0].id;

        await pool.query('INSERT INTO stats (user_id) VALUES ($1)', [userId]);

        return userId;
    },

    async updateLastLogin(userId) {
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    },

    async updatePassword(userId, newPasswordHash) {
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
    },

    // Statistika
    async getUserStats(userId) {
        const result = await pool.query('SELECT * FROM stats WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    },

    // Lyderių lentelė
    async getTopPlayers(limit = 10) {
        const result = await pool.query(`
            SELECT 
                u.id, 
                u.username, 
                s.games_played, 
                s.games_won, 
                s.properties_bought, 
                s.houses_built,
                COALESCE(s.bankrupts, 0) AS bankrupts
            FROM users u
            JOIN stats s ON u.id = s.user_id
            ORDER BY s.games_won DESC, s.games_played DESC, s.properties_bought DESC
            LIMIT $1
        `, [limit]);
        return result.rows;
    },

    async updateStats(userId, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        
        if (fields.length === 0) return;
        
        const setClause = fields.map((f, i) => `${f} = ${f} + $${i + 1}`).join(', ');
        
        await pool.query(
            `UPDATE stats SET ${setClause} WHERE user_id = $${fields.length + 1}`,
            [...values, userId]
        );
    },

    // 🆕 Įrašyti žaidimo istoriją
    async saveGameHistory(userId, gameId, result, money, playersCount, housesBuilt, propertiesBought) {
        await pool.query(
            `INSERT INTO game_history (user_id, game_id, result, money, players_count, houses_built, properties_bought) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, gameId, result, money, playersCount, housesBuilt, propertiesBought]
        );
    },

    // 🆕 Gauti paskutinius N žaidimų
    async getGameHistory(userId, limit = 10) {
        const result = await pool.query(
            `SELECT id, game_id, result, money, players_count, houses_built, properties_bought, created_at 
             FROM game_history 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    },

    // ============================================
    // 🆕 BOARD CELLS (lentos langelių override)
    // ============================================

    async getBoardCells() {
        const result = await pool.query(
            'SELECT * FROM board_cells ORDER BY cell_index'
        );
        return result.rows;
    },

    async getBoardCell(cellIndex) {
        const result = await pool.query(
            'SELECT * FROM board_cells WHERE cell_index = $1',
            [cellIndex]
        );
        return result.rows[0] || null;
    },

    async upsertBoardCell(cellIndex, data) {
        const {
            name = null,
            type = null,
            color = null,
            color2 = null,
            cost = null,
            icon = null,
            music = null,
            font_size = null,
            font_color = null,
            description = null,
            custom_data = null
        } = data;

        await pool.query(
            `INSERT INTO board_cells 
                (cell_index, name, type, color, color2, cost, icon, music, font_size, font_color, description, custom_data, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
             ON CONFLICT (cell_index) 
             DO UPDATE SET
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                color = EXCLUDED.color,
                color2 = EXCLUDED.color2,
                cost = EXCLUDED.cost,
                icon = EXCLUDED.icon,
                music = EXCLUDED.music,
                font_size = EXCLUDED.font_size,
                font_color = EXCLUDED.font_color,
                description = EXCLUDED.description,
                custom_data = EXCLUDED.custom_data,
                updated_at = CURRENT_TIMESTAMP`,
            [cellIndex, name, type, color, color2, cost, icon, music, font_size, font_color, description, custom_data]
        );
    },

    async deleteBoardCellOverride(cellIndex) {
        await pool.query(
            'DELETE FROM board_cells WHERE cell_index = $1',
            [cellIndex]
        );
    },

    // ============================================
    // 🆕 CENTER CELLS (vidurio langeliai)
    // ============================================

    async getCenterCells() {
        const result = await pool.query(
            'SELECT * FROM center_cells ORDER BY cell_id'
        );
        return result.rows;
    },

    async getCenterCell(cellId) {
        const result = await pool.query(
            'SELECT * FROM center_cells WHERE cell_id = $1',
            [cellId]
        );
        return result.rows[0] || null;
    },

    async upsertCenterCell(cellId, data) {
        const {
            title = null,
            title_color = null,
            title_size = null,
            title_size_min = null,
            title_size_max = null,
            bg_color = null,
            bg_color2 = null,
            border_color = null,
            font_color = null,
            font_size = null,
            font_size_min = null,
            font_size_max = null,
            icon = null,
            custom_data = null,
            myinfo_name_size = null,
            myinfo_name_color = null,
            myinfo_money_size = null,
            myinfo_money_color = null,
            myinfo_text_size = null,
            myinfo_text_color = null
        } = data;

        await pool.query(
            `INSERT INTO center_cells 
                (cell_id, title, title_color, title_size, title_size_min, title_size_max, bg_color, bg_color2, border_color, font_color, font_size, font_size_min, font_size_max, icon, custom_data, myinfo_name_size, myinfo_name_color, myinfo_money_size, myinfo_money_color, myinfo_text_size, myinfo_text_color, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
             ON CONFLICT (cell_id) 
             DO UPDATE SET
                title = EXCLUDED.title,
                title_color = EXCLUDED.title_color,
                title_size = EXCLUDED.title_size,
                title_size_min = EXCLUDED.title_size_min,
                title_size_max = EXCLUDED.title_size_max,
                bg_color = EXCLUDED.bg_color,
                bg_color2 = EXCLUDED.bg_color2,
                border_color = EXCLUDED.border_color,
                font_color = EXCLUDED.font_color,
                font_size = EXCLUDED.font_size,
                font_size_min = EXCLUDED.font_size_min,
                font_size_max = EXCLUDED.font_size_max,
                icon = EXCLUDED.icon,
                custom_data = EXCLUDED.custom_data,
                myinfo_name_size = EXCLUDED.myinfo_name_size,
                myinfo_name_color = EXCLUDED.myinfo_name_color,
                myinfo_money_size = EXCLUDED.myinfo_money_size,
                myinfo_money_color = EXCLUDED.myinfo_money_color,
                myinfo_text_size = EXCLUDED.myinfo_text_size,
                myinfo_text_color = EXCLUDED.myinfo_text_color,
                updated_at = CURRENT_TIMESTAMP`,
            [cellId, title, title_color, title_size, title_size_min, title_size_max, bg_color, bg_color2, border_color, font_color, font_size, font_size_min, font_size_max, icon, custom_data, myinfo_name_size, myinfo_name_color, myinfo_money_size, myinfo_money_color, myinfo_text_size, myinfo_text_color]
        );
    },

    // ============================================
    // 🆕 SOUND SETTINGS (garso nustatymai)
    // ============================================

    async getSoundSettings() {
        const result = await pool.query(
            'SELECT * FROM sound_settings WHERE id = 1'
        );
        return result.rows[0] || null;
    },

    async updateSoundSettings(data) {
        const {
            player_control_enabled = true,
            default_mode = 'my',
            default_sfx_volume = 50,
            default_sound_levels = {}
        } = data;

        await pool.query(
            `UPDATE sound_settings SET
                player_control_enabled = $1,
                default_mode = $2,
                default_sfx_volume = $3,
                default_sound_levels = $4,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = 1`,
            [
                player_control_enabled,
                default_mode,
                default_sfx_volume,
                JSON.stringify(default_sound_levels)
            ]
        );
    },

    // 🆕 SOUND FILES (garso failai)   ← NAUJA!
    async getSoundFiles() {
        const result = await pool.query(
            'SELECT * FROM sound_files ORDER BY sound_name'
        );
        return result.rows;
    },

    async updateSoundFile(soundName, filePath) {
        await pool.query(
            `UPDATE sound_files 
             SET file_path = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE sound_name = $2`,
            [filePath, soundName]
        );
    }
};

module.exports = { pool, initDatabase, ...dbHelpers };
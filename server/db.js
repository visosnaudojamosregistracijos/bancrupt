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
    ssl: {
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS stats (
                user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                games_played INTEGER DEFAULT 0,
                games_won INTEGER DEFAULT 0,
                total_money_won INTEGER DEFAULT 0,
                total_money_lost INTEGER DEFAULT 0,
                houses_built INTEGER DEFAULT 0,
                properties_bought INTEGER DEFAULT 0
            )
        `);

        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

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

    async createUser(username, email, passwordHash) {
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, email, passwordHash]
        );
        const userId = result.rows[0].id;

        await pool.query('INSERT INTO stats (user_id) VALUES ($1)', [userId]);

        return userId;
    },

    async updateLastLogin(userId) {
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    },

    // Statistika
    async getUserStats(userId) {
        const result = await pool.query('SELECT * FROM stats WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
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
    }
};

module.exports = { pool, initDatabase, ...dbHelpers };
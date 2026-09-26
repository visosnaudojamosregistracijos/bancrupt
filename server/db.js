// ============================================
// server/db.js
// SQLite duomenų bazės valdymas
// ============================================

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Užtikrinti, kad 'data' katalogas egzistuoja
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Sukurti / atidaryti duomenų bazę
const dbPath = path.join(dataDir, 'bancrupt.db');
const db = new Database(dbPath);

// Įjungti WAL režimą – greitesnis veikimas
db.pragma('journal_mode = WAL');

// ============================================
// LENTELIŲ SUKŪRIMAS
// ============================================

// Vartotojų lentelė
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )
`);

// Statistikos lentelė
db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
        user_id INTEGER PRIMARY KEY,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_money_won INTEGER DEFAULT 0,
        total_money_lost INTEGER DEFAULT 0,
        houses_built INTEGER DEFAULT 0,
        properties_bought INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);

// Indeksai greitesniam paieškai
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

console.log('💾 Duomenų bazė paruošta:', dbPath);

// ============================================
// PAGALBINĖS FUNKCIJOS
// ============================================

const dbHelpers = {
    // Vartotojai
    findUserByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    },

    findUserByEmail(email) {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    },

    findUserById(id) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },

    createUser(username, email, passwordHash) {
        const result = db.prepare(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
        ).run(username, email, passwordHash);

        // Sukurti tuščią statistiką naujam vartotojui
        db.prepare('INSERT INTO stats (user_id) VALUES (?)').run(result.lastInsertRowid);

        return result.lastInsertRowid;
    },

    updateLastLogin(userId) {
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    },

    // Statistika
    getUserStats(userId) {
        return db.prepare('SELECT * FROM stats WHERE user_id = ?').get(userId);
    },

    updateStats(userId, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map(f => `${f} = ${f} + ?`).join(', ');
        
        db.prepare(`UPDATE stats SET ${setClause} WHERE user_id = ?`).run(...values, userId);
    }
};

module.exports = { db, ...dbHelpers };
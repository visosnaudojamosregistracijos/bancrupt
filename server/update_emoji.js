const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: false
});

pool.query("UPDATE users SET emoji = $1 WHERE username = $2", ['🐕', 'DogasTV'])
    .then(() => {
        console.log('✅ UPDATE OK');
        return pool.query("SELECT id, username, emoji FROM users");
    })
    .then(result => {
        console.log(result.rows);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Klaida:', err);
        process.exit(1);
    });
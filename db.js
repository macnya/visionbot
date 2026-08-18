const { Pool } = require('pg');
require('dotenv').config();

// Fields rather than a connection string: the password goes through no URL
// parsing, so characters like $ and @ need no encoding and cannot be
// misread.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = { pool };
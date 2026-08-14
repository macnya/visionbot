const { pool } = require('./db');

(async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log(rows.map(r => r.table_name));
  process.exit();
})();
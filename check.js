require('dotenv').config();
const { pool } = require('./db');

pool.query(`
  SELECT current_database() AS db, current_user AS usr,
         (SELECT COUNT(*) FROM it_staff) AS staff,
         (SELECT COUNT(*) FROM asset) AS assets,
         (SELECT COUNT(*) FROM knowledge_base) AS kb
`)
  .then((r) => console.table(r.rows))
  .catch((e) => console.log('ERR:', e.message))
  .finally(() => pool.end());
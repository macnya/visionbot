require('dotenv').config();
const { searchKnowledgeBase } = require('./knowledgeBase');
const { pool } = require('./db');

(async () => {
  for (const q of ['how many days annual leave do I get?', 'annual leave', 'leave']) {
    const rows = await searchKnowledgeBase(q);
    console.log(`\n"${q}" -> ${rows.length} rows`);
    rows.forEach((r) => console.log('   ', r.question));
  }
  await pool.end();
})();
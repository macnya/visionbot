const { pool } = require('./db');

async function searchKnowledgeBase(query, category = null) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return [];

  let sql = `
    SELECT question, answer, category FROM knowledge_base
    WHERE (${words.map((_, i) => `LOWER(question) LIKE $${i + 1} OR $${i + 1} = ANY(LOWER(keywords::text)::text[])`).join(' OR ')})
  `;
  const params = words.map(w => `%${w}%`);

  if (category) {
    sql += ` AND category = $${params.length + 1}`;
    params.push(category);
  }
  sql += ' LIMIT 3';

  const { rows } = await pool.query(sql, params);
  return rows;
}

// Run once to seed sample entries — edit freely with real VFK policy/product info
async function seedKnowledgeBase() {
  const entries = [
    {
      category: 'loan_products',
      question: 'What loan products does Vision Fund Kenya offer',
      answer: 'Vision Fund Kenya offers group loans, individual business loans, agricultural loans, and education loans. Contact your branch manager for current interest rates and eligibility.',
      keywords: ['loan', 'products', 'agricultural', 'education', 'group'],
    },
    {
      category: 'it_support',
      question: 'Laptop wont turn on',
      answer: 'First check the charger and power light. If no response, try a hard reset (hold power 15s). If it still fails, escalate to IT support with the asset tag number.',
      keywords: ['laptop', 'wont turn on', 'power', 'reset'],
    },
    {
      category: 'hr_policy',
      question: 'How do I apply for leave',
      answer: 'Leave requests go through your branch HR focal point via the official leave request form, submitted at least 5 working days in advance.',
      keywords: ['leave', 'apply', 'hr', 'vacation'],
    },
  ];

  for (const e of entries) {
    await pool.query(
      `INSERT INTO knowledge_base (category, question, answer, keywords) VALUES ($1, $2, $3, $4)`,
      [e.category, e.question, e.answer, e.keywords]
    );
  }
  console.log('Knowledge base seeded.');
}

module.exports = { searchKnowledgeBase, seedKnowledgeBase };
const { pool } = require('./db');

let branchCache = null;
let branchCacheExpiry = 0;

// Pulls the real list of branch names from the DB so we don't hardcode a guessed list
async function getKnownBranches() {
  const now = Date.now();
  if (branchCache && now < branchCacheExpiry) return branchCache;

  const { rows } = await pool.query(
    `SELECT DISTINCT branch FROM location WHERE branch IS NOT NULL`
  );
  branchCache = rows.map(r => r.branch.toLowerCase());
  branchCacheExpiry = now + 10 * 60 * 1000; // refresh every 10 min
  return branchCache;
}

async function extractBranchName(text) {
  const branches = await getKnownBranches();
  const lower = text.toLowerCase();
  return branches.find(b => lower.includes(b)) || null;
}

// Counts currently-assigned assets (returned_date IS NULL) at a branch, grouped by category
async function queryAssetsByBranch(branchName) {
  const sql = `
    SELECT ac.name AS category, COUNT(*) AS count
    FROM asset a
    JOIN assignment asg ON asg.asset_id = a.id AND asg.returned_date IS NULL
    JOIN location l ON l.id = asg.location_id
    LEFT JOIN asset_category ac ON ac.id = a.asset_category_id
    WHERE LOWER(l.branch) LIKE $1
    GROUP BY ac.name
    ORDER BY count DESC
  `;
  const { rows } = await pool.query(sql, [`%${branchName.toLowerCase()}%`]);
  return rows;
}

module.exports = { queryAssetsByBranch, extractBranchName };
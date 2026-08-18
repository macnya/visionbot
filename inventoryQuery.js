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

// Counts currently-assigned assets (returned_date IS NULL) at a branch, grouped by category.
//
// scopeBranch is the asker's own branch when they are scoped, and null
// otherwise. It is applied on top of whatever branch they asked about, so a
// Branch Administrator asking about somewhere else gets nothing rather than
// somebody else's figures.
async function queryAssetsByBranch(branchName, scopeBranch = null) {
  const sql = `
    SELECT ac.name AS category, COUNT(*) AS count
    FROM asset a
    JOIN assignment asg ON asg.asset_id = a.id AND asg.returned_date IS NULL
    JOIN location l ON l.id = asg.location_id
    LEFT JOIN asset_category ac ON ac.id = a.asset_category_id
    WHERE LOWER(l.branch) LIKE $1
      AND ($2::text IS NULL OR l.branch = $2)
      AND a.approval_status = 'approved'
    GROUP BY ac.name
    ORDER BY count DESC
  `;
  const { rows } = await pool.query(sql, [`%${branchName.toLowerCase()}%`, scopeBranch]);
  return rows;
}

// Names mentioned in a question, matched against the employee table.
//
// Matched against real names rather than parsed out of the text, for the same
// reason branch names are: it makes an injected string impossible to act on,
// and it avoids treating "laptop" as a surname.
//
// Two tokens minimum. A single first name is too ambiguous — there are several
// Graces — and answering about the wrong person is worse than not answering.
async function extractEmployeeName(text, scopeBranch = null) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length < 2) return null;

  const { rows } = await pool.query(
    `SELECT DISTINCT e.id, e.name, e.branch, e.department
     FROM employee e
     LEFT JOIN assignment ag ON ag.employee_id = e.id AND ag.returned_date IS NULL
     LEFT JOIN location l ON l.id = ag.location_id
     WHERE e.name IS NOT NULL
       AND ($1::text IS NULL OR l.branch = $1 OR e.branch = $1)`,
    [scopeBranch]
  );

  // Score each employee by how many of their name parts appear in the question.
  const scored = rows
    .map((e) => {
      const parts = e.name.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
      const hits = parts.filter((p) => words.includes(p)).length;
      return { employee: e, hits };
    })
    .filter((s) => s.hits >= 2)
    .sort((a, b) => b.hits - a.hits);

  if (!scored.length) return null;

  // A tie means two people match equally well and we cannot tell which was
  // meant. Better to ask than to guess at somebody's record.
  if (scored.length > 1 && scored[0].hits === scored[1].hits) {
    return { ambiguous: scored.slice(0, 4).map((s) => s.employee.name) };
  }

  return { employee: scored[0].employee };
}

// What does this person currently hold?
async function queryAssetsByEmployee(employeeId, scopeBranch = null) {
  const { rows } = await pool.query(
    `SELECT a.asset_code, a.description, a.condition,
            ac.name AS category, l.branch, l.physical_location
     FROM assignment ag
     JOIN asset a ON a.id = ag.asset_id
     LEFT JOIN asset_category ac ON ac.id = a.asset_category_id
     LEFT JOIN location l ON l.id = ag.location_id
     WHERE ag.employee_id = $1
       AND ag.returned_date IS NULL
       AND a.approval_status = 'approved'
       AND ($2::text IS NULL OR l.branch = $2)
     ORDER BY ac.name, a.asset_code`,
    [employeeId, scopeBranch]
  );
  return rows;
}

// Where is this asset, and who has it? Answers "who has KDT001981".
async function queryAssetByCode(text, scopeBranch = null) {
  // Asset codes have a fixed shape, so this can be matched rather than guessed.
  const match = text.toUpperCase().match(/\b((?:VFK|KDT|NC|EQP|C&P)[\s-]?\d{3,6})\b/);
  if (!match) return null;

  const code = match[1].replace(/[\s-]/g, '');

  const { rows } = await pool.query(
    `SELECT a.asset_code, a.description, a.status, a.condition,
            ac.name AS category, e.name AS holder, l.branch, l.physical_location
     FROM asset a
     LEFT JOIN asset_category ac ON ac.id = a.asset_category_id
     LEFT JOIN assignment ag ON ag.asset_id = a.id AND ag.returned_date IS NULL
     LEFT JOIN employee e ON e.id = ag.employee_id
     LEFT JOIN location l ON l.id = ag.location_id
     WHERE a.asset_code = $1
       AND a.approval_status = 'approved'
       AND ($2::text IS NULL OR l.branch = $2)`,
    [code, scopeBranch]
  );

  // Distinguishing "not in the register" from "not at your branch" would tell a
  // scoped user that an asset exists elsewhere, so both return nothing.
  return { code, asset: rows[0] || null };
}

module.exports = {
  queryAssetsByBranch,
  extractBranchName,
  extractEmployeeName,
  queryAssetsByEmployee,
  queryAssetByCode,
};
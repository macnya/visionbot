const { pool } = require('./db');

// Who is asking, and what are they allowed to see?
//
// The bot previously answered everyone identically, which quietly bypassed the
// branch scoping the admin panel enforces. This resolves a Slack user to a
// member of staff so the same rules apply in both places.
//
// The mapping is discovered, not maintained. Slack has already verified each
// user's email address, so matching that against it_staff.email is both
// automatic and trustworthy — nobody has to copy Slack user IDs by hand, and a
// user cannot claim to be someone else.

const ROLES = {
  ADMIN: 'Admin',
  OFFICER: 'Administration Officer',
  BRANCH_ADMIN: 'Branch Administrator',
  AUDITOR: 'Auditor',
};

// Accounts predating the renames still carry the old values, and the main
// application accepts both — so this must too.
const LEGACY = {
  'IT Admin': ROLES.ADMIN,
  'IT Officer': ROLES.OFFICER,
  'Branch Manager': ROLES.BRANCH_ADMIN,
};

const canonicalRole = (role) => LEGACY[role] || role;

// Resolved identities are cached for a few minutes. A role change should take
// effect quickly, but not at the cost of two queries and a Slack API call on
// every message.
const cache = new Map();
const TTL = 5 * 60 * 1000;

async function resolveStaff(slackUserId, client) {
  const hit = cache.get(slackUserId);
  if (hit && Date.now() < hit.expires) return hit.staff;

  const staff = await lookup(slackUserId, client);
  cache.set(slackUserId, { staff, expires: Date.now() + TTL });
  return staff;
}

async function lookup(slackUserId, client) {
  // Already linked?
  const known = await pool.query(
    `SELECT id, name, email, role, branch FROM it_staff WHERE slack_user_id = $1`,
    [slackUserId]
  );
  if (known.rows.length) return shape(known.rows[0]);

  // Not yet. Ask Slack for the verified email and match on that.
  let email = null;
  try {
    const info = await client.users.info({ user: slackUserId });
    email = info?.user?.profile?.email || null;
    } catch (err) {
    // Usually a missing users:read.email scope. Worth logging loudly, because
    // the symptom otherwise is "the bot refuses everyone" with no clue why.
    console.error('users.info failed:', err.data?.error || err.message);
    return null;
  }

    if (!email) {
    console.error('no email on the Slack profile for', slackUserId);
    return null;
  }

  const matched = await pool.query(
    `SELECT id, name, email, role, branch FROM it_staff WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  console.log('slack email:', email, '-> staff rows found:', matched.rows.length);
  if (!matched.rows.length) return null;

  // Remember it, so this is a one-off cost per person.
  await pool.query(
    `UPDATE it_staff SET slack_user_id = $1 WHERE id = $2`,
    [slackUserId, matched.rows[0].id]
  );

  return shape(matched.rows[0]);
}

function shape(row) {
  const role = canonicalRole(row.role);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    branch: row.branch || null,
    isAdmin: role === ROLES.ADMIN,
    // Mirrors branchScopeFor in the main backend: only a Branch Administrator
    // is scoped, and one with no branch set sees nothing rather than
    // everything. Failing closed is the right default.
    scopeBranch: role === ROLES.BRANCH_ADMIN ? (row.branch || '\u0000none') : null,
  };
}

// Questions about individuals name people and what they hold, so they are
// limited to roles that see that in the panel anyway. Asset counts per branch
// are not treated as sensitive.
function canSeePeople(staff) {
  if (!staff) return false;
  return [ROLES.ADMIN, ROLES.OFFICER, ROLES.BRANCH_ADMIN, ROLES.AUDITOR].includes(staff.role);
}

module.exports = { resolveStaff, canSeePeople, ROLES, canonicalRole };
const { App } = require('@slack/bolt');
const { askGroq } = require('./groq');
const { detectIntent } = require('./intents');
const { searchKnowledgeBase } = require('./knowledgeBase');
const {
  queryAssetsByBranch, extractBranchName,
  extractEmployeeName, queryAssetsByEmployee, queryAssetByCode,
} = require('./inventoryQuery');
const { resolveStaff, canSeePeople } = require('./identity');
const { pool } = require('./db');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// Someone in the Slack workspace who is not a member of staff in the register.
// Refused rather than answered: the workspace may include contractors, interns
// or guests, and Slack membership is not an access decision the register made.
const NOT_RECOGNISED =
  "I can't match your Slack account to a staff record, so I'm not able to look anything up.\n\n" +
  "This usually means the email on your Slack profile differs from the one on your register " +
  "account. Ask an administrator to check, and I'll work straight away once they match.";

async function handleQuery(text, slackUserId, client, say) {
  console.log('message from slack user:', slackUserId);
  const intent = detectIntent(text);
  let staff = null;
  let reply;
  let refused = false;

  try {
    staff = await resolveStaff(slackUserId, client);

    // Unrecognised users get nothing from the register. They can still be told
    // why, which is more useful than silence.
    if (!staff) {
      await say(NOT_RECOGNISED);
      await log({ slackUserId, staff: null, text, intent, reply: NOT_RECOGNISED, refused: true });
      return;
    }

    const scope = staff.scopeBranch;
    let contextText = '';

    if (intent === 'asset_lookup') {
      const found = await queryAssetByCode(text, scope);
      if (!found) {
        contextText = 'No asset code was recognised in the question.';
      } else if (!found.asset) {
        // Deliberately the same answer whether the asset does not exist or
        // exists at another branch. Distinguishing them would let a scoped user
        // map the register one code at a time.
        contextText = `${found.code} is not in the records available to you.`;
      } else {
        const a = found.asset;
        contextText =
          `${a.asset_code} — ${a.description}\n` +
          `Category: ${a.category || 'uncategorised'}\n` +
          `Status: ${a.status}\n` +
          `Condition: ${a.condition || 'not yet verified'}\n` +
          `Held by: ${a.holder || 'nobody — in storage'}\n` +
          `Location: ${[a.branch, a.physical_location].filter(Boolean).join(' · ') || 'not recorded'}`;
      }
      reply = await askGroq(text, contextText);

    } else if (intent === 'employee_lookup') {
      if (!canSeePeople(staff)) {
        reply = "I'm not able to share what individual staff members hold. " +
                "Ask an administrator if you need that.";
        refused = true;
      } else {
        const match = await extractEmployeeName(text, scope);

        if (!match) {
          contextText = 'No staff member in the records matched that name. ' +
                        'A first name alone is not enough — a full name is needed.';
        } else if (match.ambiguous) {
          contextText = `Several people match that name: ${match.ambiguous.join(', ')}. ` +
                        `Ask again using the full name.`;
        } else {
          const assets = await queryAssetsByEmployee(match.employee.id, scope);
          contextText = assets.length
            ? `${match.employee.name} (${match.employee.branch || 'branch not recorded'}) holds ` +
              `${assets.length} asset${assets.length === 1 ? '' : 's'}:\n` +
              assets.map((a) =>
                `${a.asset_code} — ${a.description} (${a.condition || 'not verified'})`
              ).join('\n')
            : `${match.employee.name} has no assets currently assigned.`;
        }
        reply = await askGroq(text, contextText);
      }

    } else if (intent === 'inventory') {
      const branch = await extractBranchName(text);

      // A scoped user asking about somewhere else is told plainly, rather than
      // handed an empty result that reads like the branch has no assets.
      if (branch && scope && branch.toLowerCase() !== scope.toLowerCase()) {
        reply = `I can only report on ${scope}. Ask an administrator for figures from other branches.`;
        refused = true;
      } else {
        if (branch) {
          const results = await queryAssetsByBranch(branch, scope);
          contextText = results.length
            ? results.map((r) => `${r.count}x ${r.category || 'uncategorised items'} at ${branch}`).join('\n')
            : `No currently-assigned assets found for ${branch}.`;
        } else if (scope) {
          const results = await queryAssetsByBranch(scope, scope);
          contextText = `Figures for ${scope}, the branch this user is responsible for:\n` +
            results.map((r) => `${r.count}x ${r.category || 'uncategorised items'}`).join('\n');
        }
        reply = await askGroq(text, contextText);
      }

    } else {
      const kbResults = await searchKnowledgeBase(text, intent === 'it_support' ? 'it_support' : null);

      // Nothing in the knowledge base means nothing to answer from. The model
      // is told to say so rather than fill the gap — an invented leave policy
      // is worse than no answer, because somebody will act on it.
      contextText = kbResults.length
        ? kbResults.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')
        : 'NOTHING FOUND IN THE KNOWLEDGE BASE. Say you do not have this ' +
          'documented and suggest who to ask. Do not describe policy from general knowledge.';

      reply = await askGroq(text, contextText);
    }

    await say(reply);
    await log({ slackUserId, staff, text, intent, reply, refused });

  } catch (err) {
    console.error('Bot error:', err);
    await say("Something went wrong at my end. Please try again, or contact IT support.");
    await log({ slackUserId, staff, text, intent, reply: `ERROR: ${err.message}`, refused: false })
      .catch(() => {});
  }
}

// Who asked, under what scope, and whether they were refused. A log recording
// the question but not who could see the answer is of little use in an audit.
async function log({ slackUserId, staff, text, intent, reply, refused }) {
  await pool.query(
    `INSERT INTO bot_query_log
       (platform_user_id, username, staff_id, query, intent, response, scoped_to_branch, refused)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [slackUserId, staff?.name || null, staff?.id || null, text, intent, reply,
     staff?.scopeBranch || null, refused]
  );
}

app.message(async ({ message, client, say }) => {
  if (message.subtype || !message.text) return;
  await handleQuery(message.text, message.user, client, say);
});

app.event('app_mention', async ({ event, client, say }) => {
  const text = event.text.replace(/<@[^>]+>/g, '').trim();
  if (!text) {
    await say(
      "Hello. I can look up assets by code, tell you what a colleague holds, " +
      "and report branch figures — for whichever branches your role covers."
    );
    return;
  }
  await handleQuery(text, event.user, client, say);
});

module.exports = app;
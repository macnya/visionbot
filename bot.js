const { App } = require('@slack/bolt');
const { askGroq } = require('./groq');
const { detectIntent } = require('./intents');
const { searchKnowledgeBase } = require('./knowledgeBase');
const { queryAssetsByBranch, extractBranchName } = require('./inventoryQuery');
const { pool } = require('./db');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

async function handleQuery(text, userId, username, say) {
  try {
    const intent = detectIntent(text);
    let contextText = '';
    let reply;

    if (intent === 'inventory') {
      const branch = await extractBranchName(text);
      if (branch) {
        const results = await queryAssetsByBranch(branch);
        contextText = results.length
            ? results.map(r => `${r.count}x ${r.category || 'uncategorized items'} at ${branch}`).join('\n')
            : `No currently-assigned assets found for ${branch}.`;
      }
      reply = await askGroq(text, contextText);
    } else {
      const kbResults = await searchKnowledgeBase(text, intent === 'it_support' ? 'it_support' : null);
      contextText = kbResults.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n');
      reply = await askGroq(text, contextText);
    }

    await say(reply);

    await pool.query(
      `INSERT INTO bot_query_log (telegram_user_id, username, query, intent, response) VALUES ($1,$2,$3,$4,$5)`,
      [userId, username, text, intent, reply]
    );
  } catch (err) {
    console.error('Bot error:', err);
    await say("⚠️ Something went wrong on my end. Please try again or contact IT support.");
  }
}

app.message(async ({ message, say }) => {
  if (message.subtype || !message.text) return;
  const username = message.user;
  await handleQuery(message.text, message.user, username, say);
});

app.event('app_mention', async ({ event, say }) => {
  const text = event.text.replace(/<@[^>]+>/g, '').trim();
  if (!text) {
    await say("Hi! Ask me about loan products, IT support, or branch asset info.");
    return;
  }
  await handleQuery(text, event.user, event.user, say);
});

module.exports = app;
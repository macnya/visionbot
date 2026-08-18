const { App } = require('@slack/bolt');
const { resolveStaff } = require('./identity');
const { ask } = require('./backendClient');
require('dotenv').config();

// A Slack front door to the asset register.
//
// This file used to hold its own SQL, its own branch scoping and its own call
// to a language model. All of that now lives in the backend, where the admin
// panel and the scanner already use it — so the bot's job is reduced to two
// things: work out who is asking, and pass the question on.

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// Someone in the Slack workspace who is not a member of staff in the register.
// Refused rather than answered: a workspace may include contractors, interns or
// guests, and Slack membership is not an access decision the register made.
const NOT_RECOGNISED =
  "I can't match your Slack account to a staff record, so I'm not able to look anything up.\n\n" +
  'This usually means the email on your Slack profile differs from the one on your register ' +
  "account. Ask an administrator to check, and I'll work straight away once they match.";

async function handleQuestion(text, slackUserId, client, say) {
  try {
    const staff = await resolveStaff(slackUserId, client);

    if (!staff) {
      await say(NOT_RECOGNISED);
      return;
    }

    const result = await ask(staff.email, text);
    await say(result.answer);

  } catch (err) {
    console.error('Bot error:', err.response?.data || err.message);

    // A cold start on Render's free tier takes about fifty seconds, which is a
    // different problem from a broken bot and deserves a different message.
    if (err.code === 'ECONNABORTED') {
      await say('The asset system is waking up. Please ask again in a moment.');
    } else {
      await say('Something went wrong at my end. Please try again, or contact IT support.');
    }
  }
}

app.message(async ({ message, client, say }) => {
  if (message.subtype || !message.text) return;
  await handleQuestion(message.text, message.user, client, say);
});

app.event('app_mention', async ({ event, client, say }) => {
  const text = event.text.replace(/<@[^>]+>/g, '').trim();

  if (!text) {
    await say(
      'Hello. Ask me about assets, who holds what, or HR and ICT policy — ' +
      'I answer within whatever your own role and branch allow.'
    );
    return;
  }

  await handleQuestion(text, event.user, client, say);
});

module.exports = app;
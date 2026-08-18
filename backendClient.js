const axios = require('axios');
require('dotenv').config();

// Talks to the asset system's own API instead of querying the database.
//
// WHY
// The bot used to hold its own copy of the queries, its own scope handling and
// its own idea of who was asking. That is how two systems answering the same
// question start giving different answers — the same way asset.status drifted
// from the custody records.
//
// Now there is one implementation, in the backend, and three clients: the admin
// panel, the scanner, and this. A fix to a query is a fix everywhere.

const api = axios.create({
  baseURL: process.env.BACKEND_URL,
  timeout: 60000,   // Render's free tier sleeps; a cold start takes ~50s
});

// Tokens last five minutes, so they are cached per person rather than fetched
// on every message — and refreshed a little early so a request never sets off
// with one that expires mid-flight.
const tokenCache = new Map();
const EARLY_REFRESH_MS = 30 * 1000;

async function tokenFor(email) {
  const hit = tokenCache.get(email);
  if (hit && Date.now() < hit.expires - EARLY_REFRESH_MS) return hit.token;

  const { data } = await api.post('/auth/service-token', {
    service_secret: process.env.BOT_SERVICE_SECRET,
    email,
  });

  tokenCache.set(email, { token: data.token, expires: Date.now() + 5 * 60 * 1000 });
  return data.token;
}

// Ask on behalf of a member of staff. The backend applies their role and branch
// scope, so this cannot return more than they would see in the panel.
async function ask(email, question) {
  const token = await tokenFor(email);

  try {
    const { data } = await api.post(
      '/assistant',
      { question },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (err) {
    // A cached token can still be rejected if the account was reset since —
    // resetting a password ends existing sessions. Clear it and try once more
    // before giving up, rather than making the user wait five minutes.
    if (err.response?.status === 401) {
      tokenCache.delete(email);
      const fresh = await tokenFor(email);
      const { data } = await api.post(
        '/assistant',
        { question },
        { headers: { Authorization: `Bearer ${fresh}` } }
      );
      return data;
    }
    throw err;
  }
}

module.exports = { ask };
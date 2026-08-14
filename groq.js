const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are VisionBot, an internal assistant for Vision Fund Kenya staff.
You help staff quickly find information on loan products, HR policies, IT support steps, and asset/inventory data.
Be concise, professional, and practical. If given database results, summarize them clearly in plain English.
If you don't have enough context to answer accurately, say so and suggest who to contact — don't make up policy details.`;

async function askGroq(userMessage, contextText = '') {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  if (contextText) {
    messages.push({
      role: 'system',
      content: `Relevant internal context:\n${contextText}`,
    });
  }

  messages.push({ role: 'user', content: userMessage });

  const completion = await groq.chat.completions.create({
    messages,
    model: 'llama-3.1-8b-instant', // fast + free tier
    temperature: 0.3,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
}

module.exports = { askGroq };
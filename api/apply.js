/**
 * POST /api/apply - прием заявок (исследование, с согласия пользователя)
 */
const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN || '8842189334:AAHGd1814LZ-e13xdsfbuH35v_WF4c5RTa4';
const CHAT_ID = process.env.CHAT_ID || '';

function sendTelegram(text, extra = {}) {
  if (!CHAT_ID) return Promise.resolve();
  const payload = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body) body = {};

  const ip = getIP(req);
  const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null;
  const country = req.headers['x-vercel-ip-country'] || null;

  let location = body.location || 'unknown';
  if (city && country) location = `${city}, ${country}`;
  else if (ip && !body.location) {
    try {
      const c = new AbortController();
      setTimeout(() => c.abort(), 3000);
      const r = await fetch(`http://ip-api.com/json/${ip}?fields=city,country`, { signal: c.signal });
      const j = await r.json();
      if (j && j.country) location = `${j.city || ''}${j.city ? ', ' : ''}${j.country}`;
    } catch {}
  }

  // Поддержка полей как в старом server.js + новые с скринов
  const position = body.position || body.Position || 'N/A';
  const name = body.name || body.Name || 'Anonymous';
  const email = body.email || body.Email || 'N/A';
  const link = body.portfolio || body.link || body.Link || body.github || 'N/A';
  const twitter = body.twitter || body.Twitter || 'N/A';
  const telegram = body.telegram || body.Telegram || '';
  const message = body.message || body.Message || 'N/A';

  const text =
    `📄 NEW JOB APPLICATION\n` +
    `—————————————\n` +
    `📌 Position: ${position}\n` +
    `👤 Name: ${name}\n` +
    `📧 Email: ${email}\n` +
    `🔗 Link: ${link}\n` +
    `🐦 Twitter: ${twitter}\n` +
    (telegram ? `✈️ Telegram: ${telegram}\n` : ``) +
    `📝 Message: ${message}\n` +
    `🌍 IP: ${ip}\n` +
    `📍 Location: ${location}`;

  try {
    await sendTelegram(text);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false });
  }
};

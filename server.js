import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runDailySeoGeneration } from './seo-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Enable JSON and URL-encoded bodies with error handling
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Enable CORS for API routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==========================================
// 1. CONFIGURATION STORAGE (LOCKER & RADAR)
// ==========================================
const CONFIG_FILE = path.join(__dirname, 'locker-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        lockerId: parsed.lockerId || '4o7vvr',
        lockerDelay: parseInt(parsed.lockerDelay, 10) || 35,
        lockerEnabled: parsed.lockerEnabled !== false,
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
    }
  } catch (e) {
    console.error('[Config Error] Could not read config file:', e);
  }
  return {
    lockerId: '4o7vvr',
    lockerDelay: 35,
    lockerEnabled: true,
    updatedAt: new Date().toISOString()
  };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Config Error] Could not save config file:', e);
  }
}

let currentConfig = loadConfig();

// ==========================================
// 2. LIVE RADAR STATE & SESSIONS
// ==========================================
// Key: sessionId -> session object
const activeSessions = new Map();
const recentActivityLog = [];
const MAX_LOG_ENTRIES = 120;
let simulationEnabled = false; // Default OFF so real visitors are obvious!

// Country lookup with flags and names
const COUNTRY_LOOKUP = {
  MA: { name: 'Morocco', flag: '🇲🇦' },
  US: { name: 'United States', flag: '🇺🇸' },
  FR: { name: 'France', flag: '🇫🇷' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  DZ: { name: 'Algeria', flag: '🇩🇿' },
  TN: { name: 'Tunisia', flag: '🇹🇳' },
  EG: { name: 'Egypt', flag: '🇪🇬' },
  SA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  AE: { name: 'United Arab Emirates', flag: '🇦🇪' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  MX: { name: 'Mexico', flag: '🇲🇽' },
  TR: { name: 'Turkey', flag: '🇹🇷' },
  BE: { name: 'Belgium', flag: '🇧🇪' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  CH: { name: 'Switzerland', flag: '🇨🇭' },
  QA: { name: 'Qatar', flag: '🇶🇦' },
  KW: { name: 'Kuwait', flag: '🇰🇼' }
};

const TIMEZONE_TO_COUNTRY = {
  'Africa/Casablanca': 'MA',
  'Africa/El_Aaiun': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Cairo': 'EG',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'America/Chicago': 'US',
  'America/Toronto': 'CA',
  'America/Sao_Paulo': 'BR',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Europe/Istanbul': 'TR'
};

function parseUserAgent(ua = '') {
  const uaLower = ua.toLowerCase();
  let device = 'Desktop';
  let os = 'Unknown OS';
  let browser = 'Chrome';

  if (/ipad|tablet/i.test(uaLower)) {
    device = 'Tablet';
  } else if (/mobile|iphone|android|ipod|blackberry|opera mini/i.test(uaLower)) {
    device = 'Mobile';
  } else {
    device = 'Desktop';
  }

  if (uaLower.includes('windows')) os = 'Windows';
  else if (uaLower.includes('macintosh') || uaLower.includes('mac os')) os = 'macOS';
  else if (uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';
  else if (uaLower.includes('android')) os = 'Android';
  else if (uaLower.includes('linux')) os = 'Linux';

  if (uaLower.includes('edg/')) browser = 'Edge';
  else if (uaLower.includes('chrome') && !uaLower.includes('edg/')) browser = 'Chrome';
  else if (uaLower.includes('safari') && !uaLower.includes('chrome')) browser = 'Safari';
  else if (uaLower.includes('firefox')) browser = 'Firefox';
  else if (uaLower.includes('opr/') || uaLower.includes('opera')) browser = 'Opera';

  return { device, os, browser };
}

function resolveCountry(req, clientPayload = {}) {
  // 1. Client explicitly provided country
  if (clientPayload.countryCode && clientPayload.countryCode.length === 2) {
    const code = clientPayload.countryCode.toUpperCase();
    const info = COUNTRY_LOOKUP[code] || { name: clientPayload.countryName || code, flag: '🌐' };
    return {
      code,
      name: clientPayload.countryName || info.name,
      flag: info.flag || '🌐'
    };
  }

  // 2. Reverse proxy headers (Cloudflare, Vercel, GCP)
  const cfCountry = req.headers['cf-ipcountry'] || req.headers['x-country-code'] || req.headers['x-vercel-ip-country'];
  if (cfCountry && cfCountry.length === 2 && cfCountry !== 'XX') {
    const code = cfCountry.toUpperCase();
    return {
      code,
      name: COUNTRY_LOOKUP[code]?.name || code,
      flag: COUNTRY_LOOKUP[code]?.flag || '🌐'
    };
  }

  // 3. Client Timezone mapping
  const tz = clientPayload.timeZone;
  if (tz && TIMEZONE_TO_COUNTRY[tz]) {
    const code = TIMEZONE_TO_COUNTRY[tz];
    return {
      code,
      name: COUNTRY_LOOKUP[code]?.name || code,
      flag: COUNTRY_LOOKUP[code]?.flag || '🌐'
    };
  }

  // 4. Accept-Language header or client language
  const lang = (clientPayload.lang || req.headers['accept-language'] || '').toLowerCase();
  if (lang.includes('ma') || lang.includes('ar-ma') || lang.includes('ary')) {
    return { code: 'MA', name: 'Morocco', flag: '🇲🇦' };
  }
  if (lang.includes('fr')) {
    return { code: 'FR', name: 'France', flag: '🇫🇷' };
  }
  if (lang.includes('es')) {
    return { code: 'ES', name: 'Spain', flag: '🇪🇸' };
  }

  // Default to Morocco as the primary audience
  return { code: 'MA', name: 'Morocco', flag: '🇲🇦' };
}

function getClientIp(req, clientPayload = {}) {
  // 1. If client sent their public IP detected client-side
  if (clientPayload.clientIp && typeof clientPayload.clientIp === 'string' && clientPayload.clientIp.length >= 7) {
    const clean = clientPayload.clientIp.trim();
    if (clean !== '127.0.0.1' && clean !== '::1' && !clean.startsWith('192.168.') && !clean.startsWith('10.')) {
      return clean;
    }
  }

  // 2. Reverse proxy headers
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first && first !== '::1' && first !== '127.0.0.1') return first.replace('::ffff:', '');
  }

  const realIp = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
  if (realIp && realIp !== '::1' && realIp !== '127.0.0.1') {
    return realIp.replace('::ffff:', '');
  }

  return '105.158.42.112'; // Realistic Moroccan IP fallback for localhost
}

// Simulated active pool (used ONLY when admin explicitly toggles simulation button)
const SIMULATED_VISITORS = [
  { id: 'sim-1', ip: '105.158.42.112', country: { code: 'MA', name: 'Morocco', flag: '🇲🇦' }, city: 'Casablanca', device: 'Mobile', os: 'iOS', browser: 'Safari', mediaTitle: 'Dune: Part Two', mediaType: 'movie', mediaId: '693134', status: 'watching', seconds: 135 },
  { id: 'sim-2', ip: '197.253.18.90', country: { code: 'MA', name: 'Morocco', flag: '🇲🇦' }, city: 'Rabat', device: 'Desktop', os: 'Windows', browser: 'Chrome', mediaTitle: 'Deadpool & Wolverine', mediaType: 'movie', mediaId: '533535', status: 'locker_pending', seconds: 35 },
  { id: 'sim-3', ip: '82.165.197.44', country: { code: 'FR', name: 'France', flag: '🇫🇷' }, city: 'Paris', device: 'Mobile', os: 'Android', browser: 'Chrome', mediaTitle: 'Spider-Man: No Way Home', mediaType: 'movie', mediaId: '634649', status: 'watching', seconds: 120 },
  { id: 'sim-4', ip: '74.125.212.10', country: { code: 'US', name: 'United States', flag: '🇺🇸' }, city: 'New York', device: 'Desktop', os: 'macOS', browser: 'Chrome', mediaTitle: 'Oppenheimer', mediaType: 'movie', mediaId: '872585', status: 'watching', seconds: 240 },
  { id: 'sim-5', ip: '88.19.143.201', country: { code: 'ES', name: 'Spain', flag: '🇪🇸' }, city: 'Madrid', device: 'Mobile', os: 'iOS', browser: 'Safari', mediaTitle: 'Solo Leveling', mediaType: 'tv', mediaId: '209867', status: 'watching', seconds: 50 }
];

// Clean inactive sessions after 180 seconds (3 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastSeen > 180000) {
      activeSessions.delete(id);
    }
  }
}, 10000);

// ==========================================
// 3. API ENDPOINTS
// ==========================================

// Admin Authentication (USER: ADMIN / Password: As.102030)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const userValid = username && String(username).trim().toUpperCase() === 'ADMIN';
  const passValid = password && String(password).trim() === 'As.102030';

  if (userValid && passValid) {
    const token = 'flix_auth_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    return res.json({
      success: true,
      token,
      message: 'Authentication successful. Access granted to Admin Control Panel.'
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid Username or Password. Use USER: ADMIN / Password: As.102030'
  });
});

// Config for Player (Locker ID & Delay)
app.get('/api/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    lockerId: currentConfig.lockerId || '4o7vvr',
    lockerDelay: parseInt(currentConfig.lockerDelay, 10) || 35,
    lockerEnabled: currentConfig.lockerEnabled !== false,
    updatedAt: currentConfig.updatedAt
  });
});

// Update Config from Admin Dashboard (Handles JSON and Form submissions safely)
app.post('/api/config', (req, res) => {
  try {
    const { lockerId, lockerDelay, lockerEnabled } = req.body || {};

    if (lockerId && typeof lockerId === 'string' && lockerId.trim().length > 0) {
      currentConfig.lockerId = lockerId.trim();
    }

    if (lockerDelay !== undefined) {
      const parsed = parseInt(lockerDelay, 10);
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 300) {
        currentConfig.lockerDelay = parsed;
      }
    }

    if (typeof lockerEnabled === 'boolean') {
      currentConfig.lockerEnabled = lockerEnabled;
    } else if (lockerEnabled === 'true' || lockerEnabled === '1') {
      currentConfig.lockerEnabled = true;
    } else if (lockerEnabled === 'false' || lockerEnabled === '0') {
      currentConfig.lockerEnabled = false;
    }

    currentConfig.updatedAt = new Date().toISOString();
    saveConfig(currentConfig);

    console.log(`[Config Updated] Locker ID: "${currentConfig.lockerId}" | Delay: ${currentConfig.lockerDelay}s`);

    res.json({
      success: true,
      message: 'Locker configuration successfully saved and applied!',
      config: currentConfig
    });
  } catch (err) {
    console.error('Error updating config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Safety routes for POST /admin and POST /admin.html (Prevent "Cannot POST /admin" error screen)
app.post(['/admin', '/admin.html'], (req, res) => {
  try {
    const { lockerId, lockerDelay } = req.body || {};
    if (lockerId || lockerDelay) {
      if (lockerId) currentConfig.lockerId = String(lockerId).trim();
      if (lockerDelay) {
        const p = parseInt(lockerDelay, 10);
        if (!isNaN(p)) currentConfig.lockerDelay = p;
      }
      currentConfig.updatedAt = new Date().toISOString();
      saveConfig(currentConfig);
    }
  } catch (e) {}
  res.redirect('/admin');
});

// Heartbeat Telemetry from Visitors (Called on every page visit and stream status change)
app.post('/api/telemetry/heartbeat', (req, res) => {
  try {
    const payload = req.body || {};
    const sessionId = payload.sessionId || `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const ip = getClientIp(req, payload);
    const country = resolveCountry(req, payload);
    const uaInfo = parseUserAgent(req.headers['user-agent'] || '');
    const now = Date.now();

    const isNew = !activeSessions.has(sessionId);
    const existing = activeSessions.get(sessionId) || {
      firstSeen: now,
      totalSeconds: 0
    };

    const sessionData = {
      sessionId,
      ip,
      country,
      city: payload.clientCity || country.name,
      device: payload.clientDevice || uaInfo.device,
      os: payload.clientOS || uaInfo.os,
      browser: payload.clientBrowser || uaInfo.browser,
      page: payload.page || 'home',
      mediaId: payload.mediaId || null,
      mediaType: payload.mediaType || 'movie',
      mediaTitle: payload.mediaTitle || (payload.page === 'watch' ? '1080p Stream' : 'Browsing Catalog'),
      streamServer: payload.streamServer || 'VidLink HD',
      status: payload.status || (payload.page === 'watch' ? 'watching' : 'browsing'),
      playbackSeconds: payload.playbackSeconds || 0,
      firstSeen: existing.firstSeen,
      lastSeen: now,
      duration: Math.max(0, Math.floor((now - existing.firstSeen) / 1000)),
      isReal: true
    };

    activeSessions.set(sessionId, sessionData);

    // Record into recent activity on new session or significant action
    const isWatchStart = payload.status === 'watching' && (!existing.status || existing.status !== 'watching');
    const isLockerTrigger = payload.status === 'locker_triggered' || payload.status === 'locker_pending';
    
    if (isNew || isWatchStart || isLockerTrigger || payload.action === 'log') {
      let actionLabel = 'Entered Catalog';
      if (sessionData.page === 'watch') {
        actionLabel = isLockerTrigger ? 'Locker Triggered' : 'Playing 1080p Stream';
      }

      recentActivityLog.unshift({
        id: `act-${now}-${Math.random().toString(36).substring(2, 5)}`,
        timestamp: new Date().toISOString(),
        ip,
        country,
        mediaTitle: sessionData.mediaTitle,
        mediaType: sessionData.mediaType,
        device: sessionData.device,
        action: actionLabel
      });

      if (recentActivityLog.length > MAX_LOG_ENTRIES) {
        recentActivityLog.pop();
      }
    }

    res.json({
      success: true,
      config: {
        lockerId: currentConfig.lockerId,
        lockerDelay: currentConfig.lockerDelay,
        lockerEnabled: currentConfig.lockerEnabled
      }
    });
  } catch (err) {
    console.error('Telemetry error:', err);
    res.status(500).json({ error: 'Internal telemetry error' });
  }
});

// Admin Radar Data Provider
app.get('/api/admin/radar', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const now = Date.now();
  const realSessions = Array.from(activeSessions.values()).map(s => ({
    ...s,
    duration: Math.max(0, Math.floor((now - s.firstSeen) / 1000)),
    isReal: true
  }));

  let allSessions = [...realSessions];
  if (simulationEnabled) {
    const simWithTimestamps = SIMULATED_VISITORS.map((sim) => ({
      sessionId: sim.id,
      ip: sim.ip,
      country: sim.country,
      city: sim.city,
      device: sim.device,
      os: sim.os,
      browser: sim.browser,
      page: sim.mediaType ? 'watch' : 'home',
      mediaId: sim.mediaId,
      mediaType: sim.mediaType,
      mediaTitle: sim.mediaTitle,
      streamServer: 'VidLink HD',
      status: sim.status,
      playbackSeconds: sim.seconds + Math.floor((Date.now() / 1000) % 60),
      firstSeen: now - (sim.seconds * 1000),
      lastSeen: now,
      duration: sim.seconds + Math.floor((Date.now() / 1000) % 60),
      isReal: false,
      isSimulated: true
    }));
    allSessions = [...realSessions, ...simWithTimestamps];
  }

  // Aggregate country breakdown
  const countryCounts = {};
  const deviceCounts = { Desktop: 0, Mobile: 0, Tablet: 0 };
  let streamingCount = 0;
  let lockerCount = 0;

  allSessions.forEach(s => {
    const cCode = s.country?.code || 'MA';
    if (!countryCounts[cCode]) {
      countryCounts[cCode] = {
        code: cCode,
        name: s.country?.name || 'Morocco',
        flag: s.country?.flag || '🇲🇦',
        count: 0
      };
    }
    countryCounts[cCode].count++;

    if (deviceCounts[s.device] !== undefined) {
      deviceCounts[s.device]++;
    } else {
      deviceCounts.Desktop++;
    }

    if (s.status === 'watching' || s.status === 'unlocked_watching' || s.page === 'watch') {
      streamingCount++;
    }
    if (s.status === 'locker_pending' || s.status === 'locker_triggered') {
      lockerCount++;
    }
  });

  const sortedCountries = Object.values(countryCounts).sort((a, b) => b.count - a.count);

  res.json({
    success: true,
    totalOnline: allSessions.length,
    realCount: realSessions.length,
    simCount: simulationEnabled ? SIMULATED_VISITORS.length : 0,
    simulationEnabled,
    streamingCount,
    lockerCount,
    browsingCount: Math.max(0, allSessions.length - streamingCount),
    config: currentConfig,
    countries: sortedCountries,
    devices: deviceCounts,
    sessions: allSessions,
    recentActivity: recentActivityLog
  });
});

// Toggle Simulation in Admin
app.post('/api/admin/toggle-sim', (req, res) => {
  simulationEnabled = !simulationEnabled;
  res.json({ success: true, simulationEnabled });
});

// Clear Activity Log
app.post('/api/admin/clear-logs', (req, res) => {
  recentActivityLog.length = 0;
  res.json({ success: true, message: 'Activity log cleared' });
});

// Reset Active Sessions (Useful for testing)
app.post('/api/admin/reset-sessions', (req, res) => {
  activeSessions.clear();
  res.json({ success: true, message: 'Active sessions reset' });
});

// ==========================================
// 4. AUTOMATED PROGRAMMATIC SEO (pSEO) APIS
// ==========================================
app.get('/api/articles', (req, res) => {
  const articlesFile = path.join(__dirname, 'articles.json');
  if (fs.existsSync(articlesFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(articlesFile, 'utf8'));
      return res.json({ success: true, count: data.length, articles: data });
    } catch (e) {}
  }
  res.json({ success: true, count: 0, articles: [] });
});

app.post('/api/admin/generate-daily-seo', async (req, res) => {
  try {
    console.log('[API] Triggering manual daily SEO generation...');
    const result = await runDailySeoGeneration();
    res.json(result);
  } catch (err) {
    console.error('[API] SEO Generation Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. STATIC ASSETS & CLEAN ROUTES
// ==========================================
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.xml')) {
      res.setHeader('Content-Type', 'application/xml');
    }
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'watch.html'));
});

app.get('/article', (req, res) => {
  res.sendFile(path.join(__dirname, 'article.html'));
});

app.get('/articles', (req, res) => {
  res.sendFile(path.join(__dirname, 'article.html'));
});

app.get('/unlocked', (req, res) => {
  res.sendFile(path.join(__dirname, 'unlocked.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Automated Daily Cron: Generates 10 new trending articles every 24 hours
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  console.log('[Automated Cron] Running scheduled 24h daily SEO generation...');
  runDailySeoGeneration().catch(e => console.error('[Cron Error]:', e));
}, DAILY_INTERVAL_MS);

// Run initial SEO check 10 seconds after boot
setTimeout(() => {
  const articlesFile = path.join(__dirname, 'articles.json');
  if (!fs.existsSync(articlesFile)) {
    console.log('[Boot SEO Check] Initializing daily trending SEO articles...');
    runDailySeoGeneration().catch(e => console.error('[Boot SEO Error]:', e));
  }
}, 10000);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`FlixStream server running on http://${HOST}:${PORT}`);
  console.log(`Admin Radar Dashboard available at http://${HOST}:${PORT}/admin`);
});

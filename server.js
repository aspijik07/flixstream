import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(express.json());

// ==========================================
// 1. CONFIGURATION STORAGE (LOCKER & RADAR)
// ==========================================
const CONFIG_FILE = path.join(__dirname, 'locker-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading config file:', e);
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
    console.error('Error saving config file:', e);
  }
}

let currentConfig = loadConfig();

// ==========================================
// 2. LIVE RADAR STATE & SESSIONS
// ==========================================
// Key: sessionId -> session object
const activeSessions = new Map();
const recentActivityLog = [];
const MAX_LOG_ENTRIES = 60;
let simulationEnabled = true;

// Helper: Country code to flag emoji & name
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
  CH: { name: 'Switzerland', flag: '🇨🇭' }
};

// Fallback timezone to country
const TIMEZONE_TO_COUNTRY = {
  'Africa/Casablanca': 'MA',
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
  ua = ua.toLowerCase();
  let device = 'Desktop';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  if (/ipad|tablet/i.test(ua)) {
    device = 'Tablet';
  } else if (/mobile|iphone|android|ipod|blackberry|opera mini/i.test(ua)) {
    device = 'Mobile';
  } else {
    device = 'Desktop';
  }

  // OS
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';

  return { device, os, browser };
}

function resolveCountry(req, clientPayload = {}) {
  // 1. Direct reverse proxy headers
  const cfCountry = req.headers['cf-ipcountry'] || req.headers['x-country-code'] || req.headers['x-vercel-ip-country'];
  if (cfCountry && cfCountry.length === 2 && cfCountry !== 'XX') {
    const code = cfCountry.toUpperCase();
    return {
      code,
      name: COUNTRY_LOOKUP[code]?.name || code,
      flag: COUNTRY_LOOKUP[code]?.flag || '🌐'
    };
  }

  // 2. Client TimeZone hint
  const tz = clientPayload.timeZone;
  if (tz && TIMEZONE_TO_COUNTRY[tz]) {
    const code = TIMEZONE_TO_COUNTRY[tz];
    return {
      code,
      name: COUNTRY_LOOKUP[code]?.name || code,
      flag: COUNTRY_LOOKUP[code]?.flag || '🌐'
    };
  }

  // 3. Client Language hint (e.g. fr-FR, es-ES, ar-MA)
  const lang = clientPayload.lang || req.headers['accept-language'] || '';
  if (lang.includes('MA') || lang.includes('ar-ma') || lang.includes('ary')) {
    return { code: 'MA', name: 'Morocco', flag: '🇲🇦' };
  }
  if (lang.includes('FR') || lang.includes('fr-')) {
    return { code: 'FR', name: 'France', flag: '🇫🇷' };
  }
  if (lang.includes('ES') || lang.includes('es-')) {
    return { code: 'ES', name: 'Spain', flag: '🇪🇸' };
  }
  if (lang.includes('DE') || lang.includes('de-')) {
    return { code: 'DE', name: 'Germany', flag: '🇩🇪' };
  }
  if (lang.includes('GB') || lang.includes('en-GB')) {
    return { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' };
  }
  if (lang.includes('US') || lang.includes('en-US')) {
    return { code: 'US', name: 'United States', flag: '🇺🇸' };
  }

  // Fallback default
  return { code: 'US', name: 'United States', flag: '🇺🇸' };
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first && first !== '::1' && first !== '127.0.0.1') return first;
  }
  const realIp = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
  if (realIp && realIp !== '::1' && realIp !== '127.0.0.1') {
    return realIp.replace('::ffff:', '');
  }
  return '197.230.144.' + Math.floor(10 + Math.random() * 80);
}

// Simulated active pool to give the live radar an active realistic display when testing
const SIMULATED_VISITORS = [
  { id: 'sim-1', ip: '105.158.42.112', country: { code: 'MA', name: 'Morocco', flag: '🇲🇦' }, city: 'Casablanca', device: 'Mobile', os: 'iOS', browser: 'Safari', mediaTitle: 'Dune: Part Two', mediaType: 'movie', mediaId: '693134', status: 'watching', seconds: 124 },
  { id: 'sim-2', ip: '197.253.18.90', country: { code: 'MA', name: 'Morocco', flag: '🇲🇦' }, city: 'Rabat', device: 'Desktop', os: 'Windows', browser: 'Chrome', mediaTitle: 'Deadpool & Wolverine', mediaType: 'movie', mediaId: '533535', status: 'locker_pending', seconds: 32 },
  { id: 'sim-3', ip: '82.165.197.44', country: { code: 'FR', name: 'France', flag: '🇫🇷' }, city: 'Paris', device: 'Mobile', os: 'Android', browser: 'Chrome', mediaTitle: 'Spider-Man: No Way Home', mediaType: 'movie', mediaId: '634649', status: 'watching', seconds: 89 },
  { id: 'sim-4', ip: '74.125.212.10', country: { code: 'US', name: 'United States', flag: '🇺🇸' }, city: 'New York', device: 'Desktop', os: 'macOS', browser: 'Chrome', mediaTitle: 'Oppenheimer', mediaType: 'movie', mediaId: '872585', status: 'watching', seconds: 215 },
  { id: 'sim-5', ip: '88.19.143.201', country: { code: 'ES', name: 'Spain', flag: '🇪🇸' }, city: 'Madrid', device: 'Mobile', os: 'iOS', browser: 'Safari', mediaTitle: 'Solo Leveling', mediaType: 'tv', mediaId: '209867', status: 'watching', seconds: 45 },
  { id: 'sim-6', ip: '196.200.170.8', country: { code: 'DZ', name: 'Algeria', flag: '🇩🇿' }, city: 'Algiers', device: 'Mobile', os: 'Android', browser: 'Firefox', mediaTitle: 'Interstellar', mediaType: 'movie', mediaId: '157336', status: 'browsing', seconds: 18 },
  { id: 'sim-7', ip: '178.62.204.15', country: { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' }, city: 'London', device: 'Desktop', os: 'Windows', browser: 'Edge', mediaTitle: 'The Batman', mediaType: 'movie', mediaId: '414906', status: 'watching', seconds: 178 }
];

// Clean inactive sessions every 15s
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.lastSeen > 45000) {
      activeSessions.delete(id);
    }
  }
}, 15000);

// ==========================================
// 3. API ENDPOINTS
// ==========================================

// Config for Player (Locker ID & Delay)
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    lockerId: currentConfig.lockerId || '4o7vvr',
    lockerDelay: parseInt(currentConfig.lockerDelay, 10) || 35,
    lockerEnabled: currentConfig.lockerEnabled !== false,
    updatedAt: currentConfig.updatedAt
  });
});

// Update Config from Admin Dashboard
app.post('/api/config', (req, res) => {
  const { lockerId, lockerDelay, lockerEnabled } = req.body;

  if (lockerId && typeof lockerId === 'string') {
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
  }

  currentConfig.updatedAt = new Date().toISOString();
  saveConfig(currentConfig);

  console.log(`[Config Updated] Locker ID: ${currentConfig.lockerId} | Delay: ${currentConfig.lockerDelay}s`);

  res.json({
    success: true,
    message: 'Locker configuration successfully saved!',
    config: currentConfig
  });
});

// Heartbeat Telemetry from Visitors (called every 10-15s from index.html and watch.html)
app.post('/api/telemetry/heartbeat', (req, res) => {
  try {
    const payload = req.body || {};
    const sessionId = payload.sessionId || `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const ip = getClientIp(req);
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
      device: payload.device || uaInfo.device,
      os: uaInfo.os,
      browser: uaInfo.browser,
      page: payload.page || 'home',
      mediaId: payload.mediaId || null,
      mediaType: payload.mediaType || null,
      mediaTitle: payload.mediaTitle || (payload.page === 'watch' ? 'Streaming Video' : 'Catalog Home'),
      streamServer: payload.streamServer || 'vidlink',
      status: payload.status || (payload.page === 'watch' ? 'watching' : 'browsing'),
      playbackSeconds: payload.playbackSeconds || 0,
      firstSeen: existing.firstSeen,
      lastSeen: now,
      duration: Math.floor((now - existing.firstSeen) / 1000)
    };

    activeSessions.set(sessionId, sessionData);

    // Record into recent activity if newly started stream
    if (payload.page === 'watch' && isNew) {
      recentActivityLog.unshift({
        id: `act-${now}`,
        timestamp: new Date().toISOString(),
        ip,
        country,
        mediaTitle: sessionData.mediaTitle,
        mediaType: sessionData.mediaType,
        device: sessionData.device,
        action: 'Started 1080p Stream'
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
  const now = Date.now();
  const realSessions = Array.from(activeSessions.values()).map(s => ({
    ...s,
    duration: Math.floor((now - s.firstSeen) / 1000)
  }));

  // Merge simulated visitors if enabled to ensure live radar always has rich data
  let allSessions = [...realSessions];
  if (simulationEnabled) {
    const simWithTimestamps = SIMULATED_VISITORS.map((sim, i) => ({
      sessionId: sim.id,
      ip: sim.ip,
      country: sim.country,
      device: sim.device,
      os: sim.os,
      browser: sim.browser,
      page: sim.mediaType ? 'watch' : 'home',
      mediaId: sim.mediaId,
      mediaType: sim.mediaType,
      mediaTitle: sim.mediaTitle,
      streamServer: 'vidlink',
      status: sim.status,
      playbackSeconds: sim.seconds + Math.floor((Date.now() / 1000) % 60),
      firstSeen: now - (sim.seconds * 1000),
      lastSeen: now,
      duration: sim.seconds + Math.floor((Date.now() / 1000) % 60),
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
    const cCode = s.country.code || 'US';
    if (!countryCounts[cCode]) {
      countryCounts[cCode] = {
        code: cCode,
        name: s.country.name,
        flag: s.country.flag,
        count: 0
      };
    }
    countryCounts[cCode].count++;

    if (deviceCounts[s.device] !== undefined) {
      deviceCounts[s.device]++;
    } else {
      deviceCounts.Desktop++;
    }

    if (s.status === 'watching' || s.page === 'watch') {
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

// ==========================================
// 4. STATIC ASSETS & CLEAN ROUTES
// ==========================================
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'watch.html'));
});

app.get('/unlocked', (req, res) => {
  res.sendFile(path.join(__dirname, 'unlocked.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`FlixStream server running on http://${HOST}:${PORT}`);
  console.log(`Admin Radar Dashboard available at http://${HOST}:${PORT}/admin`);
});

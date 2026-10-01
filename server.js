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

function parseAdBlueMedia(rawInput) {
  if (!rawInput) return { id: '4654850', key: 'ea554', url: 'https://adbluemedia.com/cl.php?id=4654850' };
  const str = String(rawInput).trim();
  
  // 1. Check if full script tag or json object (as shown in user video)
  const itMatch = str.match(/["']?it["']?\s*:\s*([0-9]+)/i);
  const keyMatch = str.match(/["']?key["']?\s*:\s*["']([a-zA-Z0-9_-]+)["']/i);
  const scriptMatch = str.match(/src=["'](https?:\/\/[^"']+\.cloudfront\.net\/[^"']+\.js)["']/i);

  if (itMatch) {
    const id = itMatch[1];
    const key = keyMatch ? keyMatch[1] : 'ea554';
    const scriptSrc = scriptMatch ? scriptMatch[1] : '';
    return {
      id: id,
      key: key,
      scriptSrc: scriptSrc,
      url: `https://adbluemedia.com/cl.php?id=${id}`
    };
  }

  // 2. Direct URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    const urlIdMatch = str.match(/[?&]id=([0-9]+)/i);
    return {
      id: urlIdMatch ? urlIdMatch[1] : str,
      key: '',
      scriptSrc: '',
      url: str
    };
  }

  // 3. Simple ID (digits)
  if (/^[0-9]+$/.test(str)) {
    return {
      id: str,
      key: '',
      scriptSrc: '',
      url: `https://adbluemedia.com/cl.php?id=${str}`
    };
  }

  // 4. Shortlink or alphanumeric key (e.g. BfbNGe / ea554)
  return {
    id: str,
    key: str,
    scriptSrc: '',
    url: str.length <= 10 ? `https://adbluemedia.com/cl.php?id=${str}` : `https://d12m39r9m90s76.cloudfront.net/?public_key=${str}`
  };
}

function computeLockerUrl(network = 'ogads', cfg = {}) {
  const net = String(network || 'ogads').toLowerCase();

  if (net === 'custom') {
    const custom = String(cfg.customLockerUrl || cfg.lockerCustomUrl || cfg.lockerId || '').trim();
    return custom || 'https://appcomplete.org/cl/i/4o7vvr';
  }

  if (net === 'adbluemedia') {
    const adblueRaw = cfg.adblueLockerId || cfg.lockerId || '4654850';
    const parsed = parseAdBlueMedia(adblueRaw);
    return parsed.url;
  }

  // Default: OGAds
  const ogadsId = String(cfg.ogadsLockerId || cfg.lockerId || '4o7vvr').trim();
  if (ogadsId.startsWith('http')) return ogadsId;
  return `https://appcomplete.org/cl/i/${encodeURIComponent(ogadsId || '4o7vvr')}`;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const network = parsed.lockerNetwork || 'ogads';
      const ogadsId = parsed.ogadsLockerId || (network === 'ogads' ? parsed.lockerId : '4o7vvr') || '4o7vvr';
      const adblueRaw = parsed.adblueLockerId || (network === 'adbluemedia' ? parsed.lockerId : '4654850') || '4654850';
      const customUrl = parsed.customLockerUrl || parsed.lockerCustomUrl || (network === 'custom' ? parsed.lockerId : '') || '';

      const activeId = network === 'ogads' ? ogadsId : (network === 'adbluemedia' ? adblueRaw : customUrl);

      const cfgObj = {
        lockerNetwork: network,
        lockerId: activeId,
        ogadsLockerId: ogadsId,
        adblueLockerId: adblueRaw,
        customLockerUrl: customUrl,
        lockerDelay: parseInt(parsed.lockerDelay, 10) || 35,
        lockerEnabled: parsed.lockerEnabled !== false,
        updatedAt: parsed.updatedAt || new Date().toISOString()
      };
      cfgObj.lockerUrl = computeLockerUrl(network, cfgObj);
      return cfgObj;
    }
  } catch (e) {
    console.error('[Config Error] Could not read config file:', e);
  }
  return {
    lockerNetwork: 'ogads',
    lockerId: '4o7vvr',
    ogadsLockerId: '4o7vvr',
    adblueLockerId: '4654850',
    customLockerUrl: '',
    lockerDelay: 35,
    lockerEnabled: true,
    lockerUrl: 'https://appcomplete.org/cl/i/4o7vvr',
    updatedAt: new Date().toISOString()
  };
}

function saveConfig(cfg) {
  try {
    cfg.lockerUrl = computeLockerUrl(cfg.lockerNetwork, cfg);
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

// Universal ISO-3166 Country Code to Emoji Flag Converter (All 249 Countries)
function getCountryFlag(countryCode) {
  if (!countryCode || typeof countryCode !== 'string' || countryCode.trim().length !== 2) return '🌐';
  const code = countryCode.trim().toUpperCase();
  if (code === 'XX' || code === 'T1' || code === 'LO' || code === 'UN') return '🌐';
  try {
    const codePoints = [...code].map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '🌐';
  }
}

// Universal Country Name Resolver
const regionNamesEn = (function() {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch (e) {
    return null;
  }
})();

function getCountryName(code) {
  if (!code || code.length !== 2) return 'International';
  const c = code.toUpperCase();
  if (regionNamesEn) {
    try {
      const name = regionNamesEn.of(c);
      if (name) return name;
    } catch(e) {}
  }
  return COUNTRY_LOOKUP[c]?.name || c;
}

function resolveCountry(req, clientPayload = {}) {
  // 1. Client explicitly provided country from GeoIP lookup
  if (clientPayload.countryCode && typeof clientPayload.countryCode === 'string' && clientPayload.countryCode.trim().length === 2) {
    const code = clientPayload.countryCode.trim().toUpperCase();
    return {
      code,
      name: clientPayload.countryName || getCountryName(code),
      flag: getCountryFlag(code)
    };
  }

  // 2. Reverse proxy headers (Cloudflare, Vercel, GCP, AWS)
  const cfCountry = req.headers['cf-ipcountry'] || req.headers['x-country-code'] || req.headers['x-vercel-ip-country'] || req.headers['geoip-country-code'];
  if (cfCountry && cfCountry.trim().length === 2 && cfCountry.toUpperCase() !== 'XX') {
    const code = cfCountry.trim().toUpperCase();
    return {
      code,
      name: getCountryName(code),
      flag: getCountryFlag(code)
    };
  }

  // 3. Client Timezone mapping
  const tz = clientPayload.timeZone;
  if (tz && TIMEZONE_TO_COUNTRY[tz]) {
    const code = TIMEZONE_TO_COUNTRY[tz];
    return {
      code,
      name: getCountryName(code),
      flag: getCountryFlag(code)
    };
  }

  // 4. Accept-Language header fallback
  const langHeader = (clientPayload.lang || req.headers['accept-language'] || '').toLowerCase();
  if (langHeader.includes('fr-fr') || langHeader.startsWith('fr')) return { code: 'FR', name: 'France', flag: '🇫🇷' };
  if (langHeader.includes('ar-dz') || langHeader.includes('dz')) return { code: 'DZ', name: 'Algeria', flag: '🇩🇿' };
  if (langHeader.includes('ar-tn') || langHeader.includes('tn')) return { code: 'TN', name: 'Tunisia', flag: '🇹🇳' };
  if (langHeader.includes('ar-eg') || langHeader.includes('eg')) return { code: 'EG', name: 'Egypt', flag: '🇪🇬' };
  if (langHeader.includes('ar-sa') || langHeader.includes('sa')) return { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' };
  if (langHeader.includes('es-es') || langHeader.startsWith('es')) return { code: 'ES', name: 'Spain', flag: '🇪🇸' };
  if (langHeader.includes('de-de') || langHeader.startsWith('de')) return { code: 'DE', name: 'Germany', flag: '🇩🇪' };
  if (langHeader.includes('en-gb') || langHeader.includes('gb')) return { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' };
  if (langHeader.includes('en-us') || langHeader.startsWith('en')) return { code: 'US', name: 'United States', flag: '🇺🇸' };
  if (langHeader.includes('ar-ma') || langHeader.includes('ma')) return { code: 'MA', name: 'Morocco', flag: '🇲🇦' };

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

  return '105.158.42.112'; // Realistic IP fallback
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

// Config for Player (Locker ID, Network, Delay & Status)
app.get('/api/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    lockerNetwork: currentConfig.lockerNetwork || 'ogads',
    lockerId: currentConfig.lockerId || '4o7vvr',
    ogadsLockerId: currentConfig.ogadsLockerId || '4o7vvr',
    adblueLockerId: currentConfig.adblueLockerId || '4654850',
    customLockerUrl: currentConfig.customLockerUrl || '',
    lockerDelay: parseInt(currentConfig.lockerDelay, 10) || 35,
    lockerEnabled: currentConfig.lockerEnabled !== false,
    lockerUrl: currentConfig.lockerUrl || computeLockerUrl(currentConfig.lockerNetwork, currentConfig),
    updatedAt: currentConfig.updatedAt
  });
});

// Update Config from Admin Dashboard (Handles JSON and Form submissions safely)
app.post('/api/config', (req, res) => {
  try {
    const { 
      lockerNetwork, 
      lockerId, 
      ogadsLockerId, 
      adblueLockerId, 
      customLockerUrl, 
      lockerCustomUrl, 
      lockerDelay, 
      lockerEnabled 
    } = req.body || {};

    if (lockerNetwork && typeof lockerNetwork === 'string') {
      currentConfig.lockerNetwork = lockerNetwork.trim().toLowerCase();
    }

    if (ogadsLockerId !== undefined && typeof ogadsLockerId === 'string') {
      currentConfig.ogadsLockerId = ogadsLockerId.trim();
    }
    if (adblueLockerId !== undefined && typeof adblueLockerId === 'string') {
      currentConfig.adblueLockerId = adblueLockerId.trim();
    }
    if (customLockerUrl !== undefined || lockerCustomUrl !== undefined) {
      currentConfig.customLockerUrl = String(customLockerUrl || lockerCustomUrl || '').trim();
    }

    if (lockerId !== undefined && typeof lockerId === 'string' && lockerId.trim().length > 0) {
      currentConfig.lockerId = lockerId.trim();
      if (currentConfig.lockerNetwork === 'ogads') currentConfig.ogadsLockerId = lockerId.trim();
      if (currentConfig.lockerNetwork === 'adbluemedia') currentConfig.adblueLockerId = lockerId.trim();
      if (currentConfig.lockerNetwork === 'custom') currentConfig.customLockerUrl = lockerId.trim();
    } else {
      if (currentConfig.lockerNetwork === 'ogads') currentConfig.lockerId = currentConfig.ogadsLockerId || '4o7vvr';
      if (currentConfig.lockerNetwork === 'adbluemedia') currentConfig.lockerId = currentConfig.adblueLockerId || '4654850';
      if (currentConfig.lockerNetwork === 'custom') currentConfig.lockerId = currentConfig.customLockerUrl || '';
    }

    if (lockerDelay !== undefined) {
      const parsed = parseInt(lockerDelay, 10);
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 300) {
        currentConfig.lockerDelay = parsed;
      }
    }

    if (typeof lockerEnabled === 'boolean') {
      currentConfig.lockerEnabled = lockerEnabled;
    } else if (lockerEnabled === 'true' || lockerEnabled === '1' || lockerEnabled === 1) {
      currentConfig.lockerEnabled = true;
    } else if (lockerEnabled === 'false' || lockerEnabled === '0' || lockerEnabled === 0) {
      currentConfig.lockerEnabled = false;
    }

    currentConfig.updatedAt = new Date().toISOString();
    saveConfig(currentConfig);

    // Broadcast live config & radar update
    broadcastRadarUpdate();

    console.log(`[Config Updated] Network: ${currentConfig.lockerNetwork} | Enabled: ${currentConfig.lockerEnabled} | ID: "${currentConfig.lockerId}" | Delay: ${currentConfig.lockerDelay}s`);

    res.json({
      success: true,
      message: 'Locker configuration successfully saved and applied live!',
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

    // Trigger instant broadcast to all active Admin Radar screens (<50ms latency)
    broadcastRadarUpdate();

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

// Helper to compile complete real-time radar payload
function buildRadarData() {
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
      streamServer: 'AutoEmbed VIP',
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

  // Aggregate country breakdown with accurate flags
  const countryCounts = {};
  const deviceCounts = { Desktop: 0, Mobile: 0, Tablet: 0 };
  let streamingCount = 0;
  let lockerCount = 0;

  allSessions.forEach(s => {
    const cCode = s.country?.code || 'MA';
    if (!countryCounts[cCode]) {
      countryCounts[cCode] = {
        code: cCode,
        name: s.country?.name || getCountryName(cCode),
        flag: s.country?.flag || getCountryFlag(cCode),
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

  return {
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
  };
}

// Active SSE Admin Connections for 0-latency live radar
const sseRadarClients = new Set();

function broadcastRadarUpdate() {
  if (sseRadarClients.size === 0) return;
  try {
    const payload = JSON.stringify(buildRadarData());
    for (const client of sseRadarClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseRadarClients.delete(client);
      }
    }
  } catch(e) {}
}

// Real-Time Server-Sent Events (SSE) Stream for Radar Dashboard
app.get('/api/admin/radar/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial state immediately
  res.write(`data: ${JSON.stringify(buildRadarData())}\n\n`);
  sseRadarClients.add(res);

  req.on('close', () => {
    sseRadarClients.delete(res);
  });
});

// Admin Radar Data Provider (Polling / Fallback)
app.get('/api/admin/radar', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(buildRadarData());
});

// Toggle Simulation in Admin
app.post('/api/admin/toggle-sim', (req, res) => {
  simulationEnabled = !simulationEnabled;
  broadcastRadarUpdate();
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

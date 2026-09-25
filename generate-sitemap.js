// ==========================================
// FLIXSTREAM pSEO AUTOMATED SITEMAP GENERATOR
// ES Module Standard (Compatible with "type": "module")
// ==========================================
import fs from 'fs';
import path from 'path';

const TMDB_API_KEY = "abdde991ce2a56652d4c0ca156db7836";
const BASE_URL = "https://api.themoviedb.org/3";
const DOMAIN = "https://500get.com";
const TODAY = new Date().toISOString().split('T')[0];

function createSlug(title) {
    return (title || 'media')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function fetchFromTMDB(endpoint) {
    try {
        const sep = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`${BASE_URL}${endpoint}${sep}api_key=${TMDB_API_KEY}&language=en-US`);
        const data = await res.json();
        return data.results || [];
    } catch (e) {
        console.error(`Error fetching ${endpoint}:`, e.message);
        return [];
    }
}

async function generateSitemap() {
    console.log("[pSEO] Fetching latest trending catalog from TMDB...");

    // 1. Fetch Trending Movies, TV Series, Anime & Top Rated
    const [moviesDay, moviesWeek, tvDay, animeList, topRated] = await Promise.all([
        fetchFromTMDB('/trending/movie/day'),
        fetchFromTMDB('/trending/movie/week'),
        fetchFromTMDB('/trending/tv/day'),
        fetchFromTMDB('/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc'),
        fetchFromTMDB('/movie/top_rated')
    ]);

    const urlsMap = new Map();

    // Add Core Pages
    urlsMap.set(`${DOMAIN}/`, { priority: '1.0', changefreq: 'daily' });
    urlsMap.set(`${DOMAIN}/index.html`, { priority: '0.9', changefreq: 'daily' });

    // Process Movies
    const allMovies = [...moviesDay, ...moviesWeek, ...topRated];
    allMovies.forEach(m => {
        if (!m.id) return;
        const slug = createSlug(m.title);
        const url = `${DOMAIN}/watch.html?type=movie&amp;id=${m.id}&amp;slug=${slug}`;
        if (!urlsMap.has(url)) {
            urlsMap.set(url, { priority: '0.8', changefreq: 'weekly' });
        }
    });

    // Process TV Shows & Anime
    const allTV = [...tvDay, ...animeList];
    allTV.forEach(t => {
        if (!t.id) return;
        const slug = createSlug(t.name);
        const url = `${DOMAIN}/watch.html?type=tv&amp;id=${t.id}&amp;slug=${slug}&amp;season=1&amp;episode=1`;
        if (!urlsMap.has(url)) {
            urlsMap.set(url, { priority: '0.8', changefreq: 'weekly' });
        }
    });

    // Build XML Output
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const [loc, meta] of urlsMap.entries()) {
        xml += `  <url>\n`;
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <lastmod>${TODAY}</lastmod>\n`;
        xml += `    <changefreq>${meta.changefreq}</changefreq>\n`;
        xml += `    <priority>${meta.priority}</priority>\n`;
        xml += `  </url>\n`;
    }

    xml += `</urlset>\n`;

    const outputPath = path.join(process.cwd(), 'sitemap.xml');
    fs.writeFileSync(outputPath, xml, 'utf-8');

    console.log(`[pSEO SUCCESS] Generated sitemap.xml with ${urlsMap.size} live URLs!`);
}

generateSitemap();
// ==========================================
// FLIXSTREAM pSEO HIGH-SCALE SITEMAP GENERATOR
// Fetches 1,000+ Live Unique Titles Across Multi-Pages
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

// Fetch multi-pages to scale catalog
async function fetchMultiPages(endpoint, pagesCount = 8) {
    const promises = [];
    for (let p = 1; p <= pagesCount; p++) {
        const sep = endpoint.includes('?') ? '&' : '?';
        promises.push(fetchFromTMDB(`${endpoint}${sep}page=${p}`));
    }
    const pagesResults = await Promise.all(promises);
    return pagesResults.flat();
}

async function generateSitemap() {
    console.log("[pSEO ENGINE] Scaling catalog to 1,000+ titles from TMDB...");

    // Fetch deep multi-page catalog across all media types
    const [
        trendingMovies,
        popularMovies,
        topRatedMovies,
        trendingTV,
        popularTV,
        animeSeries
    ] = await Promise.all([
        fetchMultiPages('/trending/movie/week', 10),      // 200 Movies
        fetchMultiPages('/movie/popular', 10),            // 200 Movies
        fetchMultiPages('/movie/top_rated', 10),          // 200 Movies
        fetchMultiPages('/trending/tv/week', 10),         // 200 TV Series
        fetchMultiPages('/tv/popular', 10),               // 200 TV Series
        fetchMultiPages('/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc', 10) // 200 Anime
    ]);

    const urlsMap = new Map();

    // 1. Core Platform Pages
    urlsMap.set(`${DOMAIN}/`, { priority: '1.0', changefreq: 'daily' });
    urlsMap.set(`${DOMAIN}/index.html`, { priority: '0.9', changefreq: 'daily' });

    // 2. Process All Movies (Deduplicated automatically by Map)
    const allMovies = [...trendingMovies, ...popularMovies, ...topRatedMovies];
    allMovies.forEach(m => {
        if (!m.id) return;
        const slug = createSlug(m.title);
        const url = `${DOMAIN}/watch.html?type=movie&amp;id=${m.id}&amp;slug=${slug}`;
        if (!urlsMap.has(url)) {
            urlsMap.set(url, { priority: '0.8', changefreq: 'weekly' });
        }
    });

    // 3. Process All TV Shows & Anime (Deduplicated automatically by Map)
    const allTV = [...trendingTV, ...popularTV, ...animeSeries];
    allTV.forEach(t => {
        if (!t.id) return;
        const slug = createSlug(t.name);
        const url = `${DOMAIN}/watch.html?type=tv&amp;id=${t.id}&amp;slug=${slug}&amp;season=1&amp;episode=1`;
        if (!urlsMap.has(url)) {
            urlsMap.set(url, { priority: '0.8', changefreq: 'weekly' });
        }
    });

    // 4. Build Clean XML Output
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

    // 5. Write to sitemap.xml
    const outputPath = path.join(process.cwd(), 'sitemap.xml');
    fs.writeFileSync(outputPath, xml, 'utf-8');

    console.log(`==========================================`);
    console.log(`[pSEO SUCCESS] Generated sitemap.xml with ${urlsMap.size} UNIQUE LIVE URLs!`);
    console.log(`==========================================`);
}

generateSitemap();
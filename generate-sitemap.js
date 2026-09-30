// ==========================================
// FLIXSTREAM pSEO HIGH-SCALE SITEMAP GENERATOR
// Scales catalog to 2,500+ Functional Movie & TV Links
// Includes XSL Stylesheet for Human-Readable Luxury UI
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
        return [];
    }
}

async function fetchMultiPages(endpoint, pagesCount = 10) {
    const promises = [];
    for (let p = 1; p <= pagesCount; p++) {
        const sep = endpoint.includes('?') ? '&' : '?';
        promises.push(fetchFromTMDB(`${endpoint}${sep}page=${p}`));
    }
    const pagesResults = await Promise.all(promises);
    return pagesResults.flat();
}

async function generateSitemap() {
    console.log("[pSEO ENGINE] Scaling catalog across multiple years and genres to 2,500+ titles from TMDB...");

    const tasks = [];

    // 1. Trending & Popular Core
    tasks.push(fetchMultiPages('/trending/movie/week', 25));
    tasks.push(fetchMultiPages('/trending/tv/week', 25));
    tasks.push(fetchMultiPages('/movie/top_rated', 25));
    tasks.push(fetchMultiPages('/tv/top_rated', 25));

    // 2. Discover Movies by Year (2026 down to 2015)
    const movieYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
    movieYears.forEach(yr => {
        tasks.push(fetchMultiPages(`/discover/movie?primary_release_year=${yr}&sort_by=popularity.desc&vote_count.gte=50`, 8));
    });

    // 3. Discover TV by Year
    const tvYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
    tvYears.forEach(yr => {
        tasks.push(fetchMultiPages(`/discover/tv?first_air_date_year=${yr}&sort_by=popularity.desc&vote_count.gte=30`, 8));
    });

    // 4. Anime & Animation Special Focus
    tasks.push(fetchMultiPages('/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc', 25));
    tasks.push(fetchMultiPages('/discover/movie?with_genres=16&sort_by=popularity.desc', 20));

    // 5. Popular Genres
    tasks.push(fetchMultiPages('/discover/movie?with_genres=28&sort_by=popularity.desc', 15)); // Action
    tasks.push(fetchMultiPages('/discover/movie?with_genres=878&sort_by=popularity.desc', 15)); // Sci-Fi
    tasks.push(fetchMultiPages('/discover/movie?with_genres=27&sort_by=popularity.desc', 15)); // Horror
    tasks.push(fetchMultiPages('/discover/movie?with_genres=53&sort_by=popularity.desc', 15)); // Thriller

    const results = await Promise.all(tasks);

    const urlsMap = new Map();

    // 1. Core Platform Pages
    urlsMap.set(`${DOMAIN}/`, { priority: '1.0', changefreq: 'daily' });
    urlsMap.set(`${DOMAIN}/index.html`, { priority: '0.9', changefreq: 'daily' });

    // 2. Add Existing Articles from articles.json
    try {
        const articlesPath = path.join(process.cwd(), 'articles.json');
        if (fs.existsSync(articlesPath)) {
            const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
            if (Array.isArray(articles)) {
                articles.forEach(art => {
                    if (art.id && art.slug) {
                        const artUrl = `${DOMAIN}/article.html?id=${art.id}&amp;slug=${art.slug}`;
                        urlsMap.set(artUrl, { priority: '0.9', changefreq: 'daily' });
                    }
                });
            }
        }
    } catch (e) {}

    // 3. Process all media results
    results.flat().forEach(item => {
        if (!item || !item.id) return;
        
        // If it's a Movie
        if (item.title) {
            const slug = createSlug(item.title);
            const url = `${DOMAIN}/watch.html?type=movie&amp;id=${item.id}&amp;slug=${slug}`;
            if (!urlsMap.has(url)) {
                urlsMap.set(url, { priority: '0.8', changefreq: 'weekly' });
            }
        } 
        // If it's a TV Show / Anime
        else if (item.name) {
            const slug = createSlug(item.name);
            const url = `${DOMAIN}/watch.html?type=tv&amp;id=${item.id}&amp;slug=${slug}&amp;season=1&amp;episode=1`;
            if (!urlsMap.has(url)) {
                urlsMap.set(url, { priority: '0.8', changefreq: 'weekly' });
            }
        }
    });

    // 4. Build XML Output WITH XSL Stylesheet for Human View
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<?xml-stylesheet type="text/xsl" href="sitemap.xsl"?>\n`;
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
    console.log(`[pSEO SUCCESS] Generated sitemap.xml with ${urlsMap.size} URLs and Luxury XSL Stylesheet!`);
    console.log(`==========================================`);
}

generateSitemap();
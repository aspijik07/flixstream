// ==========================================
// 1. CONFIGURATION DYAL TMDB API
// ==========================================
const TMDB_API_KEY = "abdde991ce2a56652d4c0ca156db7836"; // <-- 7ETT TMDB API KEY DYALEK HNA!
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BACKDROP_BASE = "https://image.tmdb.org/t/p/original";
const IMG_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

// Function bach t-sawweb clean slug l SubID
function createSlug(title) {
    return (title || 'media')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ==========================================
// 2. NAVBAR SCROLL EFFECT
// ==========================================
window.addEventListener("scroll", () => {
    const navbar = document.getElementById("navbar");
    if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
    } else {
        navbar.classList.remove("scrolled");
    }
});

// ==========================================
// 3. FETCH DATA MN TMDB
// ==========================================
async function fetchMedia(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error("TMDB Fetch Error:", error);
        return [];
    }
}

// Render Hero Banner
function renderHero(item, type = 'movie') {
    const banner = document.getElementById("hero-banner");
    const title = document.getElementById("hero-title");
    const overview = document.getElementById("hero-overview");
    const watchBtn = document.getElementById("hero-watch-btn");
    const infoBtn = document.getElementById("hero-info-btn");

    const name = item.title || item.name;
    const mediaSlug = createSlug(name);
    const watchUrl = `watch.html?type=${type}&id=${item.id}&slug=${mediaSlug}${type === 'tv' ? '&season=1&episode=1' : ''}`;

    if (item.backdrop_path) {
        banner.style.backgroundImage = `url(${IMG_BACKDROP_BASE}${item.backdrop_path})`;
    }
    title.innerText = name;
    overview.innerText = item.overview || "Stream in full 1080p high definition.";

    watchBtn.href = watchUrl;
    infoBtn.href = watchUrl;
}

// Render Cards f les Grids (Movie wla TV)
function renderGrid(items, containerId, mediaType = 'movie') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    items.forEach(item => {
        if (!item.poster_path) return;

        const name = item.title || item.name;
        const mediaSlug = createSlug(name);
        const watchUrl = `watch.html?type=${mediaType}&id=${item.id}&slug=${mediaSlug}${mediaType === 'tv' ? '&season=1&episode=1' : ''}`;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
        const dateStr = item.release_date || item.first_air_date || "";
        const year = dateStr.split("-")[0] || "2026";
        const badgeLabel = mediaType === 'tv' ? 'TV SERIES' : '1080P HD';

        const card = document.createElement("a");
        card.href = watchUrl;
        card.className = "movie-card";
        card.innerHTML = `
            <img src="${IMG_POSTER_BASE}${item.poster_path}" alt="${name}" loading="lazy">
            <div class="card-info">
                <div class="card-title">${name}</div>
                <div class="card-meta">
                    <span class="card-rating">SCORE ${rating}</span>
                    <span>${year}</span>
                    <span class="card-hd-badge">${badgeLabel}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 4. SEARCH FUNCTIONALITY (MULTI-MEDIA)
// ==========================================
const searchInput = document.getElementById("search-input");
const searchSection = document.getElementById("search-results-section");
const searchGrid = document.getElementById("search-grid");

let searchTimeout;
searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (query.length < 2) {
        searchSection.style.display = "none";
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                searchSection.style.display = "block";
                
                searchGrid.innerHTML = "";
                data.results.forEach(item => {
                    if (!item.poster_path || (item.media_type !== 'movie' && item.media_type !== 'tv')) return;
                    
                    const mType = item.media_type;
                    const name = item.title || item.name;
                    const mediaSlug = createSlug(name);
                    const watchUrl = `watch.html?type=${mType}&id=${item.id}&slug=${mediaSlug}${mType === 'tv' ? '&season=1&episode=1' : ''}`;
                    const rating = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
                    const year = (item.release_date || item.first_air_date || "").split("-")[0] || "2026";
                    
                    const card = document.createElement("a");
                    card.href = watchUrl;
                    card.className = "movie-card";
                    card.innerHTML = `
                        <img src="${IMG_POSTER_BASE}${item.poster_path}" alt="${name}" loading="lazy">
                        <div class="card-info">
                            <div class="card-title">${name}</div>
                            <div class="card-meta">
                                <span class="card-rating">SCORE ${rating}</span>
                                <span>${year}</span>
                                <span class="card-hd-badge">${mType === 'tv' ? 'TV SERIES' : '1080P'}</span>
                            </div>
                        </div>
                    `;
                    searchGrid.appendChild(card);
                });
            }
        } catch (err) {
            console.error("Search error:", err);
        }
    }, 400);
});

// ==========================================
// 5. INITIALIZE HOME PAGE
// ==========================================
async function initApp() {
    // 1. Trending Movies
    const trendingMovies = await fetchMedia("/trending/movie/day");
    if (trendingMovies.length > 0) {
        renderHero(trendingMovies[0], 'movie');
        renderGrid(trendingMovies, "trending-grid", 'movie');
    }

    // 2. Trending TV Series (OPTION C ENGINE)
    const trendingTV = await fetchMedia("/trending/tv/day");
    if (trendingTV.length > 0) {
        renderGrid(trendingTV, "tv-grid", 'tv');
    }

    // 3. Top Rated Movies
    const topRatedMovies = await fetchMedia("/movie/top_rated");
    if (topRatedMovies.length > 0) {
        renderGrid(topRatedMovies, "top-rated-grid", 'movie');
    }
}

initApp();
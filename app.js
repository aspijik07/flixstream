// ==========================================
// 1. CONFIGURATION DYAL TMDB API
// ==========================================
const TMDB_API_KEY = "abdde991ce2a56652d4c0ca156db7836"; // API Key dyalek m-7afda 100%
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BACKDROP_BASE = "https://image.tmdb.org/t/p/original";
const IMG_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

let currentHeroItem = null;
let currentModalItem = null;
let currentModalType = 'movie';

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
        const separator = endpoint.includes("?") ? "&" : "?";
        const response = await fetch(`${BASE_URL}${endpoint}${separator}api_key=${TMDB_API_KEY}&language=en-US`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error("TMDB Fetch Error:", error);
        return [];
    }
}

// Render Hero Banner
function renderHero(item, type = 'movie') {
    currentHeroItem = item;
    const banner = document.getElementById("hero-banner");
    const title = document.getElementById("hero-title");
    const overview = document.getElementById("hero-overview");
    const watchBtn = document.getElementById("hero-watch-btn");

    const name = item.title || item.name;
    const mediaSlug = createSlug(name);
    const watchUrl = `watch.html?type=${type}&id=${item.id}&slug=${mediaSlug}${type === 'tv' ? '&season=1&episode=1' : ''}`;

    if (item.backdrop_path) {
        banner.style.backgroundImage = `url(${IMG_BACKDROP_BASE}${item.backdrop_path})`;
    }
    title.innerText = name;
    overview.innerText = item.overview || "Stream in full 1080p high definition.";

    watchBtn.href = watchUrl;
}

// Trigger Hero Trailer Preview
function openHeroTrailerModal() {
    if (currentHeroItem) {
        openPreviewModal(currentHeroItem, 'movie');
    }
}

// ==========================================
// 4. RENDER GRIDS & MODAL HOOK
// ==========================================
function renderGrid(items, containerId, mediaType = 'movie') {
    renderGridItems(items, containerId, mediaType);
}

function renderGridItems(items, containerId, defaultType = 'movie') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    items.forEach(item => {
        if (!item.poster_path) return;

        const mType = item.type || defaultType || (item.title ? 'movie' : 'tv');
        const name = item.title || item.name;
        const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "N/A";
        const dateStr = item.release_date || item.first_air_date || "";
        const year = dateStr.split("-")[0] || "2026";
        const badgeLabel = mType === 'tv' ? 'TV SERIES' : (containerId === 'anime-grid' ? 'ANIME' : '1080P HD');

        const card = document.createElement("div");
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

        // Click kay-fte7 l-Quick Preview Trailer Modal direct!
        card.onclick = () => openPreviewModal(item, mType);
        container.appendChild(card);
    });
}

// ==========================================
// 5. TRAILER QUICK-PREVIEW MODAL ENGINE
// ==========================================
async function openPreviewModal(item, type = 'movie') {
    currentModalItem = item;
    currentModalType = type;

    const modal = document.getElementById("trailer-modal");
    const iframe = document.getElementById("modal-trailer-iframe");
    const fallback = document.getElementById("trailer-fallback-backdrop");

    modal.style.display = "flex";

    const name = item.title || item.name;
    const mediaSlug = createSlug(name);
    const watchUrl = `watch.html?type=${type}&id=${item.id}&slug=${mediaSlug}${type === 'tv' ? '&season=1&episode=1' : ''}`;

    document.getElementById("modal-title").innerText = name;
    document.getElementById("modal-overview").innerText = item.overview || "Stream in full 1080p high definition with zero latency.";
    
    const dateStr = item.release_date || item.first_air_date || "";
    document.getElementById("modal-year").innerText = dateStr.split("-")[0] || "2026";
    document.getElementById("modal-score").innerText = `SCORE ${item.vote_average ? Number(item.vote_average).toFixed(1) : "N/A"}`;
    document.getElementById("modal-type-badge").innerText = type === 'tv' ? 'TV SERIES' : '1080P FULL HD';
    document.getElementById("modal-play-btn").href = watchUrl;

    updateWatchlistBtnState(item.id);

    // Fetch Details for Runtime & Genres
    try {
        const detailRes = await fetch(`${BASE_URL}/${type}/${item.id}?api_key=${TMDB_API_KEY}&language=en-US`);
        const detailData = await detailRes.json();
        
        const runtime = detailData.runtime || (detailData.episode_run_time && detailData.episode_run_time[0]) || 45;
        document.getElementById("modal-runtime").innerText = `${runtime} min`;
        
        const genresWrap = document.getElementById("modal-genres");
        genresWrap.innerHTML = "";
        (detailData.genres || []).forEach(g => {
            const span = document.createElement("span");
            span.className = "genre-badge";
            span.innerText = g.name;
            genresWrap.appendChild(span);
        });
    } catch (e) {
        console.error("Modal details error:", e);
    }

    // Fetch Trailer Video mn YouTube
    try {
        const vidRes = await fetch(`${BASE_URL}/${type}/${item.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
        const vidData = await vidRes.json();
        const videos = vidData.results || [];
        
        let trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer');
        if (!trailer) trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Teaser');
        if (!trailer) trailer = videos.find(v => v.site === 'YouTube');

        if (trailer && trailer.key) {
            fallback.style.display = "none";
            iframe.style.display = "block";
            iframe.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=0&controls=1&rel=0`;
        } else {
            iframe.src = "";
            iframe.style.display = "none";
            fallback.style.display = "block";
            if (item.backdrop_path) {
                fallback.style.backgroundImage = `url(${IMG_BACKDROP_BASE}${item.backdrop_path})`;
            }
        }
    } catch (err) {
        iframe.src = "";
    }
}

function closeTrailerModal() {
    const modal = document.getElementById("trailer-modal");
    const iframe = document.getElementById("modal-trailer-iframe");
    iframe.src = "";
    modal.style.display = "none";
}

// Close modal when clicking outside box
window.addEventListener("click", (e) => {
    const modal = document.getElementById("trailer-modal");
    if (e.target === modal) {
        closeTrailerModal();
    }
});

// ==========================================
// 6. MY LIST (WATCHLIST) ENGINE
// ==========================================
function getWatchlist() {
    return JSON.parse(localStorage.getItem('flix_watchlist') || '[]');
}

function saveWatchlist(list) {
    localStorage.setItem('flix_watchlist', JSON.stringify(list));
}

function isInWatchlist(id) {
    const list = getWatchlist();
    return list.some(item => String(item.id) === String(id));
}

function updateWatchlistBtnState(id) {
    const btnText = document.getElementById("watchlist-btn-text");
    if (!btnText) return;
    if (isInWatchlist(id)) {
        btnText.innerText = "In My List (Remove)";
    } else {
        btnText.innerText = "Add to My List";
    }
}

function toggleWatchlistFromModal() {
    if (!currentModalItem) return;
    let list = getWatchlist();
    const id = currentModalItem.id;
    
    if (isInWatchlist(id)) {
        list = list.filter(item => String(item.id) !== String(id));
    } else {
        list.unshift({
            id: currentModalItem.id,
            title: currentModalItem.title || currentModalItem.name,
            poster_path: currentModalItem.poster_path,
            vote_average: currentModalItem.vote_average,
            release_date: currentModalItem.release_date || currentModalItem.first_air_date,
            type: currentModalType
        });
    }
    saveWatchlist(list);
    updateWatchlistBtnState(id);
    renderWatchlistGrid();
}

function renderWatchlistGrid() {
    const list = getWatchlist();
    const grid = document.getElementById("my-list-grid");
    if (!grid) return;
    
    if (list.length === 0) {
        grid.innerHTML = "<p class='empty-notice' style='color:#777; font-size:13px; padding:20px 0;'>Your saved watchlist is currently empty. Click on any title to preview and add it to your list.</p>";
        return;
    }
    grid.innerHTML = "";
    renderGridItems(list, "my-list-grid", 'mixed');
}

function clearWatchlist() {
    localStorage.removeItem('flix_watchlist');
    renderWatchlistGrid();
    if (currentModalItem) updateWatchlistBtnState(currentModalItem.id);
}

// ==========================================
// 7. WATCH HISTORY ENGINE
// ==========================================
function getWatchHistory() {
    return JSON.parse(localStorage.getItem('flix_history') || '[]');
}

function renderHistoryGrid() {
    const list = getWatchHistory();
    const grid = document.getElementById("history-grid");
    if (!grid) return;

    if (list.length === 0) {
        grid.innerHTML = "<p class='empty-notice' style='color:#777; font-size:13px; padding:20px 0;'>No watch history recorded yet. Start streaming any title to track your playback session.</p>";
        return;
    }
    grid.innerHTML = "";
    renderGridItems(list, "history-grid", 'mixed');
}

function clearWatchHistory() {
    localStorage.removeItem('flix_history');
    renderHistoryGrid();
}

// ==========================================
// 8. CATEGORY FILTER PILLS
// ==========================================
function filterCategory(category, buttonEl) {
    if (buttonEl) {
        document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
        buttonEl.classList.add("active");
    }

    const secTrending = document.getElementById("trending-section");
    const secTV = document.getElementById("tv-section");
    const secAnime = document.getElementById("anime-section");
    const secTopRated = document.getElementById("top-rated-section");
    const secHistory = document.getElementById("history-section");
    const secMyList = document.getElementById("my-list-section");
    const secSearch = document.getElementById("search-results-section");

    if (secSearch) secSearch.style.display = "none";

    if (category === 'all') {
        secTrending.style.display = "block";
        secTV.style.display = "block";
        secAnime.style.display = "block";
        secTopRated.style.display = "block";
        secHistory.style.display = "none";
        secMyList.style.display = "none";
    } else if (category === 'movies') {
        secTrending.style.display = "block";
        secTopRated.style.display = "block";
        secTV.style.display = "none";
        secAnime.style.display = "none";
        secHistory.style.display = "none";
        secMyList.style.display = "none";
        secTrending.scrollIntoView({ behavior: 'smooth' });
    } else if (category === 'tv') {
        secTV.style.display = "block";
        secTrending.style.display = "none";
        secAnime.style.display = "none";
        secTopRated.style.display = "none";
        secHistory.style.display = "none";
        secMyList.style.display = "none";
        secTV.scrollIntoView({ behavior: 'smooth' });
    } else if (category === 'anime') {
        secAnime.style.display = "block";
        secTrending.style.display = "none";
        secTV.style.display = "none";
        secTopRated.style.display = "none";
        secHistory.style.display = "none";
        secMyList.style.display = "none";
        secAnime.scrollIntoView({ behavior: 'smooth' });
    } else if (category === 'mylist') {
        secMyList.style.display = "block";
        renderWatchlistGrid();
        secTrending.style.display = "none";
        secTV.style.display = "none";
        secAnime.style.display = "none";
        secTopRated.style.display = "none";
        secHistory.style.display = "none";
        secMyList.scrollIntoView({ behavior: 'smooth' });
    } else if (category === 'history') {
        secHistory.style.display = "block";
        renderHistoryGrid();
        secTrending.style.display = "none";
        secTV.style.display = "none";
        secAnime.style.display = "none";
        secTopRated.style.display = "none";
        secMyList.style.display = "none";
        secHistory.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==========================================
// 9. SEARCH FUNCTIONALITY (MULTI-MEDIA)
// ==========================================
const searchInput = document.getElementById("search-input");
const searchSection = document.getElementById("search-results-section");
const searchGrid = document.getElementById("search-grid");

let searchTimeout;
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            if (searchSection) searchSection.style.display = "none";
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    if (searchSection) searchSection.style.display = "block";
                    renderGridItems(data.results.filter(i => i.media_type === 'movie' || i.media_type === 'tv'), "search-grid", 'mixed');
                }
            } catch (err) {
                console.error("Search error:", err);
            }
        }, 400);
    });
}

// ==========================================
// 10. INITIALIZE HOME PAGE
// ==========================================
async function initApp() {
    // 1. Trending Movies
    const trendingMovies = await fetchMedia("/trending/movie/day");
    if (trendingMovies.length > 0) {
        renderHero(trendingMovies[0], 'movie');
        renderGrid(trendingMovies, "trending-grid", 'movie');
    }

    // 2. Trending TV Series
    const trendingTV = await fetchMedia("/trending/tv/day");
    if (trendingTV.length > 0) {
        renderGrid(trendingTV, "tv-grid", 'tv');
    }

    // 3. Trending Anime (Japanese Animation)
    const trendingAnime = await fetchMedia("/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc");
    if (trendingAnime.length > 0) {
        renderGrid(trendingAnime, "anime-grid", 'tv');
    }

    // 4. Top Rated Movies
    const topRatedMovies = await fetchMedia("/movie/top_rated");
    if (topRatedMovies.length > 0) {
        renderGrid(topRatedMovies, "top-rated-grid", 'movie');
    }

    // Initialize Watchlist & History grids
    renderWatchlistGrid();
    renderHistoryGrid();
}

initApp();
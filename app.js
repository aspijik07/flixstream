// ==========================================
// 1. CONFIGURATION DYAL TMDB API
// ==========================================
const TMDB_API_KEY = "abdde991ce2a56652d4c0ca156db7836"; // <-- 7ETT API KEY DYALEK HNA!
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BACKDROP_BASE = "https://image.tmdb.org/t/p/original";
const IMG_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

// Function bach t-sawweb clean slug l SubID (mital: "Deadpool & Wolverine" -> "deadpool-wolverine")
function createSlug(title) {
    return title
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
async function fetchMovies(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error("TMDB Fetch Error:", error);
        return [];
    }
}

// Render Hero Banner b l-film numéro 1
function renderHero(movie) {
    const banner = document.getElementById("hero-banner");
    const title = document.getElementById("hero-title");
    const overview = document.getElementById("hero-overview");
    const watchBtn = document.getElementById("hero-watch-btn");
    const infoBtn = document.getElementById("hero-info-btn");

    const movieSlug = createSlug(movie.title || movie.name);
    const watchUrl = `watch.html?id=${movie.id}&slug=${movieSlug}`;

    banner.style.backgroundImage = `url(${IMG_BACKDROP_BASE}${movie.backdrop_path})`;
    title.innerText = movie.title || movie.name;
    overview.innerText = movie.overview;

    watchBtn.href = watchUrl;
    infoBtn.href = watchUrl;
}

// Render Cards f les Grids
function renderGrid(movies, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    movies.forEach(movie => {
        if (!movie.poster_path) return;

        const movieSlug = createSlug(movie.title || movie.name);
        const watchUrl = `watch.html?id=${movie.id}&slug=${movieSlug}`;
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
        const year = (movie.release_date || "").split("-")[0] || "2026";

        const card = document.createElement("a");
        card.href = watchUrl;
        card.className = "movie-card";
        card.innerHTML = `
            <img src="${IMG_POSTER_BASE}${movie.poster_path}" alt="${movie.title || movie.name}" loading="lazy">
            <div class="card-info">
                <div class="card-title">${movie.title || movie.name}</div>
                <div class="card-meta">
                    <span class="card-rating">★ ${rating}</span>
                    <span>${year}</span>
                    <span class="card-hd-badge">HD</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// 4. SEARCH FUNCTIONALITY
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
            const res = await fetch(`${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                searchSection.style.display = "block";
                renderGrid(data.results, "search-grid");
            }
        } catch (err) {
            console.error("Search error:", err);
        }
    }, 400);
});

// ==========================================
// 5. INITIALIZE APP
// ==========================================
async function initApp() {
    // 1. Fetch Trending movies
    const trendingMovies = await fetchMovies("/trending/movie/day");
    if (trendingMovies.length > 0) {
        // Hero y-akhod l-film l-ewwel
        renderHero(trendingMovies[0]);
        // B9iya y-mchiw l grid
        renderGrid(trendingMovies, "trending-grid");
    }

    // 2. Fetch Top Rated movies
    const topRatedMovies = await fetchMovies("/movie/top_rated");
    if (topRatedMovies.length > 0) {
        renderGrid(topRatedMovies, "top-rated-grid");
    }
}

initApp();
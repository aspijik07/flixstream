// ==========================================
// 1. CONFIGURATION
// ==========================================
const TMDB_API_KEY = "abdde991ce2a56652d4c0ca156db7836"; // <-- 7ETT TMDB API KEY DYALEK HNA!
const OGADS_LOCKER_ID = "4o7vvr"; 
const OGADS_BASE_URL = `https://appcomplete.org/cl/i/${OGADS_LOCKER_ID}`;

// Parse URL Parameters (id & slug & unlocked)
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get("id");
const movieSlug = urlParams.get("slug") || "movie";
const isUnlockedParam = urlParams.get("unlocked") === "true";

if (!movieId) {
    window.location.href = "index.html";
}

// Ila ja mn Redirect (unlocked=true)
if (isUnlockedParam) {
    localStorage.setItem(`unlocked_${movieId}`, "true");
}

let timerStarted = false;
let isUnlocked = localStorage.getItem(`unlocked_${movieId}`) === "true";
let activeStreamUrl = "";

// ==========================================
// 2. STREAM SERVERS (VidSrc.to howa Server 1 Default)
// ==========================================
const servers = {
    vidsrcto: `https://vidsrc.to/embed/movie/${movieId}`,
    vidsrc: `https://vidsrc.cc/v2/embed/movie/${movieId}`,
    vidlink: `https://vidlink.pro/movie/${movieId}`,
    autoembed: `https://player.autoembed.cc/embed/movie/${movieId}`
};

function loadStreamServer(serverName) {
    const iframe = document.getElementById("movie-iframe");
    activeStreamUrl = servers[serverName];
    iframe.src = activeStreamUrl;
}

function switchServer(serverName, btn) {
    document.querySelectorAll(".server-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadStreamServer(serverName);
}

// ==========================================
// 3. FETCH MOVIE DETAILS MN TMDB
// ==========================================
async function loadMovieDetails() {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`);
        const movie = await res.json();

        // 1. Details
        document.title = `Watch ${movie.title} (1080p HD) - FlixStream`;
        document.getElementById("movie-detail-title").innerText = movie.title;
        document.getElementById("movie-detail-overview").innerText = movie.overview || "No synopsis available.";
        document.getElementById("movie-detail-year").innerText = (movie.release_date || "").split("-")[0] || "2024";
        document.getElementById("movie-detail-rating").innerText = `★ ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}`;
        document.getElementById("movie-detail-runtime").innerText = `${movie.runtime || 110} min`;
        
        if (movie.poster_path) {
            document.getElementById("movie-detail-poster").src = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
        }

        // Genres
        const genresContainer = document.getElementById("movie-detail-genres");
        genresContainer.innerHTML = "";
        (movie.genres || []).forEach(g => {
            const span = document.createElement("span");
            span.className = "genre-badge";
            span.innerText = g.name;
            genresContainer.appendChild(span);
        });

        // 2. Set Photo 3 Dynamic Title
        document.getElementById("locker-movie-title").innerText = `Verification: ${movie.title}`;

        // 3. Set Dynamic Locker URL m3a SubID Tracking
        const dynamicUrl = `${OGADS_BASE_URL}?aff_sub=${encodeURIComponent(movieSlug)}&aff_sub2=${encodeURIComponent(movieId)}`;
        document.getElementById("ogads-embed-frame").src = dynamicUrl;
        document.getElementById("ogads-direct-btn").href = dynamicUrl;

        // 4. Auto-load Server 1 (VidSrc.to)
        loadStreamServer("vidsrcto");

        // Ila kan deja unlocked, 7eyed l-overlay o tl9 l-film direct
        if (isUnlocked) {
            document.getElementById("play-trigger-overlay").style.display = "none";
        }

    } catch (err) {
        console.error("Error loading movie:", err);
    }
}

// ==========================================
// 4. THE 15-SECOND HOOK & LOCK (M3A PAUSE DYAL SA7)
// ==========================================
function startMovieStreaming() {
    // 1. 7eyed l-overlay dyal l-bdya
    document.getElementById("play-trigger-overlay").style.display = "none";

    // Ila kan deja unlocked ma t-tl3ch l-locker
    if (isUnlocked) return;

    // 2. Demari Timer dyal 15 Tanya
    if (!timerStarted) {
        timerStarted = true;
        setTimeout(() => {
            if (!isUnlocked) {
                // A) PAUSE L-FILM: Khwi l-iframe bach y-skot s-sot o l-video f l-blast!
                const movieIframe = document.getElementById("movie-iframe");
                movieIframe.src = "about:blank";

                // B) Sauvgardi l-film f LocalStorage bach y-rje3 lih
                localStorage.setItem("last_movie_url", window.location.href);
                localStorage.setItem("last_movie_id", movieId);

                // C) Tl3 l-locker modal dyal Photo 3
                document.getElementById("ogads-locker-modal").style.display = "flex";
            }
        }, 15000); // 15 Seconds
    }
}

function handleVerifyClick() {
    localStorage.setItem("last_movie_url", window.location.href);
    localStorage.setItem("last_movie_id", movieId);
}

// Initialiser l-page
loadMovieDetails();
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
let currentMovieTitle = "Movie";

// ==========================================
// 2. STREAM SERVERS (VidLink howa Server 1 Default)
// ==========================================
const servers = {
    vidlink: `https://vidlink.pro/movie/${movieId}`,
    vidsrcto: `https://vidsrc.to/embed/movie/${movieId}`,
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

        currentMovieTitle = movie.title || "Movie";

        // 1. Details
        document.title = `Watch ${movie.title} (1080p HD) - FlixStream`;
        document.getElementById("movie-detail-title").innerText = movie.title;
        document.getElementById("movie-detail-overview").innerText = movie.overview || "No synopsis available.";
        document.getElementById("movie-detail-year").innerText = (movie.release_date || "").split("-")[0] || "2024";
        document.getElementById("movie-detail-rating").innerText = `SCORE ${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}`;
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

        // 2. Set Photo 3 Dynamic Title (Clean - No Emoji)
        document.getElementById("locker-movie-title").innerText = `Verification: ${movie.title}`;

        // 3. Set Dynamic Locker URL m3a Tracking
        const dynamicUrl = `${OGADS_BASE_URL}?aff_sub=${encodeURIComponent(movieSlug)}&aff_sub2=${encodeURIComponent(movieId)}`;
        document.getElementById("ogads-embed-frame").src = dynamicUrl;
        document.getElementById("ogads-direct-btn").href = dynamicUrl;

        // 4. Auto-load Server 1 (VidLink HD Clean)
        loadStreamServer("vidlink");

        // 5. Initialize Social Proof Reviews m3a smyt had l-film
        renderDynamicReviews(currentMovieTitle);

        // Ila kan deja unlocked, 7eyed l-overlay o tl9 l-film direct
        if (isUnlocked) {
            document.getElementById("play-trigger-overlay").style.display = "none";
        }

    } catch (err) {
        console.error("Error loading movie:", err);
    }
}

// ==========================================
// 4. THE 15-SECOND HOOK & LOCK
// ==========================================
function startMovieStreaming() {
    document.getElementById("play-trigger-overlay").style.display = "none";

    if (isUnlocked) return;

    if (!timerStarted) {
        timerStarted = true;
        setTimeout(() => {
            if (!isUnlocked) {
                // Pause Stream
                const movieIframe = document.getElementById("movie-iframe");
                movieIframe.src = "about:blank";

                localStorage.setItem("last_movie_url", window.location.href);
                localStorage.setItem("last_movie_id", movieId);

                document.getElementById("ogads-locker-modal").style.display = "flex";
            }
        }, 15000); // 15 Seconds
    }
}

function handleVerifyClick() {
    localStorage.setItem("last_movie_url", window.location.href);
    localStorage.setItem("last_movie_id", movieId);
}

// ==========================================
// 5. SOCIAL PROOF & LIVE REVIEWS LOGIC
// ==========================================
const baseReviews = [
    {
        user: "Marcus_K",
        initials: "MK",
        time: "4 minutes ago",
        text: "Was hesitant at first with the sponsor check, but completed one free app task and the 1080p stream for {TITLE} unlocked instantly. Clear audio and zero lag."
    },
    {
        user: "SarahJenkins",
        initials: "SJ",
        time: "14 minutes ago",
        text: "Solid mirror server. Verified in under 45 seconds on my phone and now streaming {TITLE} in full HD. Well worth the quick step."
    },
    {
        user: "David_B92",
        initials: "DB",
        time: "32 minutes ago",
        text: "Clean stream with working subtitles. Server 1 loaded up right away after verification. Much better than shady pop-up sites."
    },
    {
        user: "ElenaR",
        initials: "ER",
        time: "51 minutes ago",
        text: "Playback resumed right where it paused. Highly recommend switching to Server 1 if you want the highest bitrate on {TITLE}."
    }
];

function renderDynamicReviews(title) {
    const container = document.getElementById("reviews-container");
    container.innerHTML = "";

    baseReviews.forEach(rev => {
        const card = document.createElement("div");
        card.className = "review-item";
        card.innerHTML = `
            <div class="review-item-header">
                <div class="reviewer-meta">
                    <div class="reviewer-avatar">${rev.initials}</div>
                    <span class="reviewer-name">${rev.user}</span>
                    <span class="verified-pill">VERIFIED STREAMER</span>
                </div>
                <span class="review-time">${rev.time}</span>
            </div>
            <p class="review-text">${rev.text.replace(/{TITLE}/g, `<strong>${title}</strong>`)}</p>
        `;
        container.appendChild(card);
    });
}

function submitUserReview() {
    const input = document.getElementById("user-review-input");
    const val = input.value.trim();
    if (val.length < 5) return;

    const container = document.getElementById("reviews-container");
    const card = document.createElement("div");
    card.className = "review-item";
    card.innerHTML = `
        <div class="review-item-header">
            <div class="reviewer-meta">
                <div class="reviewer-avatar">YOU</div>
                <span class="reviewer-name">Guest User</span>
                <span class="verified-pill">VERIFIED STREAMER</span>
            </div>
            <span class="review-time">Just now</span>
        </div>
        <p class="review-text">${val}</p>
    `;

    container.insertBefore(card, container.firstChild);
    input.value = "";
}

// Live Viewer Count Fluctuator (Dynamic vitality)
let baseViewerCount = 1420;
setInterval(() => {
    const delta = Math.floor(Math.random() * 7) - 3;
    baseViewerCount += delta;
    const el = document.getElementById("live-counter");
    if (el) el.innerText = baseViewerCount.toLocaleString();
}, 4000);

// Initialiser l-page
loadMovieDetails();
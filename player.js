// ==========================================
// 1. CONFIGURATION
// ==========================================
const TMDB_API_KEY = "abdde991ce2a56652d4c0ca156db7836"; // <-- 7ETT TMDB API KEY DYALEK HNA!
const OGADS_LOCKER_ID = "4o7vvr"; 
const OGADS_BASE_URL = `https://appcomplete.org/cl/i/${OGADS_LOCKER_ID}`;

// Parse URL Parameters (type, id, slug, season, episode, unlocked)
const urlParams = new URLSearchParams(window.location.search);
const mediaType = urlParams.get("type") || "movie";
const mediaId = urlParams.get("id");
const mediaSlug = urlParams.get("slug") || "media";
let currentSeason = parseInt(urlParams.get("season")) || 1;
let currentEpisode = parseInt(urlParams.get("episode")) || 1;
const isUnlockedParam = urlParams.get("unlocked") === "true";

if (!mediaId) {
    window.location.href = "index.html";
}

// Storage Key
const unlockStorageKey = `unlocked_${mediaType}_${mediaId}`;
if (isUnlockedParam) {
    localStorage.setItem(unlockStorageKey, "true");
}

let timerStarted = false;
let isUnlocked = localStorage.getItem(unlockStorageKey) === "true";
let activeStreamUrl = "";
let currentMediaTitle = "Media";
let activeServer = "vidlink";

// ==========================================
// 2. STREAM SERVERS BUILDER
// ==========================================
function getStreamServers(season = 1, episode = 1) {
    if (mediaType === "tv") {
        return {
            vidlink: `https://vidlink.pro/tv/${mediaId}/${season}/${episode}`,
            vidsrcto: `https://vidsrc.to/embed/tv/${mediaId}/${season}/${episode}`,
            autoembed: `https://player.autoembed.cc/embed/tv/${mediaId}/${season}/${episode}`
        };
    } else {
        return {
            vidlink: `https://vidlink.pro/movie/${mediaId}`,
            vidsrcto: `https://vidsrc.to/embed/movie/${mediaId}`,
            autoembed: `https://player.autoembed.cc/embed/movie/${mediaId}`
        };
    }
}

function loadStreamServer(serverName) {
    activeServer = serverName;
    const servers = getStreamServers(currentSeason, currentEpisode);
    const iframe = document.getElementById("movie-iframe");
    activeStreamUrl = servers[serverName] || servers.vidlink;
    iframe.src = activeStreamUrl;
}

function switchServer(serverName, btn) {
    document.querySelectorAll(".server-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadStreamServer(serverName);
}

// ==========================================
// 3. FETCH MEDIA DATA
// ==========================================
async function loadMediaDetails() {
    try {
        const endpoint = mediaType === "tv" ? `/tv/${mediaId}` : `/movie/${mediaId}`;
        const res = await fetch(`https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}&language=en-US`);
        const data = await res.json();

        currentMediaTitle = data.title || data.name || "Media";
        const mediaEpTag = mediaType === 'tv' ? `(S${currentSeason} E${currentEpisode})` : '';
        const pageTitle = `Watch ${currentMediaTitle} ${mediaEpTag} (1080p Full HD) - FlixStream`;

        // Details Cards
        document.title = pageTitle;
        document.getElementById("movie-detail-title").innerText = currentMediaTitle;
        document.getElementById("movie-detail-overview").innerText = data.overview || "Stream in full high definition with zero latency.";
        
        const dateStr = data.release_date || data.first_air_date || "";
        document.getElementById("movie-detail-year").innerText = dateStr.split("-")[0] || "2026";
        document.getElementById("movie-detail-rating").innerText = `SCORE ${data.vote_average ? data.vote_average.toFixed(1) : "N/A"}`;
        
        const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 50;
        document.getElementById("movie-detail-runtime").innerText = `${runtime} min`;
        document.getElementById("media-type-badge").innerText = mediaType === 'tv' ? 'TV SERIES' : '1080P FULL HD';

        const posterUrl = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
        const backdropUrl = data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : posterUrl;

        if (posterUrl) {
            document.getElementById("movie-detail-poster").src = posterUrl;
        }

        // OpenGraph Updates
        if (backdropUrl) {
            document.getElementById("og-image")?.setAttribute("content", backdropUrl);
            document.getElementById("tw-image")?.setAttribute("content", backdropUrl);
        }
        document.getElementById("og-title")?.setAttribute("content", pageTitle);
        document.getElementById("tw-title")?.setAttribute("content", pageTitle);

        // Genres
        const genresContainer = document.getElementById("movie-detail-genres");
        genresContainer.innerHTML = "";
        (data.genres || []).forEach(g => {
            const span = document.createElement("span");
            span.className = "genre-badge";
            span.innerText = g.name;
            genresContainer.appendChild(span);
        });

        // Set Dynamic SubID Tracking for Option B (1-Step Inside Embed)
        updateLockerTracking();

        // Auto-load Server 1 Default
        loadStreamServer("vidlink");

        // TV Show Panel Check
        if (mediaType === "tv") {
            document.getElementById("tv-panel").style.display = "block";
            document.getElementById("tv-show-name").innerText = `${currentMediaTitle} Episodes`;
            renderSeasonDropdown(data.seasons || []);
            loadSeasonEpisodes(currentSeason);
        }

        // Reviews Proof
        renderDynamicReviews(currentMediaTitle);

        if (isUnlocked) {
            document.getElementById("play-trigger-overlay").style.display = "none";
        }

    } catch (err) {
        console.error("Error loading media:", err);
    }
}

// Update Locker Tracking SubID (Option B Embed)
function updateLockerTracking() {
    const subTracking = mediaType === 'tv' 
        ? `${mediaSlug}-s${currentSeason}e${currentEpisode}` 
        : `${mediaSlug}`;
    
    // Inject dynamic tracking SubID direct l l-iframe wst l-card
    const dynamicUrl = `${OGADS_BASE_URL}?aff_sub=${encodeURIComponent(subTracking)}&aff_sub2=${encodeURIComponent(mediaId)}`;
    const embedFrame = document.getElementById("ogads-embed-frame");
    if (embedFrame) {
        embedFrame.src = dynamicUrl;
    }
}

// ==========================================
// 4. TV SEASONS & EPISODES SYSTEM
// ==========================================
function renderSeasonDropdown(seasons) {
    const select = document.getElementById("season-select");
    select.innerHTML = "";

    seasons.forEach(s => {
        if (s.season_number <= 0) return;
        const opt = document.createElement("option");
        opt.value = s.season_number;
        opt.innerText = `Season ${s.season_number} (${s.episode_count} Episodes)`;
        if (s.season_number === currentSeason) opt.selected = true;
        select.appendChild(opt);
    });
}

async function changeSeason(newSeason) {
    currentSeason = parseInt(newSeason);
    await loadSeasonEpisodes(currentSeason);
}

async function loadSeasonEpisodes(seasonNum) {
    const container = document.getElementById("episodes-container");
    container.innerHTML = "<p class='episodes-loading'>Loading season episodes...</p>";

    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${mediaId}/season/${seasonNum}?api_key=${TMDB_API_KEY}&language=en-US`);
        const seasonData = await res.json();
        const episodes = seasonData.episodes || [];

        container.innerHTML = "";
        episodes.forEach(ep => {
            const card = document.createElement("div");
            card.className = `episode-card ${ep.episode_number === currentEpisode ? 'active' : ''}`;
            const stillImg = ep.still_path 
                ? `https://image.tmdb.org/t/p/w300${ep.still_path}` 
                : 'https://via.placeholder.com/300x170/1a1a1a/444444?text=Episode';

            card.innerHTML = `
                <div class="ep-thumb-wrap">
                    <img src="${stillImg}" alt="EP ${ep.episode_number}" loading="lazy">
                    <span class="ep-number-tag">EP ${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number}</span>
                </div>
                <div class="ep-meta">
                    <h4 class="ep-title">${ep.name || `Episode ${ep.episode_number}`}</h4>
                    <p class="ep-overview">${ep.overview || "Click to stream this episode in 1080p Full HD."}</p>
                </div>
            `;

            card.onclick = () => selectEpisode(ep.episode_number);
            container.appendChild(card);
        });

    } catch (err) {
        container.innerHTML = "<p class='episodes-loading'>Error loading episodes. Please retry.</p>";
    }
}

function selectEpisode(epNumber) {
    currentEpisode = parseInt(epNumber);

    document.querySelectorAll(".episode-card").forEach((c, idx) => {
        c.classList.toggle("active", (idx + 1) === currentEpisode);
    });

    loadStreamServer(activeServer);

    const newUrl = `watch.html?type=tv&id=${mediaId}&slug=${mediaSlug}&season=${currentSeason}&episode=${currentEpisode}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    timerStarted = false;
    document.getElementById("play-trigger-overlay").style.display = "none";
    updateLockerTracking();

    window.scrollTo({ top: 120, behavior: 'smooth' });
    startMovieStreaming();
}

// ==========================================
// 5. THE 15-SECOND HOOK & LOCK
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
                localStorage.setItem("last_movie_id", mediaId);

                document.getElementById("ogads-locker-modal").style.display = "flex";
            }
        }, 15000); // 15 Seconds
    }
}

// ==========================================
// 6. SOCIAL PROOF DASHBOARD
// ==========================================
const baseReviews = [
    {
        user: "Marcus_K",
        initials: "MK",
        gradient: "linear-gradient(135deg, #e50914, #800000)",
        time: "3m ago",
        text: "Verified stream for {TITLE} on Server 1. Verification completed in under 40s via mobile app, full 1080p stream resumed immediately with zero lag.",
        chips: ["1080P AUDIO 5.1", "SERVER 1"]
    },
    {
        user: "SarahJenkins",
        initials: "SJ",
        gradient: "linear-gradient(135deg, #3b82f6, #1e3a8a)",
        time: "14m ago",
        text: "Was hesitant at first, but sponsor check is legitimate. Audio and video in sync for {TITLE}. Highly recommend this mirror over broken sites.",
        chips: ["STABLE CDN", "FAST UNLOCK"]
    },
    {
        user: "David_B92",
        initials: "DB",
        gradient: "linear-gradient(135deg, #10b981, #065f46)",
        time: "28m ago",
        text: "Clean stream with working subtitles. Server 1 loaded up right away after verification. Much better than shady pop-up sites.",
        chips: ["SUBTITLES OK", "NO BUFFER"]
    },
    {
        user: "ElenaR",
        initials: "ER",
        gradient: "linear-gradient(135deg, #8b5cf6, #4c1d95)",
        time: "46m ago",
        text: "Playback resumed right where it paused. Highest bitrate stream I found today for {TITLE}. Well worth the 30-second verification.",
        chips: ["HD 60FPS", "SERVER 1"]
    }
];

function renderDynamicReviews(title) {
    const container = document.getElementById("reviews-container");
    if (!container) return;
    container.innerHTML = "";

    baseReviews.forEach(rev => {
        const card = document.createElement(
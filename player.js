// ==========================================
// 1. CONFIGURATION & I18N
// ==========================================
const TMDB_API_KEY = "abdde991ce2a56652d4c0ca156db7836";
const OGADS_LOCKER_ID = "4o7vvr"; 
const OGADS_BASE_URL = `https://appcomplete.org/cl/i/${OGADS_LOCKER_ID}`;

// Parse URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const mediaType = urlParams.get("type") || "movie";
const mediaId = urlParams.get("id");
const mediaSlug = urlParams.get("slug") || "media";
let currentSeason = parseInt(urlParams.get("season")) || 1;
let currentEpisode = parseInt(urlParams.get("episode")) || 1;
const isUnlockedParam = urlParams.get("unlocked") === "true";

// Language State
let currentLang = urlParams.get("lang") || localStorage.getItem("flix_lang") || "en";
const tmdbLangMap = {
    en: "en-US",
    fr: "fr-FR",
    es: "es-ES",
    de: "de-DE"
};

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

let playbackSeconds = 0;
let historyTrackerInterval = null;

// i18n Dictionary for Watch Page
const watchI18nDict = {
    en: {
        nav_back_browse: "Back to Browse",
        telemetry_streaming: "VIEWERS STREAMING NOW",
        telemetry_source: "SOURCE: 1080P ULTRA",
        telemetry_health: "SERVER HEALTH: 99.8%",
        btn_start_streaming: "Start Streaming in 1080p Full HD",
        player_subtext: "Fast CDN Mirror &bull; Multi-Subtitles &bull; Dolby Audio",
        locker_title: "HUMAN VERIFICATION",
        locker_subtitle: "Complete one of the quick steps below to continue streaming",
        locker_waiting: "Waiting to complete",
        notice_banner: "STREAM MIRROR NOTICE: If current mirror experiences buffering, switch between Server 1 (VidLink), Server 2 (AutoEmbed), or Server 3 (VidSrc CC) below.",
        label_switch_server: "Switch Mirror:",
        episodes_tag: "SERIES EPISODES",
        label_select_season: "Select Season:",
        proof_tag: "REAL-TIME AUDIT LOG",
        proof_title: "Viewer Playback Verification",
        proof_desc: "Live stream verification reports submitted across international CDN nodes",
        btn_submit_report: "SUBMIT REPORT"
    },
    fr: {
        nav_back_browse: "Retour au Catalogue",
        telemetry_streaming: "SPECTATEURS EN DIRECT",
        telemetry_source: "SOURCE: 1080P ULTRA",
        telemetry_health: "ÉTAT DU SERVEUR: 99.8%",
        btn_start_streaming: "Lancer la Lecture en 1080p Full HD",
        player_subtext: "Miroir CDN Rapide &bull; Multi-Sous-titres &bull; Audio Dolby",
        locker_title: "VÉRIFICATION HUMAINE",
        locker_subtitle: "Effectuez une étape rapide ci-dessous pour continuer la lecture",
        locker_waiting: "En attente de validation",
        notice_banner: "NOTE DU LECTEUR: Si la vidéo ralentit, changez entre Serveur 1 (VidLink), Serveur 2 (AutoEmbed) ou Serveur 3 (VidSrc CC) ci-dessous.",
        label_switch_server: "Changer de Serveur:",
        episodes_tag: "ÉPISODES DE LA SÉRIE",
        label_select_season: "Choisir la Saison:",
        proof_tag: "JOURNAL D'AUDIT EN DIRECT",
        proof_title: "Vérification de Lecture par les Spectateurs",
        proof_desc: "Rapports de vérification en direct soumis sur les serveurs CDN mondiaux",
        btn_submit_report: "ENVOYER LE RAPPORT"
    },
    es: {
        nav_back_browse: "Volver al Catálogo",
        telemetry_streaming: "ESPECTADORES EN LÍNEA",
        telemetry_source: "FUENTE: 1080P ULTRA",
        telemetry_health: "ESTADO SERVIDOR: 99.8%",
        btn_start_streaming: "Iniciar Reproducción en 1080p Full HD",
        player_subtext: "Servidor CDN Rápido &bull; Subtítulos &bull; Audio Dolby",
        locker_title: "VERIFICACIÓN HUMANA",
        locker_subtitle: "Completa un paso rápido a continuación para continuar viendo",
        locker_waiting: "Esperando confirmación",
        notice_banner: "AVISO: Si la reproducción se detiene, cambia entre Servidor 1 (VidLink), Servidor 2 (AutoEmbed) o Servidor 3 (VidSrc CC).",
        label_switch_server: "Cambiar Servidor:",
        episodes_tag: "EPISODIOS DE LA SERIE",
        label_select_season: "Seleccionar Temporada:",
        proof_tag: "REGISTRO EN TIEMPO REAL",
        proof_title: "Verificación de Reproducción",
        proof_desc: "Informes de verificación de transmisión en vivo en nodos CDN internacionales",
        btn_submit_report: "ENVIAR INFORME"
    },
    de: {
        nav_back_browse: "Zurück zur Übersicht",
        telemetry_streaming: "ZUSCHAUER LIVE",
        telemetry_source: "QUELLE: 1080P ULTRA",
        telemetry_health: "SERVER STATUS: 99.8%",
        btn_start_streaming: "Stream in 1080p Full HD Starten",
        player_subtext: "Schneller CDN Server &bull; Untertitel &bull; Dolby Audio",
        locker_title: "MENSCHLICHE VERIFIZIERUNG",
        locker_subtitle: "Schließe einen kurzen Schritt ab um das Streaming fortzusetzen",
        locker_waiting: "Warten auf Bestätigung",
        notice_banner: "SERVER HINWEIS: Bei Pufferung wechseln Sie bitte zwischen Server 1, Server 2 oder Server 3 unten.",
        label_switch_server: "Server Wechseln:",
        episodes_tag: "SERIEN EPISODEN",
        label_select_season: "Staffel Wählen:",
        proof_tag: "ECHTZEIT PRÜFPROTOKOLL",
        proof_title: "Wiedergabeverifizierung der Zuschauer",
        proof_desc: "Live-Verifizierungsberichte über internationale CDN-Knoten",
        btn_submit_report: "BERICHT SENDEN"
    }
};

function applyWatchTranslations(lang) {
    const dict = watchI18nDict[lang] || watchI18nDict.en;
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (dict[key]) el.innerHTML = dict[key];
    });

    const select = document.getElementById("lang-select");
    if (select) select.value = lang;
}

function changeLanguage(newLang) {
    currentLang = newLang;
    localStorage.setItem("flix_lang", newLang);

    const url = new URL(window.location);
    url.searchParams.set("lang", newLang);
    window.history.pushState({}, '', url);

    applyWatchTranslations(newLang);
    loadMediaDetails();
}

// ==========================================
// 2. STREAM SERVERS (CLEAN MIRRORS)
// ==========================================
function getStreamServers(season = 1, episode = 1) {
    const isTv = mediaType === "tv";
    return {
        vidlink: isTv 
            ? `https://vidlink.pro/tv/${mediaId}/${season}/${episode}` 
            : `https://vidlink.pro/movie/${mediaId}`,
        autoembed: isTv 
            ? `https://player.autoembed.cc/embed/tv/${mediaId}/${season}/${episode}` 
            : `https://player.autoembed.cc/embed/movie/${mediaId}`,
        vidsrccc: isTv 
            ? `https://vidsrc.cc/v2/embed/tv/${mediaId}/${season}/${episode}` 
            : `https://vidsrc.cc/v2/embed/movie/${mediaId}`,
        smashy: isTv 
            ? `https://embed.smashystream.com/playere.php?tmdb=${mediaId}&season=${season}&episode=${episode}` 
            : `https://embed.smashystream.com/playere.php?tmdb=${mediaId}`
    };
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
// 3. FETCH MEDIA DATA & GENERATE JSON-LD SCHEMA
// ==========================================
async function loadMediaDetails() {
    try {
        applyWatchTranslations(currentLang);
        
        const tmdbLang = tmdbLangMap[currentLang] || "en-US";
        const endpoint = mediaType === "tv" ? `/tv/${mediaId}` : `/movie/${mediaId}`;
        const res = await fetch(`https://api.themoviedb.org/3${endpoint}?api_key=${TMDB_API_KEY}&language=${tmdbLang}`);
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
        document.getElementById("movie-detail-rating").innerText = `SCORE ${data.vote_average ? Number(data.vote_average).toFixed(1) : "N/A"}`;
        
        const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || 45;
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

        // Generate JSON-LD Schema.org for Google Video Rich Snippets
        generateSchemaMarkup(data, backdropUrl, runtime, dateStr);

        // Genres
        const genresContainer = document.getElementById("movie-detail-genres");
        genresContainer.innerHTML = "";
        (data.genres || []).forEach(g => {
            const span = document.createElement("span");
            span.className = "genre-badge";
            span.innerText = g.name;
            genresContainer.appendChild(span);
        });

        // Set Dynamic SubID Tracking
        updateLockerTracking();

        // Auto-load Server 1 Default (VidLink)
        loadStreamServer("vidlink");

        // Save session entry to History
        saveToWatchHistory(data);

        // TV Show Panel Check
        if (mediaType === "tv") {
            document.getElementById("tv-panel").style.display = "block";
            document.getElementById("tv-show-name").innerText = `${currentMediaTitle} Episodes`;
            renderSeasonDropdown(data.seasons || []);
            loadSeasonEpisodes(currentSeason);
        }

        // Reviews Proof localized
        renderDynamicReviews(currentMediaTitle);

        if (isUnlocked) {
            document.getElementById("play-trigger-overlay").style.display = "none";
        }

    } catch (err) {
        console.error("Error loading media:", err);
    }
}

// Generate Google Video & Movie JSON-LD Schema Markup
function generateSchemaMarkup(data, image, runtimeMinutes, releaseDate) {
    try {
        const schemaEl = document.getElementById("schema-jsonld");
        if (!schemaEl) return;

        const isTv = mediaType === "tv";
        const currentUrl = window.location.href;

        let schemaObject = {};

        if (isTv) {
            schemaObject = {
                "@context": "https://schema.org",
                "@type": "TVEpisode",
                "name": `${currentMediaTitle} S${currentSeason}E${currentEpisode}`,
                "description": data.overview || "Stream episode in 1080p Full HD on FlixStream.",
                "image": image || "https://image.tmdb.org/t/p/original/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
                "episodeNumber": currentEpisode,
                "partOfSeason": {
                    "@type": "TVSeason",
                    "seasonNumber": currentSeason
                },
                "partOfSeries": {
                    "@type": "TVSeries",
                    "name": currentMediaTitle
                },
                "duration": `PT${runtimeMinutes}M`,
                "potentialAction": {
                    "@type": "WatchAction",
                    "target": currentUrl
                }
            };
        } else {
            schemaObject = {
                "@context": "https://schema.org",
                "@type": "Movie",
                "name": currentMediaTitle,
                "description": data.overview || "Watch full movie stream in 1080p HD on FlixStream.",
                "image": image || "https://image.tmdb.org/t/p/original/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
                "dateCreated": releaseDate || "2026-01-01",
                "duration": `PT${runtimeMinutes}M`,
                "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": data.vote_average ? String(data.vote_average) : "9.8",
                    "bestRating": "10",
                    "worstRating": "1",
                    "ratingCount": "1420"
                },
                "potentialAction": {
                    "@type": "WatchAction",
                    "target": currentUrl
                }
            };
        }

        schemaEl.text = JSON.stringify(schemaObject);
    } catch (e) {
        console.error("Schema generation error:", e);
    }
}

function updateLockerTracking() {
    const subTracking = mediaType === 'tv' 
        ? `${mediaSlug}-s${currentSeason}e${currentEpisode}-${currentLang}` 
        : `${mediaSlug}-${currentLang}`;
    
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
        const tmdbLang = tmdbLangMap[currentLang] || "en-US";
        const res = await fetch(`https://api.themoviedb.org/3/tv/${mediaId}/season/${seasonNum}?api_key=${TMDB_API_KEY}&language=${tmdbLang}`);
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

    const newUrl = `watch.html?type=tv&id=${mediaId}&slug=${mediaSlug}&season=${currentSeason}&episode=${currentEpisode}&lang=${currentLang}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    timerStarted = false;
    document.getElementById("play-trigger-overlay").style.display = "none";
    updateLockerTracking();

    window.scrollTo({ top: 120, behavior: 'smooth' });
    startMovieStreaming();
}

// ==========================================
// 5. THE 35-SECOND HOOK & LOCK
// ==========================================
function startMovieStreaming() {
    document.getElementById("play-trigger-overlay").style.display = "none";

    startHistoryTracker();

    if (isUnlocked) return;

    if (!timerStarted) {
        timerStarted = true;
        setTimeout(() => {
            if (!isUnlocked) {
                const movieIframe = document.getElementById("movie-iframe");
                movieIframe.src = "about:blank";

                localStorage.setItem("last_movie_url", window.location.href);
                localStorage.setItem("last_movie_id", mediaId);

                document.getElementById("ogads-locker-modal").style.display = "flex";
            }
        }, 35000);
    }
}

function handleVerifyClick() {
    localStorage.setItem("last_movie_url", window.location.href);
    localStorage.setItem("last_movie_id", mediaId);
}

// ==========================================
// 6. WATCH HISTORY ENGINE
// ==========================================
function saveToWatchHistory(data) {
    try {
        let history = JSON.parse(localStorage.getItem('flix_history') || '[]');
        const currentId = String(mediaId);

        history = history.filter(item => !(String(item.id) === currentId && item.type === mediaType));

        const entry = {
            id: mediaId,
            title: currentMediaTitle,
            poster_path: data.poster_path || '',
            backdrop_path: data.backdrop_path || '',
            vote_average: data.vote_average || 0,
            release_date: data.release_date || data.first_air_date || '2026',
            type: mediaType,
            season: currentSeason,
            episode: currentEpisode,
            timestamp: Date.now(),
            watched_duration: "00:00"
        };

        history.unshift(entry);
        if (history.length > 25) history = history.slice(0, 25);
        localStorage.setItem('flix_history', JSON.stringify(history));
    } catch (e) {
        console.error("History save error:", e);
    }
}

function startHistoryTracker() {
    if (historyTrackerInterval) clearInterval(historyTrackerInterval);
    historyTrackerInterval = setInterval(() => {
        playbackSeconds++;
        const mins = Math.floor(playbackSeconds / 60);
        const secs = playbackSeconds % 60;
        const formatted = `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;

        try {
            let history = JSON.parse(localStorage.getItem('flix_history') || '[]');
            if (history.length > 0 && String(history[0].id) === String(mediaId)) {
                history[0].watched_duration = formatted;
                history[0].timestamp = Date.now();
                localStorage.setItem('flix_history', JSON.stringify(history));
            }
        } catch (e) {}
    }, 1000);
}

// ==========================================
// 7. LOCALIZED SOCIAL PROOF DASHBOARD
// ==========================================
const localizedReviews = {
    en: [
        { user: "Marcus_K", initials: "MK", gradient: "linear-gradient(135deg, #e50914, #800000)", time: "3m ago", text: "Verified stream for {TITLE} on Server 1. Verification completed in under 40s via mobile app, full 1080p stream resumed immediately with zero lag.", chips: ["1080P AUDIO 5.1", "SERVER 1"] },
        { user: "SarahJenkins", initials: "SJ", gradient: "linear-gradient(135deg, #3b82f6, #1e3a8a)", time: "14m ago", text: "Was hesitant at first, but sponsor check is legitimate. Audio and video in sync for {TITLE}. Highly recommend this mirror over broken sites.", chips: ["STABLE CDN", "FAST UNLOCK"] },
        { user: "David_B92", initials: "DB", gradient: "linear-gradient(135deg, #10b981, #065f46)", time: "28m ago", text: "Clean stream with working subtitles. Server 1 loaded up right away after verification. Much better than shady pop-up sites.", chips: ["SUBTITLES OK", "NO BUFFER"] }
    ],
    fr: [
        { user: "Jean_Luc", initials: "JL", gradient: "linear-gradient(135deg, #e50914, #800000)", time: "Il y a 3 min", text: "Flux vérifié pour {TITLE} sur le Serveur 1. Validation effectuée en moins de 40s sur mobile, lecture 1080p reprise immédiatement sans aucun bug.", chips: ["1080P AUDIO 5.1", "SERVEUR 1"] },
        { user: "Claire_D", initials: "CD", gradient: "linear-gradient(135deg, #3b82f6, #1e3a8a)", time: "Il y a 14 min", text: "J'hésitais au début, mais la vérification est rapide et sécurisée. Son et image parfaitement synchronisés pour {TITLE}.", chips: ["CDN STABLE", "DÉBLOCAGE RAPIDE"] },
        { user: "Antoine_M", initials: "AM", gradient: "linear-gradient(135deg, #10b981, #065f46)", time: "Il y a 28 min", text: "Lecture propre avec sous-titres fonctionnels. Le serveur 1 s'est lancé immédiatement après validation.", chips: ["SOUS-TITRES OK", "SANS COUPURE"] }
    ],
    es: [
        { user: "Carlos_R", initials: "CR", gradient: "linear-gradient(135deg, #e50914, #800000)", time: "Hace 3 min", text: "Transmisión verificada para {TITLE} en el Servidor 1. Verificación rápida en menos de 40s, reproducción 1080p continua sin cortes.", chips: ["1080P AUDIO 5.1", "SERVIDOR 1"] },
        { user: "Lucia_M", initials: "LM", gradient: "linear-gradient(135deg, #3b82f6, #1e3a8a)", time: "Hace 14 min", text: "Tenía dudas al principio, pero la verificación es 100% real. Audio y video en sincronía para {TITLE}.", chips: ["CDN ESTABLE", "DESBLOQUEO RÁPIDO"] },
        { user: "Mateo_G", initials: "MG", gradient: "linear-gradient(135deg, #10b981, #065f46)", time: "Hace 28 min", text: "Excelente calidad de transmisión con subtítulos. El Servidor 1 cargó al instante tras la verificación.", chips: ["SUBTÍTULOS OK", "SIN BUFFER"] }
    ],
    de: [
        { user: "Felix_W", initials: "FW", gradient: "linear-gradient(135deg, #e50914, #800000)", time: "Vor 3 Min", text: "Verifizierter Stream für {TITLE} auf Server 1. Schnelle Überprüfung in unter 40s, 1080p-Stream läuft direkt flüssig weiter.", chips: ["1080P AUDIO 5.1", "SERVER 1"] },
        { user: "Laura_S", initials: "LS", gradient: "linear-gradient(135deg, #3b82f6, #1e3a8a)", time: "Vor 14 Min", text: "War erst skeptisch, aber der Sponsor-Check ist echt. Bild und Ton synchron für {TITLE}.", chips: ["STABILER CDN", "SCHNELL FREIGESCHALTET"] },
        { user: "Maximilian_K", initials: "MK", gradient: "linear-gradient(135deg, #10b981, #065f46)", time: "Vor 28 Min", text: "Klarer Stream mit funktionierenden Untertiteln. Server 1 lief sofort nach der Überprüfung an.", chips: ["UNTERTITEL OK", "KEIN PUFFERN"] }
    ]
};

function renderDynamicReviews(title) {
    const container = document.getElementById("reviews-container");
    if (!container) return;
    container.innerHTML = "";

    const list = localizedReviews[currentLang] || localizedReviews.en;

    list.forEach(rev => {
        const card = document.createElement("div");
        card.className = "review-card-item";
        card.innerHTML = `
            <div>
                <div class="card-top-row">
                    <div class="user-identity">
                        <div class="user-avatar-circle" style="background: ${rev.gradient}">${rev.initials}</div>
                        <div class="user-handle-wrap">
                            <span class="user-handle">${rev.user}</span>
                            <span class="verified-tag">${currentLang === 'fr' ? 'SPECTATEUR VÉRIFIÉ' : (currentLang === 'es' ? 'ESPECTADOR VERIFICADO' : (currentLang === 'de' ? 'VERIFIZIERTER ZUSCHAUER' : 'VERIFIED STREAMER'))}</span>
                        </div>
                    </div>
                    <span class="timestamp-text">${rev.time}</span>
                </div>
                <p class="card-comment-text">${rev.text.replace(/{TITLE}/g, `<strong>${title}</strong>`)}</p>
            </div>
            <div class="card-footer-tags">
                ${rev.chips.map(c => `<span class="meta-chip-clean">${c}</span>`).join('')}
            </div>
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
    card.className = "review-card-item";
    card.innerHTML = `
        <div>
            <div class="card-top-row">
                <div class="user-identity">
                    <div class="user-avatar-circle" style="background: linear-gradient(135deg, #e50914, #ff4d58)">YOU</div>
                    <div class="user-handle-wrap">
                        <span class="user-handle">Guest Streamer</span>
                        <span class="verified-tag">${currentLang === 'fr' ? 'SPECTATEUR VÉRIFIÉ' : 'VERIFIED STREAMER'}</span>
                    </div>
                </div>
                <span class="timestamp-text">${currentLang === 'fr' ? "À l'instant" : "Just now"}</span>
            </div>
            <p class="card-comment-text">${val}</p>
        </div>
        <div class="card-footer-tags">
            <span class="meta-chip-clean">LIVE REPORT</span>
            <span class="meta-chip-clean">CONFIRMED</span>
        </div>
    `;

    container.insertBefore(card, container.firstChild);
    input.value = "";
}

// Live Viewer Count Fluctuator
let baseViewerCount = 1424;
setInterval(() => {
    const delta = Math.floor(Math.random() * 7) - 3;
    baseViewerCount += delta;
    const el = document.getElementById("live-counter");
    if (el) el.innerText = baseViewerCount.toLocaleString();
}, 4000);

// Initialiser l-page
loadMediaDetails();
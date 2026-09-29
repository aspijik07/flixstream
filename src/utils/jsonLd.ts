export type MovieGenre = {
  id?: number;
  name?: string | null;
};

export type MovieCastMember = {
  id?: number;
  name?: string | null;
  character?: string | null;
  profile_path?: string | null;
  known_for_department?: string | null;
};

export type MovieCrewMember = {
  id?: number;
  name?: string | null;
  job?: string | null;
  department?: string | null;
};

export type MovieData = {
  id?: number | string;
  slug?: string;
  title?: string | null;
  name?: string | null;
  original_title?: string | null;
  overview?: string | null;
  tagline?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  runtime?: number | null;
  vote_average?: number | null;
  vote_count?: number | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: MovieGenre[] | null;
  cast?: MovieCastMember[] | null;
  crew?: MovieCrewMember[] | null;
  imdb_id?: string | null;
  homepage?: string | null;
  original_language?: string | null;
  production_companies?: Array<{ id?: number; name?: string | null }> | null;
  spoken_languages?: Array<{ iso_639_1?: string | null; name?: string | null }> | null;
  webUrl?: string | null;
  mobileUrl?: string | null;
};

export type ExternalIds = {
  imdb_id?: string | null;
  wikidata_id?: string | null;
  facebook_id?: string | null;
  instagram_id?: string | null;
  twitter_id?: string | null;
  youtube_id?: string | null;
};

const ACTOR_WIKIDATA_MAP: Record<string, string> = {
  "leonardo dicaprio": "Q38111",
  "margot robbie": "Q40577",
  "tom hanks": "Q2263",
  "scarlett johansson": "Q34436",
  "brad pitt": "Q35332",
  "angelina jolie": "Q13909",
  "john travolta": "Q171937",
  "keanu reeves": "Q43416",
  "matt damon": "Q175975",
  "jennifer lawrence": "Q41384",
  "viola davis": "Q229249",
  "makoto shinkai": "Q256821",
  "ryuichi sakamoto": "Q258109",
  "ryunosuke kamiki": "Q115570",
  "daisuke namikawa": "Q115303",
  "hugh jackman": "Q122784",
  "mila kunis": "Q201963",
  "timothée chalamet": "Q182870",
  "zendaya": "Q25809"
};

function normalizeName(value?: string | null): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toWikidataUrl(id?: string | null): string | null {
  if (!id) return null;
  const cleanedId = String(id).trim();
  if (!cleanedId) return null;
  if (cleanedId.startsWith("http://") || cleanedId.startsWith("https://")) {
    return cleanedId;
  }
  return `https://www.wikidata.org/wiki/${cleanedId}`;
}

function resolveActorWikidataId(actorName?: string | null): string | null {
  const normalized = normalizeName(actorName);
  if (!normalized) return null;
  return ACTOR_WIKIDATA_MAP[normalized] || null;
}

function asStringArray(values?: Array<string | null | undefined>): string[] {
  return (values || []).filter((value): value is string => Boolean(value && value.trim()));
}

export function getMovieJsonLd(movieData: MovieData, externalIds: ExternalIds = {}): Record<string, unknown> {
  const movieTitle = movieData.title || movieData.name || "Untitled Movie";
  const releaseDate = movieData.release_date || movieData.first_air_date || undefined;
  const runtimeMinutes = movieData.runtime ?? undefined;
  const posterUrl = movieData.poster_path
    ? `https://image.tmdb.org/t/p/original${movieData.poster_path}`
    : undefined;
  const backdropUrl = movieData.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`
    : posterUrl;
  const watchPath = movieData.webUrl || movieData.mobileUrl || `https://500get.com/watch.html?type=movie&id=${movieData.id ?? ""}&slug=${encodeURIComponent(movieData.slug || movieData.title || "movie")}`;

  const sameAs = asStringArray([
    externalIds.wikidata_id ? toWikidataUrl(externalIds.wikidata_id) : null,
    externalIds.imdb_id ? `https://www.imdb.com/title/${externalIds.imdb_id}/` : null,
    externalIds.facebook_id ? `https://www.facebook.com/${externalIds.facebook_id}` : null,
    externalIds.instagram_id ? `https://www.instagram.com/${externalIds.instagram_id}/` : null,
    externalIds.twitter_id ? `https://x.com/${externalIds.twitter_id}` : null,
    externalIds.youtube_id ? `https://www.youtube.com/${externalIds.youtube_id}` : null,
    movieData.homepage || null
  ]);

  const genreList = (movieData.genres || [])
    .map((genre) => genre.name)
    .filter((name): name is string => Boolean(name && name.trim()));

  const actorList = (movieData.cast || [])
    .slice(0, 8)
    .map((actor) => {
      const actorName = actor.name || "Unknown Actor";
      const wikidataId = resolveActorWikidataId(actorName) || externalIds.wikidata_id || null;
      const sameAsLinks = wikidataId ? [toWikidataUrl(wikidataId)].filter(Boolean) as string[] : [];

      const person: Record<string, unknown> = {
        "@type": "Person",
        name: actorName
      };

      if (actor.character) {
        person.character = actor.character;
      }

      if (actor.profile_path) {
        person.image = `https://image.tmdb.org/t/p/w500${actor.profile_path}`;
      }

      if (sameAsLinks.length > 0) {
        person.sameAs = sameAsLinks;
      }

      return person;
    });

  const directorList = (movieData.crew || [])
    .filter((person) => (person.department || "").toLowerCase() === "directing")
    .slice(0, 3)
    .map((director) => {
      const person: Record<string, unknown> = {
        "@type": "Person",
        name: director.name || "Uncredited Director"
      };

      if (director.job) {
        person.jobTitle = director.job;
      }

      return person;
    });

  const aggregateRating = typeof movieData.vote_average === "number"
    ? {
        "@type": "AggregateRating",
        ratingValue: Number(movieData.vote_average).toFixed(1),
        ratingCount: Number(movieData.vote_count || 1),
        bestRating: "10",
        worstRating: "0"
      }
    : undefined;

  const videoObject: Record<string, unknown> = {
    "@type": "VideoObject",
    name: movieTitle,
    description: movieData.overview || "A cinematic streaming title.",
    thumbnailUrl: posterUrl || backdropUrl,
    uploadDate: releaseDate,
    duration: runtimeMinutes ? `PT${runtimeMinutes}M` : undefined,
    contentUrl: watchPath,
    embedUrl: watchPath,
    potentialAction: {
      "@type": "WatchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: watchPath,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/IOSPlatform",
          "https://schema.org/AndroidPlatform"
        ]
      }
    }
  };

  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movieTitle,
    description: movieData.overview || "A cinematic streaming experience.",
    url: watchPath,
    image: posterUrl || backdropUrl || undefined,
    poster: posterUrl || undefined,
    thumbnailUrl: posterUrl || backdropUrl || undefined,
    datePublished: releaseDate,
    genre: genreList,
    inLanguage: movieData.original_language || "en",
    actor: actorList.length ? actorList : undefined,
    director: directorList.length ? directorList : undefined,
    aggregateRating,
    sameAs: sameAs.length ? sameAs : undefined,
    potentialAction: {
      "@type": "WatchAction",
      name: `Watch ${movieTitle}`,
      target: {
        "@type": "EntryPoint",
        urlTemplate: watchPath,
        actionPlatform: [
          "https://schema.org/DesktopWebPlatform",
          "https://schema.org/IOSPlatform",
          "https://schema.org/AndroidPlatform"
        ]
      }
    },
    video: videoObject
  };
}

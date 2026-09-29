import React from "react";
import type { Metadata } from "next";
import { getMovieJsonLd, type MovieData, type ExternalIds } from "../../../../utils/jsonLd";

type RouteParams = {
  locale: string;
  slug: string;
};

const LOCALE_ROUTE_MAP: Record<string, { basePath: string; canonical: string; moviePath: string }> = {
  en: { basePath: "/en/movie", canonical: "/en/movie", moviePath: "/en/movie" },
  es: { basePath: "/es/pelicula", canonical: "/es/pelicula", moviePath: "/es/pelicula" },
  pt: { basePath: "/pt/filme", canonical: "/pt/filme", moviePath: "/pt/filme" },
  fr: { basePath: "/fr/film", canonical: "/fr/film", moviePath: "/fr/film" }
};

const DEFAULT_POSTER = "https://image.tmdb.org/t/p/original/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg";

async function resolveRouteParams(params: RouteParams | Promise<RouteParams>): Promise<RouteParams> {
  return params instanceof Promise ? await params : params;
}

async function fetchMovieBySlug(locale: string, slug: string): Promise<{ movie: MovieData; externalIds: ExternalIds } | null> {
  const normalizedLocale = LOCALE_ROUTE_MAP[locale]?.basePath ? locale : "en";
  const tmdbApiKey = process.env.TMDB_API_KEY || "abdde991ce2a56652d4c0ca156db7836";
  const query = slug
    .split("-")
    .filter(Boolean)
    .join(" ");

  const languageMap: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    pt: "pt-BR",
    fr: "fr-FR"
  };

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(query)}&language=${languageMap[normalizedLocale] ?? "en-US"}`;
    const searchResponse = await fetch(searchUrl, { next: { revalidate: 3600 } });

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();
    const movieResult = searchData.results?.[0];

    if (!movieResult) {
      return null;
    }

    const externalIdsUrl = `https://api.themoviedb.org/3/movie/${movieResult.id}/external_ids?api_key=${tmdbApiKey}`;
    const creditsUrl = `https://api.themoviedb.org/3/movie/${movieResult.id}/credits?api_key=${tmdbApiKey}&language=${languageMap[normalizedLocale] ?? "en-US"}`;

    const [externalIdsResponse, creditsResponse] = await Promise.all([
      fetch(externalIdsUrl, { next: { revalidate: 3600 } }),
      fetch(creditsUrl, { next: { revalidate: 3600 } })
    ]);

    const externalIds = externalIdsResponse.ok ? await externalIdsResponse.json() : {};
    const credits = creditsResponse.ok ? await creditsResponse.json() : { cast: [], crew: [] };

    const movie: MovieData = {
      ...movieResult,
      id: movieResult.id,
      slug,
      title: movieResult.title || movieResult.name || "Untitled Movie",
      overview: movieResult.overview || "Watch this cinematic title in full HD.",
      release_date: movieResult.release_date || null,
      runtime: movieResult.runtime ?? 110,
      vote_average: movieResult.vote_average ?? 0,
      vote_count: movieResult.vote_count ?? 0,
      poster_path: movieResult.poster_path || null,
      backdrop_path: movieResult.backdrop_path || movieResult.poster_path || null,
      webUrl: `https://500get.com/watch.html?type=movie&id=${movieResult.id}&slug=${slug}&lang=${normalizedLocale}`,
      mobileUrl: `https://500get.com/watch.html?type=movie&id=${movieResult.id}&slug=${slug}&lang=${normalizedLocale}`,
      cast: Array.isArray(credits.cast) ? credits.cast.slice(0, 8) : [],
      crew: Array.isArray(credits.crew) ? credits.crew : []
    };

    return {
      movie,
      externalIds: {
        imdb_id: externalIds.imdb_id || movieResult.imdb_id || null,
        wikidata_id: externalIds.wikidata_id || null,
        facebook_id: externalIds.facebook_id || null,
        instagram_id: externalIds.instagram_id || null,
        twitter_id: externalIds.twitter_id || null,
        youtube_id: externalIds.youtube_id || null
      }
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params
}: {
  params: RouteParams | Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await resolveRouteParams(params);
  const normalizedLocale = LOCALE_ROUTE_MAP[locale]?.basePath ? locale : "en";
  const routeInfo = LOCALE_ROUTE_MAP[normalizedLocale];
  const routeData = await fetchMovieBySlug(normalizedLocale, slug);
  const movie = routeData?.movie;

  const title = movie?.title || "Featured Movie";
  const description = movie?.overview || "Stream your next favorite movie in full HD with multi-language support and instant playback.";
  const posterUrl = movie?.poster_path
    ? `https://image.tmdb.org/t/p/original${movie.poster_path}`
    : DEFAULT_POSTER;
  const backdropUrl = movie?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : posterUrl;
  const canonicalUrl = `https://500get.com${routeInfo.basePath}/${slug}`;

  const languagePaths: Record<string, string> = {
    en: `/en/movie/${slug}`,
    es: `/es/pelicula/${slug}`,
    pt: `/pt/filme/${slug}`,
    fr: `/fr/film/${slug}`
  };

  return {
    metadataBase: new URL("https://500get.com"),
    title: `${title} | FlixStream`,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ...languagePaths,
        "x-default": languagePaths.en
      }
    },
    openGraph: {
      type: "video.movie",
      locale: normalizedLocale,
      siteName: "FlixStream",
      title: `${title} | FlixStream`,
      description,
      url: canonicalUrl,
      images: [
        {
          url: backdropUrl,
          width: 1280,
          height: 720,
          alt: `${title} poster`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | FlixStream`,
      description,
      images: [backdropUrl]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    other: {
      "max-image-preview": "large",
      "theme-color": "#0b0b0b"
    }
  };
}

export default async function MoviePage({
  params
}: {
  params: RouteParams | Promise<RouteParams>;
}) {
  const { locale, slug } = await resolveRouteParams(params);
  const data = await fetchMovieBySlug(locale, slug);
  const jsonLd = data ? getMovieJsonLd(data.movie, data.externalIds) : {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: "Movie",
    url: `https://500get.com/${locale}/movie/${slug}`
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section style={{ padding: "2rem", color: "#fff", background: "#0b0b0b" }}>
        <h1>{data?.movie?.title || "Loading movie..."}</h1>
        <p>{data?.movie?.overview || "Filling metadata and schema for this movie page."}</p>
      </section>
    </main>
  );
}

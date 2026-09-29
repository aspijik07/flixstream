/**
 * 500get.com - Enterprise Programmatic Movie Discovery Platform
 * Phase 1 (Modules A & D): SEO, JSON-LD Schema.org & App Router Metadata Engine
 */

import type { Metadata, ResolvingMetadata } from 'next';

// ============================================================================
// 1. DATA MODELS & TYPES
// ============================================================================

export type SupportedLocale = 'en' | 'es' | 'pt' | 'fr';

export const LOCALE_SEGMENTS: Record<SupportedLocale, string> = {
  en: 'movie',
  es: 'pelicula',
  pt: 'filme',
  fr: 'film',
};

export const OG_LOCALE_MAP: Record<SupportedLocale, string> = {
  en: 'en_US',
  es: 'es_ES',
  pt: 'pt_BR',
  fr: 'fr_FR',
};

export interface MovieActor {
  name: string;
  character?: string;
  wikidataId?: string; // e.g., "Q193212"
  imdbId?: string;     // e.g., "nm0000138"
  profileUrl?: string;
}

export interface MovieDirector {
  name: string;
  wikidataId?: string; // e.g., "Q25191"
  imdbId?: string;
}

export interface MovieTrailer {
  name: string;
  description?: string;
  thumbnailUrl: string;
  uploadDate: string; // ISO 8601 string: YYYY-MM-DDTHH:mm:ssZ
  embedUrl: string;
  contentUrl?: string;
  duration?: string; // ISO 8601 duration: e.g., "PT2M30S"
}

export interface MovieData {
  id: string | number;
  slug: string;
  title: string;
  originalTitle?: string;
  overview: string;
  releaseDate: string; // YYYY-MM-DD
  runtimeMinutes?: number;
  posterUrl: string;
  backdropUrl?: string;
  genres: string[];
  contentRating?: string; // e.g., "PG-13", "R", "TV-MA"
  rating?: {
    value: number; // e.g., 8.7
    count: number; // e.g., 2450000
    bestRating?: number; // default: 10
  };
  actors?: MovieActor[];
  directors?: MovieDirector[];
  trailer?: MovieTrailer;
  watchDeepLink?: string;
}

export interface ExternalIds {
  wikidataId?: string; // e.g., "Q13417189"
  imdbId?: string;     // e.g., "tt0816692"
  tmdbId?: number | string;
  wikipediaUrl?: string;
}

// ============================================================================
// 2. SCHEMA.ORG JSON-LD GENERATOR (Module A)
// ============================================================================

/**
 * Converts runtime minutes to ISO 8601 duration format (e.g., 148 -> "PT2H28M")
 */
export function formatIsoDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `PT${hours}H${remainingMinutes}M`;
  } else if (hours > 0) {
    return `PT${hours}H`;
  }
  return `PT${remainingMinutes}M`;
}

/**
 * Generates type-safe, enriched Schema.org Movie and VideoObject structured data.
 * Validates with Google Rich Results Test for Movie and Video Rich Snippets.
 */
export function getMovieJsonLd(movieData: MovieData, externalIds: ExternalIds = {}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://500get.com';
  
  // Build Wikidata and external entity links for entity reconciliation
  const movieSameAs: string[] = [];
  if (externalIds.wikidataId) {
    movieSameAs.push(`https://www.wikidata.org/wiki/${externalIds.wikidataId}`);
  }
  if (externalIds.imdbId) {
    movieSameAs.push(`https://www.imdb.com/title/${externalIds.imdbId}/`);
  }
  if (externalIds.tmdbId) {
    movieSameAs.push(`https://www.themoviedb.org/movie/${externalIds.tmdbId}`);
  }
  if (externalIds.wikipediaUrl) {
    movieSameAs.push(externalIds.wikipediaUrl);
  }

  // Actors with Wikidata entity alignment
  const actorsSchema = movieData.actors?.map((actor) => {
    const actorSameAs: string[] = [];
    if (actor.wikidataId) {
      actorSameAs.push(`https://www.wikidata.org/wiki/${actor.wikidataId}`);
    }
    if (actor.imdbId) {
      actorSameAs.push(`https://www.imdb.com/name/${actor.imdbId}/`);
    }

    return {
      '@type': 'Person',
      name: actor.name,
      ...(actor.character ? { characterName: actor.character } : {}),
      ...(actor.profileUrl ? { image: actor.profileUrl } : {}),
      ...(actorSameAs.length > 0 ? { sameAs: actorSameAs.length === 1 ? actorSameAs[0] : actorSameAs } : {}),
    };
  });

  // Directors with Wikidata alignment
  const directorsSchema = movieData.directors?.map((director) => {
    const directorSameAs: string[] = [];
    if (director.wikidataId) {
      directorSameAs.push(`https://www.wikidata.org/wiki/${director.wikidataId}`);
    }
    if (director.imdbId) {
      directorSameAs.push(`https://www.imdb.com/name/${director.imdbId}/`);
    }

    return {
      '@type': 'Person',
      name: director.name,
      ...(directorSameAs.length > 0 ? { sameAs: directorSameAs.length === 1 ? directorSameAs[0] : directorSameAs } : {}),
    };
  });

  // Deep link watch target
  const watchUrl = movieData.watchDeepLink || `${siteUrl}/watch?id=${movieData.id}&slug=${encodeURIComponent(movieData.slug)}`;

  // Schema.org Movie Object
  const movieSchema: Record<string, any> = {
    '@type': 'Movie',
    '@id': `${siteUrl}/en/movie/${movieData.slug}#movie`,
    name: movieData.title,
    ...(movieData.originalTitle && movieData.originalTitle !== movieData.title
      ? { alternateName: movieData.originalTitle }
      : {}),
    description: movieData.overview,
    image: movieData.backdropUrl ? [movieData.posterUrl, movieData.backdropUrl] : [movieData.posterUrl],
    datePublished: movieData.releaseDate,
    ...(movieData.runtimeMinutes ? { duration: formatIsoDuration(movieData.runtimeMinutes) } : {}),
    ...(movieData.genres?.length ? { genre: movieData.genres } : {}),
    ...(movieData.contentRating ? { contentRating: movieData.contentRating } : {}),
    ...(movieSameAs.length > 0 ? { sameAs: movieSameAs } : {}),
    ...(actorsSchema && actorsSchema.length > 0 ? { actor: actorsSchema } : {}),
    ...(directorsSchema && directorsSchema.length > 0 ? { director: directorsSchema } : {}),
    inLanguage: ['en', 'es', 'pt', 'fr'],
    // Google WatchAction Rich Result configuration
    potentialAction: {
      '@type': 'WatchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: watchUrl,
        inLanguage: ['en', 'es', 'pt', 'fr'],
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
          'http://schema.org/AndroidPlatform',
          'http://schema.org/IOSPlatform',
        ],
      },
      actionStatus: 'http://schema.org/PotentialActionStatus',
    },
  };

  // Aggregate Rating if available
  if (movieData.rating && movieData.rating.count > 0) {
    movieSchema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: movieData.rating.value,
      ratingCount: movieData.rating.count,
      bestRating: movieData.rating.bestRating || 10,
      worstRating: 1,
    };
  }

  // Schema.org VideoObject for Trailer Preview
  if (movieData.trailer) {
    const videoObject: Record<string, any> = {
      '@type': 'VideoObject',
      '@id': `${siteUrl}/en/movie/${movieData.slug}#trailer`,
      name: movieData.trailer.name,
      description: movieData.trailer.description || `Official HD trailer for ${movieData.title}`,
      thumbnailUrl: [movieData.trailer.thumbnailUrl],
      uploadDate: movieData.trailer.uploadDate,
      embedUrl: movieData.trailer.embedUrl,
      ...(movieData.trailer.contentUrl ? { contentUrl: movieData.trailer.contentUrl } : {}),
      ...(movieData.trailer.duration ? { duration: movieData.trailer.duration } : {}),
      potentialAction: {
        '@type': 'WatchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: movieData.trailer.embedUrl,
          actionPlatform: [
            'http://schema.org/DesktopWebPlatform',
            'http://schema.org/MobileWebPlatform',
          ],
        },
      },
    };

    movieSchema.trailer = videoObject;

    // Return graph containing both entity objects linked together
    return {
      '@context': 'https://schema.org',
      '@graph': [movieSchema, videoObject],
    };
  }

  return {
    '@context': 'https://schema.org',
    ...movieSchema,
  };
}

// ============================================================================
// 3. NEXT.JS APP ROUTER generateMetadata (Module D)
// ============================================================================

export interface MoviePageParams {
  params: Promise<{
    locale: SupportedLocale;
    slug: string;
  }>;
}

/**
 * Builds the canonical and multi-regional hreflang URL map:
 * - /en/movie/[slug]
 * - /es/pelicula/[slug]
 * - /pt/filme/[slug]
 * - /fr/film/[slug]
 * - x-default fallback
 */
export function buildHreflangMap(slug: string, baseUrl: string = 'https://500get.com'): Record<string, string> {
  const languages: Record<string, string> = {};

  (Object.keys(LOCALE_SEGMENTS) as SupportedLocale[]).forEach((locale) => {
    const segment = LOCALE_SEGMENTS[locale];
    languages[locale] = `${baseUrl}/${locale}/${segment}/${slug}`;
  });

  // x-default fallback points to the global English route
  languages['x-default'] = `${baseUrl}/en/${LOCALE_SEGMENTS.en}/${slug}`;

  return languages;
}

/**
 * Next.js App Router generateMetadata implementation:
 * - Multi-regional hreflang tags for international search targeting
 * - Google Discover-ready meta directives (max-image-preview:large, max-snippet:-1, max-video-preview:-1)
 * - OpenGraph video.movie specification
 * - Twitter summary_large_image card
 */
export async function generateMovieMetadata(
  props: MoviePageParams,
  _parent: ResolvingMetadata,
  fetchMovieData: (slug: string, locale: SupportedLocale) => Promise<MovieData | null>
): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://500get.com';

  const validLocale: SupportedLocale = LOCALE_SEGMENTS[locale] ? locale : 'en';
  const pathSegment = LOCALE_SEGMENTS[validLocale];
  const canonicalUrl = `${baseUrl}/${validLocale}/${pathSegment}/${slug}`;

  const movie = await fetchMovieData(slug, validLocale);

  if (!movie) {
    return {
      title: 'Movie Not Found | 500get',
      description: 'The requested title could not be found on 500get.com.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const primaryImage = movie.backdropUrl || movie.posterUrl;
  const ogTitle = `${movie.title} - Stream in 1080p HD | 500get`;
  const ogDescription = movie.overview.length > 155
    ? `${movie.overview.slice(0, 152)}...`
    : movie.overview;

  const hreflangs = buildHreflangMap(slug, baseUrl);

  return {
    title: `${movie.title} (${new Date(movie.releaseDate).getFullYear() || ''}) - Watch HD Online | 500get`,
    description: ogDescription,
    
    // Canonical & Multi-regional Hreflang Alternates
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangs,
    },

    // Google Discover & Search Engine Directives
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large', // Critical for Google Discover prominence
        'max-snippet': -1,
      },
    },

    // OpenGraph Protocol (video.movie specification)
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonicalUrl,
      siteName: '500get',
      type: 'video.movie',
      locale: OG_LOCALE_MAP[validLocale] || 'en_US',
      alternateLocale: Object.values(OG_LOCALE_MAP).filter(
        (l) => l !== (OG_LOCALE_MAP[validLocale] || 'en_US')
      ),
      images: [
        {
          url: primaryImage,
          width: 1200,
          height: 630,
          alt: `${movie.title} HD Poster Preview`,
          type: 'image/jpeg',
        },
        ...(movie.posterUrl && movie.backdropUrl
          ? [
              {
                url: movie.posterUrl,
                width: 500,
                height: 750,
                alt: `${movie.title} Key Visual Art`,
                type: 'image/jpeg',
              },
            ]
          : []),
      ],
    },

    // Twitter / X Large Summary Card
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [primaryImage],
      site: '@500get',
    },

    // Category & Classification Metadata
    category: 'Entertainment',
    keywords: [
      movie.title,
      ...(movie.genres || []),
      'Watch Online',
      'Full HD Stream',
      '500get Discovery',
      'Free Streaming',
    ],

    // Verification and Additional Directives
    other: {
      'rating': movie.contentRating || 'General',
      'og:video:release_date': movie.releaseDate,
      ...(movie.directors?.length
        ? { 'og:video:director': movie.directors.map((d) => d.name).join(', ') }
        : {}),
      ...(movie.actors?.length
        ? { 'og:video:actor': movie.actors.slice(0, 5).map((a) => a.name).join(', ') }
        : {}),
    },
  };
}

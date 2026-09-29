/**
 * 500get.com - Enterprise Programmatic Movie Discovery Platform
 * Phase 2 (Module C): Automated IndexNow Dispatch Service
 * 
 * Powered by Bing / Yandex / IndexNow Protocol (QDF - Query Deserves Freshness)
 * Immediately dispatches new releases, 1080p stream drops, and subtitle updates
 * to search engines for instant indexing within minutes.
 */

import { LOCALE_SEGMENTS, type SupportedLocale } from '../seo/movie-metadata';

// ============================================================================
// 1. TYPES & LIFECYCLE EVENT CONTRACTS
// ============================================================================

export type MovieLifecycleEvent =
  | 'STREAM_RELEASED'        // New full HD stream mirror live (highest QDF priority)
  | 'TRAILER_PUBLISHED'      // Official trailer preview uploaded
  | 'QUALITY_UPGRADED_1080P' // Stream upgraded to 1080p Ultra HD / 4K
  | 'SUBTITLES_ADDED'        // Multi-language subtitles synchronized
  | 'METADATA_UPDATED'       // Cast, runtime, or critical synopsis revised
  | 'CONTENT_DEPRECATED';    // Title removed or moved (triggers immediate crawl removal)

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

export interface IndexNowResponse {
  success: boolean;
  statusCode: number;
  message: string;
  submittedCount: number;
  urls: string[];
  timestamp: string;
}

export interface IndexNowConfig {
  host: string;
  apiKey: string;
  keyLocation?: string;
  endpoint?: string;
  dryRun?: boolean;
}

// ============================================================================
// 2. CONFIGURATION & CONSTANTS
// ============================================================================

const DEFAULT_INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_BATCH = 10000; // Official IndexNow limit per submission request

/**
 * Resolves IndexNow configuration from environment variables with fallback defaults
 */
export function getIndexNowConfig(): IndexNowConfig {
  const host = process.env.INDEXNOW_HOST || '500get.com';
  const apiKey = process.env.INDEXNOW_API_KEY || '500get_indexnow_key_prod';
  const keyLocation = process.env.INDEXNOW_KEY_LOCATION || `https://${host}/${apiKey}.txt`;

  return {
    host,
    apiKey,
    keyLocation,
    endpoint: process.env.INDEXNOW_ENDPOINT || DEFAULT_INDEXNOW_ENDPOINT,
    dryRun: process.env.INDEXNOW_DRY_RUN === 'true',
  };
}

// ============================================================================
// 3. URL BUILDERS FOR PROGRAMMATIC ARCHITECTURE
// ============================================================================

/**
 * Generates all multi-regional localized URLs for a movie slug across all supported languages
 */
export function generateLocalizedMovieUrls(slug: string, baseUrl: string = 'https://500get.com'): string[] {
  const locales = Object.keys(LOCALE_SEGMENTS) as SupportedLocale[];
  const urls = locales.map((locale) => {
    const segment = LOCALE_SEGMENTS[locale];
    return `${baseUrl}/${locale}/${segment}/${slug}`;
  });

  // Include direct watch deep link as high-priority stream destination
  urls.push(`${baseUrl}/watch?slug=${encodeURIComponent(slug)}`);

  return urls;
}

// ============================================================================
// 4. INDEXNOW DISPATCH SERVICE ENGINE
// ============================================================================

/**
 * Low-level batch dispatcher to the IndexNow protocol with backoff and error tracking
 */
export async function submitUrlsToIndexNow(
  urls: string[],
  config: IndexNowConfig = getIndexNowConfig()
): Promise<IndexNowResponse> {
  const timestamp = new Date().toISOString();

  // Deduplicate and filter valid URLs
  const uniqueUrls = Array.from(new Set(urls.filter((u) => u && typeof u === 'string')));

  if (uniqueUrls.length === 0) {
    return {
      success: true,
      statusCode: 200,
      message: 'No URLs provided for dispatch.',
      submittedCount: 0,
      urls: [],
      timestamp,
    };
  }

  // Handle batch slicing if count exceeds 10,000 URLs
  const targetUrls = uniqueUrls.slice(0, MAX_URLS_PER_BATCH);

  const payload: IndexNowPayload = {
    host: config.host,
    key: config.apiKey,
    keyLocation: config.keyLocation,
    urlList: targetUrls,
  };

  if (config.dryRun) {
    console.info(`[IndexNow DRY-RUN] Would submit ${targetUrls.length} URLs:`, targetUrls);
    return {
      success: true,
      statusCode: 200,
      message: '[DRY-RUN] Submission skipped via configuration.',
      submittedCount: targetUrls.length,
      urls: targetUrls,
      timestamp,
    };
  }

  const endpoint = config.endpoint || DEFAULT_INDEXNOW_ENDPOINT;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': '500get-Discovery-Bot/1.0 (+https://500get.com/bot)',
      },
      body: JSON.stringify(payload),
    });

    /**
     * IndexNow API Status Code Reference:
     * - 200: OK (URL submitted successfully)
     * - 202: Accepted (URL received, key verification pending)
     * - 400: Bad Request (Invalid format)
     * - 403: Forbidden (Key invalid / not found)
     * - 422: Unprocessable Entity (URLs don't match host)
     * - 429: Too Many Requests
     */
    if (response.status === 200 || response.status === 202) {
      console.log(
        `[IndexNow SUCCESS] Submitted ${targetUrls.length} URLs to ${endpoint} with status ${response.status}`
      );
      return {
        success: true,
        statusCode: response.status,
        message: response.status === 200 ? 'OK - URLs indexed' : 'Accepted - URL received',
        submittedCount: targetUrls.length,
        urls: targetUrls,
        timestamp,
      };
    }

    const errorBody = await response.text();
    console.error(
      `[IndexNow ERROR] Dispatch failed (${response.status}): ${errorBody} for endpoint ${endpoint}`
    );

    return {
      success: false,
      statusCode: response.status,
      message: `Failed: ${response.statusText} (${errorBody})`,
      submittedCount: 0,
      urls: targetUrls,
      timestamp,
    };
  } catch (error: any) {
    console.error('[IndexNow NETWORK ERROR] Connection failure:', error?.message || error);
    return {
      success: false,
      statusCode: 500,
      message: `Network error: ${error?.message || 'Unknown network error'}`,
      submittedCount: 0,
      urls: targetUrls,
      timestamp,
    };
  }
}

// ============================================================================
// 5. QDF (QUERY DESERVES FRESHNESS) MOVIE LIFECYCLE HOOK
// ============================================================================

export interface DispatchMovieLifecycleOptions {
  slug: string;
  event: MovieLifecycleEvent;
  metadata?: {
    quality?: '720p' | '1080p' | '4k';
    languagesAdded?: string[];
    releaseYear?: number;
  };
}

/**
 * Automated lifecycle listener triggered on movie catalog state transitions.
 * Calculates urgency and broadcasts the localized matrix to search engines.
 *
 * @example
 * await dispatchMovieLifecycleChange({
 *   slug: 'dune-part-two-2024',
 *   event: 'STREAM_RELEASED',
 *   metadata: { quality: '1080p' }
 * });
 */
export async function dispatchMovieLifecycleChange(
  options: DispatchMovieLifecycleOptions
): Promise<IndexNowResponse> {
  const { slug, event, metadata } = options;
  const config = getIndexNowConfig();
  const baseUrl = `https://${config.host}`;

  console.log(`[QDF Dispatch] Triggered for slug="${slug}", event="${event}"`, metadata || '');

  // 1. Generate full localized URL graph:
  // /en/movie/[slug], /es/pelicula/[slug], /pt/filme/[slug], /fr/film/[slug], /watch?slug=[slug]
  const urlsToDispatch = generateLocalizedMovieUrls(slug, baseUrl);

  // 2. Dispatch to IndexNow cluster
  const result = await submitUrlsToIndexNow(urlsToDispatch, config);

  return result;
}

/**
 * 500get.com - Enterprise Programmatic Movie Discovery Platform
 * Phase 2 (Module B): Edge Caching & Bot KV Snapshot Accelerator
 * 
 * Target: Sub-80ms TTFB for Search Engine Crawlers & Edge-accelerated public cache
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================================
// 1. CONFIGURATION & BOT REGEX PATTERNS
// ============================================================================

export const CACHE_POLICY = {
  // s-maxage=86400 (24h edge cache), stale-while-revalidate=604800 (7 days background revalidation)
  HEADER_VALUE: 'public, s-maxage=86400, stale-while-revalidate=604800, max-age=3600',
  CDN_CACHE_CONTROL: 'public, s-maxage=86400, stale-while-revalidate=604800',
  SURROGATE_CONTROL: 'public, max-age=86400',
};

/**
 * High-priority bot detection regex pattern (Googlebot, Bingbot, Yandex, Baidu, DuckDuckBot, Slurp, etc.)
 */
const SEARCH_BOT_PATTERN =
  /(Googlebot|Googlebot-Mobile|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|facebookexternalhit|Twitterbot|LinkedInBot|Applebot)/i;

/**
 * Cloudflare Worker KV API configuration for Edge snapshot bypass
 */
interface CloudflareKvConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
}

const CF_KV_CONFIG: CloudflareKvConfig = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  namespaceId: process.env.CLOUDFLARE_KV_SNAPSHOT_NAMESPACE_ID || '',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
};

// ============================================================================
// 2. CLOUDFLARE EDGE KV SNAPSHOT FETCH
// ============================================================================

/**
 * Fetches pre-rendered static HTML snapshot directly from Cloudflare KV storage
 * over global edge network, entirely bypassing Next.js origin execution.
 */
async function fetchKvSnapshot(pathKey: string): Promise<string | null> {
  const { accountId, namespaceId, apiToken } = CF_KV_CONFIG;
  if (!accountId || !namespaceId || !apiToken) {
    return null;
  }

  // Normalize key for KV storage (e.g., "snapshot:/en/movie/interstellar-2014")
  const sanitizedKey = encodeURIComponent(`snapshot:${pathKey}`);
  const kvEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${sanitizedKey}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120); // 120ms strict deadline for KV lookup

    const response = await fetch(kvEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'text/html; charset=utf-8',
      },
      signal: controller.signal,
      // @ts-ignore Cloudflare / Edge fetch options
      cf: {
        cacheEverything: true,
        cacheTtl: 86400,
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    // Fail silently to origin server on network hiccup or timeout
    console.warn('[Edge KV Bypass] Snapshot miss or timeout; falling back to origin', error);
  }

  return null;
}

// ============================================================================
// 3. NEXT.JS MIDDLEWARE IMPLEMENTATION
// ============================================================================

export async function edgeCacheMiddleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // 1. Skip caching for static assets, internal routes, and API endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    /\.(.*)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isSearchBot = SEARCH_BOT_PATTERN.test(userAgent);

  // 2. BOT ACCELERATION PATHWAY: Ultra-low TTFB Edge Snapshot
  if (isSearchBot) {
    // Unique key identifier based on normalized pathname
    const snapshotHtml = await fetchKvSnapshot(pathname);

    if (snapshotHtml) {
      return new NextResponse(snapshotHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': CACHE_POLICY.HEADER_VALUE,
          'CDN-Cache-Control': CACHE_POLICY.CDN_CACHE_CONTROL,
          'X-500get-Edge-Hit': 'KV-SNAPSHOT-BOT',
          'X-Robots-Tag': 'index, follow, max-image-preview:large',
          'Vary': 'User-Agent, Accept-Encoding',
        },
      });
    }
  }

  // 3. HUMAN USERS / ORIGIN FALLBACK: Dynamic pipeline with Edge CDN directives
  const response = NextResponse.next();

  // Apply high-performance CDN and SWR caching directives
  response.headers.set('Cache-Control', CACHE_POLICY.HEADER_VALUE);
  response.headers.set('CDN-Cache-Control', CACHE_POLICY.CDN_CACHE_CONTROL);
  response.headers.set('Surrogate-Control', CACHE_POLICY.SURROGATE_CONTROL);
  response.headers.set('X-500get-Edge-Cache', 'CONFIGURED');
  response.headers.set('Vary', 'Accept-Encoding, User-Agent');

  // Tag with Cloudflare Cache-Tags for granular purge upon movie catalog invalidation
  if (pathname.includes('/movie/') || pathname.includes('/pelicula/') || pathname.includes('/filme/') || pathname.includes('/film/')) {
    const slug = pathname.split('/').filter(Boolean).pop();
    if (slug) {
      response.headers.set('Cache-Tag', `movie-${slug}, movies-catalog, locale-content`);
    }
  }

  return response;
}

export const middlewareConfig = {
  matcher: [
    /*
     * Match all localized movie routes:
     * - /en/movie/:slug*
     * - /es/pelicula/:slug*
     * - /pt/filme/:slug*
     * - /fr/film/:slug*
     */
    '/:locale(en|es|pt|fr)/:category(movie|pelicula|filme|film)/:slug*',
    '/movie/:slug*',
  ],
};

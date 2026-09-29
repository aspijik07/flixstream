/**
 * 500get.com - Enterprise Programmatic Movie Discovery Platform
 * Phase 3 (Module F): High-Intent Programmatic Internal Linking Clusters
 * 
 * 1. "Chronological Watch Order" Cluster (Franchises & Sagas)
 * 2. "Movies Directed by [Director] Ranked" Cluster (Entity Authority)
 * 3. "Similar Titles" Semantic Discovery Cluster (Topical Relevancy)
 * 
 * Includes Schema.org ItemList JSON-LD generation for Google List/Carousel rich results.
 */

import React from 'react';
import { LOCALE_SEGMENTS, type SupportedLocale } from '../seo/movie-metadata';

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================

export interface ClusterMovieItem {
  id: string | number;
  slug: string;
  title: string;
  posterUrl: string;
  releaseYear: number;
  rating?: number;
  orderIndex?: number; // Chronological order: 1, 2, 3...
  runtimeMinutes?: number;
  genres?: string[];
}

export interface CollectionCluster {
  collectionName: string;
  totalCount: number;
  items: ClusterMovieItem[]; // Sorted chronologically
}

export interface DirectorCluster {
  directorName: string;
  wikidataId?: string;
  items: ClusterMovieItem[]; // Sorted by rating descending
}

export interface SimilarCluster {
  themeTag?: string;
  items: ClusterMovieItem[];
}

export interface MovieInternalLinksProps {
  currentMovieId: string | number;
  currentSlug: string;
  locale?: SupportedLocale;
  baseUrl?: string;
  collection?: CollectionCluster;
  directorCluster?: DirectorCluster;
  similar?: SimilarCluster;
}

// ============================================================================
// 2. SCHEMA.ORG ITEMLIST GENERATOR FOR CAROUSEL RICH RESULTS
// ============================================================================

/**
 * Builds Schema.org ItemList for Google Carousel / Ranked List SERP features
 */
export function buildItemListJsonLd(
  clusterName: string,
  items: ClusterMovieItem[],
  locale: SupportedLocale = 'en',
  baseUrl: string = 'https://500get.com'
) {
  const segment = LOCALE_SEGMENTS[locale] || 'movie';

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: clusterName,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.title,
      url: `${baseUrl}/${locale}/${segment}/${item.slug}`,
      image: item.posterUrl,
    })),
  };
}

// ============================================================================
// 3. INTERNAL LINKING REACT COMPONENT
// ============================================================================

export function MovieInternalLinks({
  currentMovieId,
  currentSlug,
  locale = 'en',
  baseUrl = 'https://500get.com',
  collection,
  directorCluster,
  similar,
}: MovieInternalLinksProps) {
  const segment = LOCALE_SEGMENTS[locale] || 'movie';

  const getMovieUrl = (slug: string) => `${baseUrl}/${locale}/${segment}/${slug}`;

  // Multi-lingual labels dictionary
  const labels = {
    en: {
      watchOrder: 'Chronological Watch Order',
      watchOrderSub: 'Stream the complete series in official narrative sequence',
      directedBy: 'Movies Directed by',
      ranked: 'Ranked from Highest Rated to Lowest',
      similarTitle: 'Similar Movies You Might Like',
      similarSub: 'Handpicked titles matching tone, theme, and cinematic style',
      currentBadge: 'CURRENT TITLE',
      rankBadge: 'RANK',
      streamNow: 'Stream',
    },
    es: {
      watchOrder: 'Orden Cronológico de Visualización',
      watchOrderSub: 'Mira la saga completa en su orden narrativo oficial',
      directedBy: 'Películas Dirigidas por',
      ranked: 'Clasificadas de Mejor a Peor Calificada',
      similarTitle: 'Películas Similares Recomendadas',
      similarSub: 'Títulos seleccionados con temática y estilo afines',
      currentBadge: 'TÍTULO ACTUAL',
      rankBadge: 'PUESTO',
      streamNow: 'Ver',
    },
    pt: {
      watchOrder: 'Ordem Cronológica Recomendada',
      watchOrderSub: 'Assista à franquia completa na ordem cronológica oficial',
      directedBy: 'Filmes Dirigidos por',
      ranked: 'Classificados da Maior para a Menor Nota',
      similarTitle: 'Filmes Semelhantes Recomendados',
      similarSub: 'Títulos selecionados com mesmo tom e narrativa',
      currentBadge: 'FILME ATUAL',
      rankBadge: 'POSIÇÃO',
      streamNow: 'Assistir',
    },
    fr: {
      watchOrder: 'Ordre Chronologique de Visionnage',
      watchOrderSub: 'Regardez la saga complète dans l’ordre officiel',
      directedBy: 'Films Réalisés par',
      ranked: 'Classés de la Meilleure à la Moins Bonne Note',
      similarTitle: 'Films Similaires Conseillés',
      similarSub: 'Sélection de titres au style et ton comparables',
      currentBadge: 'TITRE ACTUEL',
      rankBadge: 'RANG',
      streamNow: 'Regarder',
    },
  }[locale] || {
    watchOrder: 'Chronological Watch Order',
    watchOrderSub: 'Stream the complete series in official narrative sequence',
    directedBy: 'Movies Directed by',
    ranked: 'Ranked from Highest Rated to Lowest',
    similarTitle: 'Similar Movies You Might Like',
    similarSub: 'Handpicked titles matching tone, theme, and cinematic style',
    currentBadge: 'CURRENT TITLE',
    rankBadge: 'RANK',
    streamNow: 'Stream',
  };

  // Build JSON-LD graphs for active clusters
  const jsonLdScripts = [];
  if (collection && collection.items.length > 1) {
    jsonLdScripts.push(
      buildItemListJsonLd(
        `${collection.collectionName}: ${labels.watchOrder}`,
        collection.items,
        locale,
        baseUrl
      )
    );
  }
  if (directorCluster && directorCluster.items.length > 1) {
    jsonLdScripts.push(
      buildItemListJsonLd(
        `${labels.directedBy} ${directorCluster.directorName} ${labels.ranked}`,
        directorCluster.items,
        locale,
        baseUrl
      )
    );
  }

  return (
    <section className="w-full bg-[#0d0d0d] py-14 text-white">
      {/* 1. ItemList Structured Data Injection for Google Rich Results */}
      {jsonLdScripts.map((schema, idx) => (
        <script
          key={idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
        {/* ============================================================== */}
        {/* CLUSTER 1: CHRONOLOGICAL WATCH ORDER (FRANCHISE / SAGA)        */}
        {/* ============================================================== */}
        {collection && collection.items.length > 0 && (
          <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-6 sm:p-8">
            <div className="mb-6 flex flex-col justify-between gap-2 border-b border-neutral-800 pb-4 sm:flex-row sm:items-end">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-500">
                  {collection.collectionName}
                </span>
                <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                  {collection.collectionName}: {labels.watchOrder}
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  {labels.watchOrderSub}
                </p>
              </div>
              <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-semibold text-neutral-300">
                {collection.items.length} Titles in Saga
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {collection.items.map((item, index) => {
                const isCurrent = String(item.id) === String(currentMovieId) || item.slug === currentSlug;
                return (
                  <a
                    key={item.id}
                    href={getMovieUrl(item.slug)}
                    title={`Watch ${item.title} (${item.releaseYear}) in chronological order`}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-200 ${
                      isCurrent
                        ? 'border-red-600 bg-red-950/20 ring-2 ring-red-500 shadow-lg'
                        : 'border-neutral-800 bg-[#1a1a1a] hover:border-neutral-600 hover:-translate-y-1'
                    }`}
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-900">
                      <img
                        src={item.posterUrl}
                        alt={`${item.title} poster`}
                        width={300}
                        height={450}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Order Index Badge */}
                      <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs font-black text-white backdrop-blur">
                        #{item.orderIndex ?? index + 1}
                      </span>
                      {isCurrent && (
                        <span className="absolute bottom-2 inset-x-2 rounded bg-red-600 py-0.5 text-center text-[10px] font-black uppercase tracking-wider text-white">
                          {labels.currentBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-3">
                      <h3 className="line-clamp-2 text-xs font-bold text-white group-hover:text-red-400">
                        {item.title}
                      </h3>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
                        <span>{item.releaseYear}</span>
                        {item.rating && (
                          <span className="text-amber-400">★ {item.rating.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CLUSTER 2: MOVIES DIRECTED BY [NAME] RANKED                    */}
        {/* ============================================================== */}
        {directorCluster && directorCluster.items.length > 0 && (
          <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-6 sm:p-8">
            <div className="mb-6 border-b border-neutral-800 pb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                Filmmaker Spotlight
              </span>
              <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                {labels.directedBy} {directorCluster.directorName} {labels.ranked}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Critical rating rankings and canonical filmography
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {directorCluster.items.map((item, index) => {
                const isCurrent = String(item.id) === String(currentMovieId) || item.slug === currentSlug;
                return (
                  <a
                    key={item.id}
                    href={getMovieUrl(item.slug)}
                    title={`Stream ${item.title} directed by ${directorCluster.directorName}`}
                    className={`group flex items-center gap-4 rounded-xl border p-3 transition-all duration-200 ${
                      isCurrent
                        ? 'border-amber-500/70 bg-amber-950/20 ring-1 ring-amber-500'
                        : 'border-neutral-800 bg-[#1a1a1a] hover:border-neutral-600 hover:bg-[#202020]'
                    }`}
                  >
                    {/* Rank Badge */}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-sm font-black text-amber-400 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                      #{index + 1}
                    </span>

                    {/* Thumbnail */}
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      width={64}
                      height={96}
                      loading="lazy"
                      className="h-16 w-11 shrink-0 rounded object-cover"
                    />

                    {/* Meta */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-white group-hover:text-amber-400">
                        {item.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                        <span>{item.releaseYear}</span>
                        {item.runtimeMinutes && <span>{item.runtimeMinutes}m</span>}
                        {item.rating && (
                          <span className="font-semibold text-amber-400">
                            ★ {item.rating.toFixed(1)}/10
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CLUSTER 3: SEMANTIC SIMILAR MOVIES DISCOVERY                   */}
        {/* ============================================================== */}
        {similar && similar.items.length > 0 && (
          <div>
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                {similar.themeTag || 'Topical Proximity'}
              </span>
              <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                {labels.similarTitle}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                {labels.similarSub}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {similar.items.map((item) => (
                <a
                  key={item.id}
                  href={getMovieUrl(item.slug)}
                  title={`Watch ${item.title} in 1080p Full HD`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-[#161616] transition-all duration-200 hover:-translate-y-1 hover:border-neutral-600 hover:shadow-xl"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-900">
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      width={300}
                      height={450}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <span className="w-full text-center text-xs font-bold text-white bg-red-600 rounded py-1">
                        {labels.streamNow}
                      </span>
                    </div>
                  </div>

                  <div className="p-3">
                    <h3 className="line-clamp-1 text-xs font-bold text-white group-hover:text-red-400">
                      {item.title}
                    </h3>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>{item.releaseYear}</span>
                      {item.rating && (
                        <span className="text-amber-400">★ {item.rating.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default MovieInternalLinks;

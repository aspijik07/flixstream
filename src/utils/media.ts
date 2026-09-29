export type MediaImageOptions = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  quality?: number;
  format?: "webp" | "jpg" | "png";
  className?: string;
  sizes?: string;
};

export function getOptimizedImageUrl(
  rawUrl: string | null | undefined,
  width = 1200,
  quality = 82,
  format: "webp" | "jpg" | "png" = "webp"
): string {
  if (!rawUrl) {
    return "";
  }

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  const normalized = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${normalized}?width=${width}&quality=${quality}&format=${format}`;
}

export function getImageDimensions(
  width = 1200,
  height = 675,
  ratio?: number
): { width: number; height: number } {
  if (ratio) {
    return {
      width,
      height: Math.round(width / ratio)
    };
  }

  return {
    width,
    height
  };
}

export function getBackdropPreloadLink(
  backdropUrl: string | null | undefined,
  width = 1600
): string | null {
  if (!backdropUrl) {
    return null;
  }

  const finalUrl = backdropUrl.includes("image.tmdb.org")
    ? `${backdropUrl}`
    : getOptimizedImageUrl(backdropUrl, width, 90, "webp");

  return finalUrl;
}

export function renderImagePreloadTag(backdropUrl: string | null | undefined): string {
  const src = getBackdropPreloadLink(backdropUrl, 1600);

  if (!src) {
    return "";
  }

  return `<link rel="preload" as="image" href="${src}" imagesrcset="${src} 1x" fetchpriority="high" />`;
}

export function getMoviePosterImage(
  posterPath: string | null | undefined,
  width = 1200,
  height = 1800
): { src: string; width: number; height: number } {
  const src = posterPath
    ? `https://image.tmdb.org/t/p/w1200${posterPath}`
    : "https://placehold.co/1200x1800/111111/ffffff?text=FlixStream";

  return {
    src,
    width,
    height
  };
}

export function getMovieBackdropImage(
  backdropPath: string | null | undefined,
  width = 1600,
  height = 900
): { src: string; width: number; height: number } {
  const src = backdropPath
    ? `https://image.tmdb.org/t/p/original${backdropPath}`
    : "https://placehold.co/1600x900/111111/ffffff?text=FlixStream";

  return {
    src,
    width,
    height
  };
}

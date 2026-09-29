import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MOVIE_ROUTE_PATTERN = /^\/(?:en|es|pt|fr)\/(?:movie|pelicula|filme|film)\//;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!MOVIE_ROUTE_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=86400, stale-while-revalidate=604800"
  );
  response.headers.set("CDN-Cache-Control", "public, s-maxage=86400");
  response.headers.set("Vary", "Accept-Language, Cookie");

  return response;
}

export const config = {
  matcher: [
    "/en/movie/:path*",
    "/es/pelicula/:path*",
    "/pt/filme/:path*",
    "/fr/film/:path*"
  ]
};

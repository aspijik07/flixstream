declare module "next" {
  export type Metadata = {
    metadataBase?: URL;
    title?: string | null;
    description?: string | null;
    alternates?: {
      canonical?: string;
      languages?: Record<string, string>;
    };
    openGraph?: {
      type?: string;
      locale?: string;
      siteName?: string;
      title?: string | null;
      description?: string | null;
      url?: string;
      images?: Array<{
        url: string;
        width?: number;
        height?: number;
        alt?: string;
      }>;
    };
    twitter?: {
      card?: string;
      title?: string | null;
      description?: string | null;
      images?: string[];
    };
    robots?: {
      index?: boolean;
      follow?: boolean;
      googleBot?: Record<string, string | number | boolean>;
    };
    other?: Record<string, string>;
  };
}

declare module "next/metadata" {
  export type Metadata = import("next").Metadata;
}

declare module "next/server" {
  export type NextRequest = {
    nextUrl: {
      pathname: string;
      searchParams: URLSearchParams;
    };
  };

  export class NextResponse {
    static next(): NextResponse;
    headers: {
      set(name: string, value: string): void;
      get(name: string): string | null;
    };
  }
}

declare module "react" {
  export type ReactNode = string | number | boolean | null | undefined;
  const React: {
    createElement: (...args: any[]) => any;
  };
  export default React;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }

  interface Element {
    [key: string]: any;
  }
}

declare interface RequestInit {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
}

declare const process: {
  env: Record<string, string | undefined>;
};

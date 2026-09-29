#!/usr/bin/env python3
"""
High-Scale Programmatic SEO (pSEO) Automated Engine
==================================================
Scales to 50 movies per day by paginating TMDB, generating long-form SEO content
using Gemini 3.8 Flash, applying intelligent rate-limiting (4s delay),
embedding Schema.org Rich Results, and building an automated XML sitemap.
"""

import html
import json
import logging
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from google import genai

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("pSEO-Engine")

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://500get.com").rstrip("/")
WATCH_ACTION_URL = "https://500get.com"
MOVIES_DIR = "movies"
SITEMAP_PATH = "sitemap.xml"

# TARGET: 50 Movies per Day
DAILY_MOVIES_TARGET = int(os.environ.get("MOVIES_LIMIT", 50))
DELAY_BETWEEN_CALLS = 4  # Seconds to avoid Google Gemini 15 RPM rate limits

TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


def validate_environment() -> None:
    if not TMDB_API_KEY or not GEMINI_API_KEY:
        logger.error("Missing TMDB_API_KEY or GEMINI_API_KEY.")
        sys.exit(1)


# ---------------------------------------------------------
# TMDB Fetching with Pagination (Fetches up to 50 movies)
# ---------------------------------------------------------
def fetch_top_trending_movies(target_count: int = 50) -> List[Dict[str, Any]]:
    """Fetches trending movies across multiple pages to reach the target count."""
    logger.info(f"Fetching up to {target_count} trending movies from TMDB...")
    headers = {"accept": "application/json"}
    params = {}
    if len(TMDB_API_KEY) > 50:
        headers["Authorization"] = f"Bearer {TMDB_API_KEY}"
    else:
        params["api_key"] = TMDB_API_KEY

    movies = []
    page = 1

    while len(movies) < target_count and page <= 5:
        try:
            params["page"] = page
            url = "https://api.themoviedb.org/3/trending/movie/day"
            response = requests.get(url, headers=headers, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])

            if not results:
                break

            for item in results:
                title = item.get("title") or item.get("original_title") or "Untitled Movie"
                poster_path = item.get("poster_path")
                poster_url = f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else ""

                movies.append({
                    "id": item.get("id"),
                    "title": title,
                    "overview": item.get("overview", "No synopsis available."),
                    "release_date": item.get("release_date", "2024"),
                    "poster_url": poster_url,
                    "vote_average": float(item.get("vote_average", 0.0)),
                    "vote_count": int(item.get("vote_count", 0)),
                })

                if len(movies) >= target_count:
                    break

            page += 1
            time.sleep(0.5)

        except requests.RequestException as e:
            logger.error(f"TMDB fetch error on page {page}: {e}")
            break

    logger.info(f"Collected {len(movies)} trending movies ready for processing.")
    return movies


# ---------------------------------------------------------
# Content Generation with Backoff Retries
# ---------------------------------------------------------
def generate_article_content(client: genai.Client, movie: Dict[str, Any], max_retries: int = 3) -> Optional[str]:
    prompt = f"""
You are a senior entertainment journalist and elite Technical SEO copywriter.
Write an in-depth, captivating, 800 to 1000 words SEO-optimized article about the movie "{movie['title']}".

Movie Context:
- Title: {movie['title']}
- Release Date: {movie['release_date']}
- Synopsis / Overview: {movie['overview']}
- TMDB Rating: {movie['vote_average']}/10

CRITICAL REQUIREMENTS:
1. Target Keyword: "Watch {movie['title']} Full HD Streaming"
2. The article MUST begin with an exact H1 tag:
   <h1>Watch {movie['title']} Full HD Streaming - Ultimate Guide</h1>
3. Place a prominent Call-to-Action (CTA) button near the top after the intro AND another one before the FAQ:
   <div class="cta-wrapper">
       <a href="/" class="watch-btn">Watch Now / Play</a>
   </div>
4. Include these structured sections (using semantic <h2>, <h3>, <p>, <ul>, <li> tags):
   - Comprehensive Movie Overview & Hook
   - In-Depth Plot Breakdown (intriguing, spoiler-conscious)
   - Cast Performances & Character Highlights
   - Streaming Availability & Where to Watch Online in Full HD
   - Frequently Asked Questions (FAQ) with at least 4 detailed answers
5. Length: 800 to 1000 words.
6. FORMAT: Output ONLY clean semantic HTML content (do NOT include <!DOCTYPE>, <html>, <head>, <body>, or markdown code fences like ```html).
"""

    model_name = "gemini-3.8-flash"

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )

            if not response or not response.text:
                continue

            cleaned_html = response.text.strip()
            if cleaned_html.startswith("```"):
                cleaned_html = re.sub(r"^```(?:html)?\s*", "", cleaned_html, flags=re.IGNORECASE)
                cleaned_html = re.sub(r"\s*```$", "", cleaned_html)

            body_match = re.search(r"<body[^>]*>(.*?)</body>", cleaned_html, flags=re.DOTALL | re.IGNORECASE)
            if body_match:
                cleaned_html = body_match.group(1).strip()

            return cleaned_html

        except Exception as e:
            logger.warning(f"Attempt {attempt} failed for '{movie['title']}': {e}")
            if attempt < max_retries:
                wait_time = attempt * 7
                logger.info(f"Retrying '{movie['title']}' in {wait_time}s...")
                time.sleep(wait_time)

    return None


# ---------------------------------------------------------
# Schema Markup (JSON-LD)
# ---------------------------------------------------------
def build_json_ld_schema(movie: Dict[str, Any]) -> str:
    schema = {
        "@context": "https://schema.org",
        "@type": "Movie",
        "name": movie["title"],
        "description": movie["overview"],
        "image": movie["poster_url"] or f"{SITE_BASE_URL}/default-poster.jpg",
        "dateCreated": movie["release_date"],
        "potentialAction": {
            "@type": "WatchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": WATCH_ACTION_URL,
                "inLanguage": "en",
                "actionPlatform": [
                    "http://schema.org/DesktopWebPlatform",
                    "http://schema.org/MobileWebPlatform"
                ]
            }
        }
    }

    if movie.get("vote_count", 0) > 0 and movie.get("vote_average", 0) > 0:
        schema["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": str(round(movie["vote_average"], 1)),
            "bestRating": "10",
            "worstRating": "1",
            "ratingCount": str(movie["vote_count"])
        }

    return json.dumps(schema, ensure_ascii=False, indent=2).replace("</script", "<\\/script")


def render_full_html_document(movie: Dict[str, Any], article_body: str, page_url: str) -> str:
    title_escaped = html.escape(movie["title"])
    desc_escaped = html.escape(movie["overview"])
    poster_escaped = html.escape(movie["poster_url"])
    json_ld = build_json_ld_schema(movie)

    poster_block = ""
    if poster_escaped:
        poster_block = (
            f'<div class="movie-poster-box">'
            f'<img src="{poster_escaped}" alt="{title_escaped} Poster" width="340" height="510" loading="eager" />'
            f'</div>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Watch {title_escaped} Full HD Streaming - Ultimate Guide</title>
  <meta name="description" content="{desc_escaped}">
  <link rel="canonical" href="{page_url}">

  <!-- Open Graph -->
  <meta property="og:type" content="video.movie">
  <meta property="og:url" content="{page_url}">
  <meta property="og:title" content="Watch {title_escaped} Full HD Streaming - Ultimate Guide">
  <meta property="og:description" content="{desc_escaped}">
  <meta property="og:image" content="{poster_escaped}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Watch {title_escaped} Full HD Streaming - Ultimate Guide">
  <meta name="twitter:description" content="{desc_escaped}">
  <meta name="twitter:image" content="{poster_escaped}">

  <!-- Google Rich Results Schema -->
  <script type="application/ld+json">
{json_ld}
  </script>

  <style>
    :root {{
      --bg: #0b0c10;
      --card-bg: #151821;
      --text: #e2e8f0;
      --heading: #ffffff;
      --accent: #e50914;
      --accent-glow: rgba(229, 9, 20, 0.45);
      --link: #38bdf8;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.8;
      padding: 1.5rem 1rem 4rem;
    }}
    .article-container {{
      max-width: 860px;
      margin: 0 auto;
      background-color: var(--card-bg);
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
      border: 1px solid #1f2430;
    }}
    .movie-poster-box {{ text-align: center; margin-bottom: 2rem; }}
    .movie-poster-box img {{
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
    }}
    h1 {{
      font-size: 2.2rem;
      color: var(--heading);
      line-height: 1.3;
      margin-bottom: 1.5rem;
      text-align: center;
    }}
    h2 {{
      font-size: 1.6rem;
      color: var(--heading);
      margin: 2.5rem 0 1rem;
      border-bottom: 2px solid #242a38;
      padding-bottom: 0.5rem;
    }}
    h3 {{ font-size: 1.25rem; color: var(--link); margin: 1.5rem 0 0.5rem; }}
    p {{ margin-bottom: 1.25rem; font-size: 1.05rem; }}
    ul, ol {{ margin: 1rem 0 1.5rem 1.5rem; }}
    li {{ margin-bottom: 0.5rem; }}
    .cta-wrapper {{ text-align: center; margin: 2.5rem 0; }}
    .watch-btn {{
      display: inline-block;
      background: linear-gradient(135deg, #e50914 0%, #ff3838 100%);
      color: #ffffff !important;
      font-size: 1.25rem;
      font-weight: 800;
      text-decoration: none;
      padding: 1.1rem 2.8rem;
      border-radius: 50px;
      box-shadow: 0 8px 25px var(--accent-glow);
      transition: transform 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }}
    .watch-btn:hover {{ transform: translateY(-3px) scale(1.03); }}
    @media (max-width: 640px) {{
      .article-container {{ padding: 1.5rem; }}
      h1 {{ font-size: 1.7rem; }}
      .watch-btn {{ width: 100%; }}
    }}
  </style>
</head>
<body>
  <main class="article-container">
    {poster_block}
    <article>
{article_body}
    </article>
  </main>
</body>
</html>"""


# ---------------------------------------------------------
# Sitemap Handling
# ---------------------------------------------------------
def update_sitemap(page_url: str, sitemap_path: str = SITEMAP_PATH) -> None:
    ET.register_namespace("", SITEMAP_NS)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if os.path.exists(sitemap_path) and os.path.getsize(sitemap_path) > 0:
        try:
            tree = ET.parse(sitemap_path)
            root = tree.getroot()
        except ET.ParseError:
            root = ET.Element(f"{{{SITEMAP_NS}}}urlset")
            tree = ET.ElementTree(root)
    else:
        root = ET.Element(f"{{{SITEMAP_NS}}}urlset")
        tree = ET.ElementTree(root)

    existing_locs = {
        loc.text.strip()
        for loc in root.findall(f".//{{{SITEMAP_NS}}}loc")
        if loc.text
    }

    if page_url in existing_locs:
        return

    url_node = ET.SubElement(root, f"{{{SITEMAP_NS}}}url")
    loc_node = ET.SubElement(url_node, f"{{{SITEMAP_NS}}}loc")
    loc_node.text = page_url

    lastmod_node = ET.SubElement(url_node, f"{{{SITEMAP_NS}}}lastmod")
    lastmod_node.text = today

    freq_node = ET.SubElement(url_node, f"{{{SITEMAP_NS}}}changefreq")
    freq_node.text = "daily"

    priority_node = ET.SubElement(url_node, f"{{{SITEMAP_NS}}}priority")
    priority_node.text = "0.8"

    if hasattr(ET, "indent"):
        ET.indent(tree, space="  ", level=0)

    tree.write(sitemap_path, encoding="utf-8", xml_declaration=True)


# ---------------------------------------------------------
# Main Execution Pipeline
# ---------------------------------------------------------
def main() -> None:
    validate_environment()
    os.makedirs(MOVIES_DIR, exist_ok=True)
    client = genai.Client(api_key=GEMINI_API_KEY)

    # Fetch 50 trending movies
    movies = fetch_top_trending_movies(target_count=DAILY_MOVIES_TARGET)
    if not movies:
        logger.warning("No movies found to process.")
        return

    generated_today = 0

    for idx, movie in enumerate(movies, start=1):
        slug = slugify(movie["title"])
        filename = f"{slug}-streaming.html"
        file_path = os.path.join(MOVIES_DIR, filename)
        canonical_url = f"{SITE_BASE_URL}/{MOVIES_DIR}/{filename}"

        # Skip existing files to save API quota
        if os.path.exists(file_path):
            continue

        logger.info(f"[{idx}/{len(movies)}] Processing: {movie['title']}")
        article_body = generate_article_content(client, movie)

        if not article_body:
            logger.warning(f"Could not generate article for '{movie['title']}'. Skipping.")
            continue

        # Save HTML file
        full_html = render_full_html_document(movie, article_body, canonical_url)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(full_html)

        # Update Sitemap
        update_sitemap(canonical_url, SITEMAP_PATH)
        generated_today += 1
        logger.info(f"Successfully published [{generated_today}]: {filename}")

        # Rate-limiting delay to keep Gemini API happy
        time.sleep(DELAY_BETWEEN_CALLS)

    logger.info(f"Run completed. Successfully published {generated_today} new articles.")


if __name__ == "__main__":
    main()
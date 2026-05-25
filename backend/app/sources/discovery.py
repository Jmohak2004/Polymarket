"""
Web source discovery for prediction markets.

Uses DuckDuckGo (no key) and Bing Web Search API when configured.
Fetches pages and extracts readable text with trafilatura for preview / oracle pipelines.
"""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx
import trafilatura
from bs4 import BeautifulSoup

from ..config import settings


@dataclass
class SourceCandidate:
    url: str
    title: str
    snippet: str
    provider: str


def build_search_query(question: str, market_type: int, hints: str | None = None) -> str:
    """Turn a market question into a web search query."""
    q = question.strip()
    type_suffix: dict[int, str] = {
        0: "full speech transcript video OR live stream youtube",
        1: "photo image live event video screenshot",
        2: "weather forecast rainfall",
        3: "news OR site:twitter.com OR site:x.com OR reddit",
        4: "",
    }
    extra = type_suffix.get(market_type, "")
    parts = [q]
    if extra:
        parts.append(extra)
    if hints and hints.strip():
        parts.append(hints.strip())
    return " ".join(parts)


async def discover_sources(
    question: str,
    market_type: int = 0,
    search_hints: str | None = None,
    max_results: int = 8,
) -> tuple[str, list[SourceCandidate]]:
    """
    Returns (search_query_used, ranked list of SourceCandidate).
    Queries DuckDuckGo and Bing (if key set), merges and dedupes.
    """
    query = build_search_query(question, market_type, search_hints)
    seen: set[str] = set()
    out: list[SourceCandidate] = []

    tasks = [_search_duckduckgo(query, max_results)]
    if settings.bing_search_api_key:
        tasks.append(_search_bing(query, max_results))

    batches = await asyncio.gather(*tasks, return_exceptions=True)
    for batch in batches:
        if isinstance(batch, Exception):
            continue
        for c in batch:
            norm = _normalize_url(c.url)
            if norm in seen:
                continue
            seen.add(norm)
            out.append(c)
            if len(out) >= max_results:
                break
        if len(out) >= max_results:
            break

    return query, out


def _normalize_url(url: str) -> str:
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc.lower()}{p.path}"
    except Exception:
        return url


async def _search_bing(query: str, limit: int) -> list[SourceCandidate]:
    if not settings.bing_search_api_key or limit <= 0:
        return []

    endpoint = settings.bing_search_endpoint.rstrip("/")
    headers = {"Ocp-Apim-Subscription-Key": settings.bing_search_api_key}
    params = {"q": query, "count": min(limit, 20), "responseFilter": "Webpages"}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(endpoint, headers=headers, params=params)
        r.raise_for_status()
        data = r.json()

    out: list[SourceCandidate] = []
    web = data.get("webPages", {}) or {}
    for item in (web.get("value") or [])[:limit]:
        url = item.get("url") or ""
        if not url:
            continue
        out.append(
            SourceCandidate(
                url=url,
                title=item.get("name") or "",
                snippet=(item.get("snippet") or "")[:500],
                provider="bing",
            )
        )
    return out


async def _search_duckduckgo(query: str, limit: int) -> list[SourceCandidate]:
    """No API key required."""
    if limit <= 0:
        return []

    def _run() -> list[SourceCandidate]:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return []
        rows: list[SourceCandidate] = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=min(limit, 15)):
                href = r.get("href") or r.get("url") or ""
                if not href:
                    continue
                rows.append(
                    SourceCandidate(
                        url=href,
                        title=r.get("title") or "",
                        snippet=(r.get("body") or "")[:500],
                        provider="duckduckgo",
                    )
                )
        return rows

    return await asyncio.to_thread(_run)


def _title_from_html(html: str) -> str | None:
    soup = BeautifulSoup(html, "lxml")
    t = soup.find("title")
    if t and t.string:
        s = t.string.strip()
        if s:
            return s[:300]
    h1 = soup.find("h1")
    if h1 and h1.get_text:
        s = h1.get_text(strip=True)
        if s:
            return s[:300]
    return None


def _strip_boilerplate(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


async def extract_text_from_url(url: str, max_chars: int = 12000) -> dict[str, Any]:
    """
    Download URL and extract main text. Returns title, text, warning (if any).
    """
    headers = {
        "User-Agent": settings.http_user_agent,
        "Accept": "text/html,application/xhtml+xml,*/*",
    }

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(25.0),
        follow_redirects=True,
        headers=headers,
    ) as client:
        r = await client.get(url)
        r.raise_for_status()
        if len(r.content) > settings.max_fetch_bytes:
            return {
                "url": url,
                "title": None,
                "text": "",
                "warning": f"Response too large ({len(r.content)} bytes); increase max_fetch_bytes or use a direct link.",
            }
        html = r.content.decode(r.encoding or "utf-8", errors="replace")
        meta = trafilatura.extract(
            html,
            url=url,
            include_tables=False,
            include_images=False,
            include_links=False,
            output_format="txt",
        )
        page_title: str | None = _title_from_html(html)
        text = (meta or "").strip()
        if not text or len(text) < 200:
            text = _strip_boilerplate(html)
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[… truncated]"

        return {
            "url": url,
            "title": page_title,
            "text": text,
            "warning": None,
        }


def extract_text_from_url_sync(url: str, max_chars: int = 12000) -> dict[str, Any]:
    """Synchronous fetch+extract; use from non-async code."""
    down = trafilatura.fetch_url(url, no_ssl=False)  # type: ignore[no-untyped-call]
    if not down:
        return {"url": url, "title": None, "text": "", "warning": "Could not download URL."}
    meta = trafilatura.extract(
        down,
        url=url,
        include_tables=False,
        include_images=False,
        include_links=False,
        output_format="txt",
    )
    tmeta = trafilatura.extract_metadata(down, url=url)
    title: str | None = tmeta.title if tmeta and getattr(tmeta, "title", None) else None
    text = (meta or "").strip()
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[… truncated]"
    return {"url": url, "title": title, "text": text, "warning": None}

import httpx
from fastapi import APIRouter, HTTPException, Query

from ..schemas import DiscoverRequest, DiscoverResponse, SourceItem, UrlPreviewResponse
from ..sources.discovery import discover_sources, extract_text_from_url

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("/discover", response_model=DiscoverResponse)
async def discover_sources_endpoint(body: DiscoverRequest):
    """
    Search the web for pages that can back a market (news, speeches, streams, etc.).
    Configure TAVILY_API_KEY, SERPAPI_KEY, GOOGLE_CSE_*, or BRAVE_SEARCH_API_KEY
    for reliable results; otherwise DuckDuckGo HTML search is used (dev / rate-limited).
    """
    search_query, candidates = await discover_sources(
        question=body.question,
        market_type=body.market_type,
        search_hints=body.search_hints,
        max_results=body.max_results,
    )
    if not candidates:
        raise HTTPException(
            status_code=502,
            detail=(
                "No search results returned. Configure a search API key in .env "
                "(e.g. TAVILY_API_KEY) or try different search_hints."
            ),
        )
    return DiscoverResponse(
        search_query=search_query,
        sources=[
            SourceItem(
                url=c.url,
                title=c.title,
                snippet=c.snippet,
                provider=c.provider,
            )
            for c in candidates
        ],
    )


@router.get("/preview", response_model=UrlPreviewResponse)
async def preview_url(url: str = Query(..., min_length=8, description="HTTP(S) URL to fetch and extract")):
    """Download a page and return extracted main text (for oracle preview / debugging)."""
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must be http(s)")
    try:
        data = await extract_text_from_url(url)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {e}") from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return UrlPreviewResponse(
        url=data["url"],
        title=data.get("title"),
        text=data.get("text") or "",
        warning=data.get("warning"),
    )

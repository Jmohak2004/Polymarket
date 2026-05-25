from fastapi import APIRouter, HTTPException, Query, status
from datetime import datetime

from .. import store
from ..models import MarketStatus
from ..schemas import (
    MarketChainSyncRequest,
    MarketCreateRequest,
    MarketResponse,
    MarketSummaryResponse,
    PagedMarketsResponse,
)
from ..sources.discovery import discover_sources

router = APIRouter(prefix="/markets", tags=["markets"])


def _normalize_address(addr: str | None) -> str:
    return (addr or "").strip().lower()


def _to_response(record: store.MarketRecord) -> MarketResponse:
    return MarketResponse.model_validate(record)


@router.patch(
    "/{market_id}/chain-sync",
    response_model=MarketResponse,
)
async def sync_market_chain(
    market_id: int,
    payload: MarketChainSyncRequest,
):
    """Persist on-chain ids after deploy (creator must match the DB listing)."""
    market = await store.get_market(market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    stored = _normalize_address(market.creator_address)
    signer = _normalize_address(payload.creator_address)
    if stored and stored != signer:
        raise HTTPException(
            status_code=403,
            detail="creator_address does not match this market listing",
        )

    conflict = await store.find_market_by_chain_id(
        payload.chain_market_id, exclude_id=market_id
    )
    if conflict is not None:
        raise HTTPException(
            status_code=409,
            detail="chain_market_id is already linked to another market",
        )

    if market.chain_market_id is not None:
        if market.chain_market_id != payload.chain_market_id:
            raise HTTPException(
                status_code=409,
                detail="Market already linked to a different chain_market_id",
            )

    updates: dict = {}
    if market.chain_market_id is None:
        updates["chain_market_id"] = payload.chain_market_id
    if payload.tx_hash is not None:
        updates["tx_hash"] = payload.tx_hash

    updated = await store.update_market(market_id, **updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Market not found")
    return _to_response(updated)


@router.post("/", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
async def create_market(payload: MarketCreateRequest):
    if payload.resolution_time <= datetime.utcnow():
        raise HTTPException(
            status_code=400, detail="resolution_time must be in the future"
        )

    data_source = (payload.data_source or "").strip()
    if payload.auto_discover:
        _, candidates = await discover_sources(
            question=payload.question,
            market_type=payload.market_type.value,
            search_hints=payload.search_hints,
            max_results=5,
        )
        if not candidates:
            raise HTTPException(
                status_code=400,
                detail=(
                    "auto_discover found no web sources via DuckDuckGo/Bing. "
                    "Set BING_SEARCH_API_KEY, refine search_hints, or paste a data_source URL."
                ),
            )
        data_source = candidates[0].url

    market = await store.create_market(
        question=payload.question,
        market_type=payload.market_type.value,
        data_source=data_source,
        resolution_time=payload.resolution_time,
        creator_address=payload.creator_address,
    )
    return _to_response(market)


@router.get("/summary", response_model=MarketSummaryResponse)
async def market_summary():
    total, by_status = await store.market_summary()
    return MarketSummaryResponse(total=total, by_status=by_status)


@router.get("/", response_model=PagedMarketsResponse)
async def list_markets(
    status_filter: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=100),
):
    rows, total = await store.list_markets(
        status_filter=status_filter, offset=offset, limit=limit
    )
    return PagedMarketsResponse(
        items=[_to_response(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(market_id: int):
    market = await store.get_market(market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return _to_response(market)


@router.delete("/{market_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_market(market_id: int):
    market = await store.get_market(market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status not in (MarketStatus.OPEN, MarketStatus.DISPUTED):
        raise HTTPException(status_code=400, detail="Market cannot be cancelled")
    await store.update_market(market_id, status=MarketStatus.CANCELLED)

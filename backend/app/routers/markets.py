from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from ..database import get_db
from ..models import MarketDB, MarketStatus
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


@router.patch(
    "/{market_id}/chain-sync",
    response_model=MarketResponse,
)
async def sync_market_chain(
    market_id: int,
    payload: MarketChainSyncRequest,
    db: AsyncSession = Depends(get_db),
):
    """Persist on-chain ids after deploy (creator must match the DB listing)."""
    market = await db.get(MarketDB, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    stored = _normalize_address(market.creator_address)
    signer = _normalize_address(payload.creator_address)
    if stored and stored != signer:
        raise HTTPException(
            status_code=403,
            detail="creator_address does not match this market listing",
        )

    conflict = await db.execute(
        select(MarketDB)
        .where(MarketDB.chain_market_id == payload.chain_market_id)
        .where(MarketDB.id != market_id)
        .limit(1)
    )
    if conflict.scalars().first() is not None:
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
    else:
        market.chain_market_id = payload.chain_market_id

    if payload.tx_hash is not None:
        market.tx_hash = payload.tx_hash

    await db.commit()
    await db.refresh(market)
    return market


@router.post("/", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
async def create_market(
    payload: MarketCreateRequest,
    db: AsyncSession = Depends(get_db),
):
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
                    "auto_discover found no web sources. Add TAVILY_API_KEY or another "
                    "search API in .env, refine search_hints, or paste a data_source URL."
                ),
            )
        data_source = candidates[0].url

    market = MarketDB(
        question=payload.question,
        market_type=payload.market_type.value,
        data_source=data_source,
        resolution_time=payload.resolution_time,
        creator_address=payload.creator_address,
    )
    db.add(market)
    await db.commit()
    await db.refresh(market)
    return market


@router.get("/summary", response_model=MarketSummaryResponse)
async def market_summary(db: AsyncSession = Depends(get_db)):
    total_row = await db.execute(select(func.count()).select_from(MarketDB))
    total = int(total_row.scalar_one() or 0)

    grp = await db.execute(
        select(MarketDB.status, func.count()).select_from(MarketDB).group_by(MarketDB.status)
    )
    by_status: dict[str, int] = {str(r[0]): int(r[1]) for r in grp.all()}
    return MarketSummaryResponse(total=total, by_status=by_status)


@router.get("/", response_model=PagedMarketsResponse)
async def list_markets(
    status_filter: int | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(40, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    count_q = select(func.count()).select_from(MarketDB)
    query = select(MarketDB)
    if status_filter is not None:
        query = query.where(MarketDB.status == status_filter)
        count_q = count_q.where(MarketDB.status == status_filter)
    query = query.order_by(MarketDB.created_at.desc()).offset(offset).limit(limit)

    total = int((await db.execute(count_q)).scalar_one() or 0)
    result = await db.execute(query)
    rows = result.scalars().all()
    return PagedMarketsResponse(
        items=list(rows),
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(market_id: int, db: AsyncSession = Depends(get_db)):
    market = await db.get(MarketDB, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market


@router.delete("/{market_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_market(market_id: int, db: AsyncSession = Depends(get_db)):
    market = await db.get(MarketDB, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status not in (MarketStatus.OPEN, MarketStatus.DISPUTED):
        raise HTTPException(status_code=400, detail="Market cannot be cancelled")
    market.status = MarketStatus.CANCELLED
    await db.commit()

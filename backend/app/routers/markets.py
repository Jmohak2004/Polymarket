from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import MarketDB, MarketStatus
from ..schemas import MarketCreateRequest, MarketResponse

router = APIRouter(prefix="/markets", tags=["markets"])


@router.post("/", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
async def create_market(
    payload: MarketCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    if payload.resolution_time <= datetime.utcnow():
        raise HTTPException(
            status_code=400, detail="resolution_time must be in the future"
        )

    market = MarketDB(
        question=payload.question,
        market_type=payload.market_type.value,
        data_source=payload.data_source,
        resolution_time=payload.resolution_time,
        creator_address=payload.creator_address,
    )
    db.add(market)
    await db.commit()
    await db.refresh(market)
    return market


@router.get("/", response_model=List[MarketResponse])
async def list_markets(
    status_filter: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(MarketDB).order_by(MarketDB.created_at.desc())
    if status_filter is not None:
        query = query.where(MarketDB.status == status_filter)
    result = await db.execute(query)
    return result.scalars().all()


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

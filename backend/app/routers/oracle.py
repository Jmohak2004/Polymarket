from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import OracleJobDB, MarketDB
from ..schemas import OracleJobResponse, OracleVoteRequest
from ..oracle.dispatcher import dispatch_oracle_job

router = APIRouter(prefix="/oracle", tags=["oracle"])


@router.post("/trigger/{market_id}", response_model=OracleJobResponse)
async def trigger_oracle(
    market_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger oracle resolution for a market (or called by scheduler)."""
    market = await db.get(MarketDB, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    job = OracleJobDB(
        market_id=market_id,
        job_type=_job_type_for_market(market.market_type),
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(dispatch_oracle_job, job.id, market_id, market.market_type)
    return job


@router.get("/jobs", response_model=List[OracleJobResponse])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OracleJobDB).order_by(OracleJobDB.created_at.desc()).limit(100)
    )
    return result.scalars().all()


@router.get("/jobs/{job_id}", response_model=OracleJobResponse)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    job = await db.get(OracleJobDB, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/vote", status_code=200)
async def submit_vote(payload: OracleVoteRequest):
    """Submit a vote on-chain via the oracle wallet. Called after AI pipeline completes."""
    from ..blockchain import submit_oracle_vote

    try:
        tx_hash = submit_oracle_vote(
            payload.market_id, payload.outcome, payload.confidence
        )
        return {"tx_hash": tx_hash}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


def _job_type_for_market(market_type: int) -> str:
    mapping = {0: "speech", 1: "image", 2: "weather", 3: "social", 4: "custom"}
    return mapping.get(market_type, "custom")

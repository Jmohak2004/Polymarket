"""
Oracle job dispatcher.
Picks the right oracle pipeline based on market type and runs it.
"""
import asyncio
from datetime import datetime

from ..database import AsyncSessionLocal
from ..models import OracleJobDB, MarketDB
from .speech import SpeechOracle
from .image import ImageOracle
from .weather import WeatherOracle
from .social import SocialOracle


async def dispatch_oracle_job(job_id: int, market_id: int, market_type: int) -> None:
    async with AsyncSessionLocal() as db:
        job = await db.get(OracleJobDB, job_id)
        market = await db.get(MarketDB, market_id)
        if not job or not market:
            return

        job.status = "running"
        await db.commit()

        try:
            oracle_map = {
                0: SpeechOracle,
                1: ImageOracle,
                2: WeatherOracle,
                3: SocialOracle,
            }
            oracle_cls = oracle_map.get(market_type, SocialOracle)
            oracle = oracle_cls(market)

            result, confidence, raw_output = await oracle.resolve()

            job.status = "done"
            job.result = result
            job.confidence = confidence
            job.raw_output = raw_output[:2000] if raw_output else None
            job.completed_at = datetime.utcnow()

            # Update market
            market.outcome = result
            market.oracle_confidence = confidence

        except Exception as exc:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = datetime.utcnow()

        await db.commit()

"""
Oracle job dispatcher.
Picks the right oracle pipeline based on market type and runs it.
"""
import asyncio
import logging
from datetime import datetime

from ..config import settings
from ..database import AsyncSessionLocal
from ..models import OracleJobDB, MarketDB, MarketStatus
from .speech import SpeechOracle
from .image import ImageOracle
from .weather import WeatherOracle
from .social import SocialOracle

logger = logging.getLogger(__name__)


async def _submit_on_chain_vote(
    chain_market_id: int, outcome: bool, confidence: int
) -> str | None:
    """Submit oracle vote on-chain; returns tx hash or None when chain is not configured."""
    if not settings.oracle_private_key or not settings.oracle_resolver_address:
        return None

    from ..blockchain import submit_oracle_vote

    return await asyncio.to_thread(
        submit_oracle_vote, chain_market_id, outcome, confidence
    )


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

            market.outcome = result
            market.oracle_confidence = confidence
            market.status = MarketStatus.CLOSED

            if market.chain_market_id is not None:
                try:
                    tx_hash = await _submit_on_chain_vote(
                        market.chain_market_id, result, int(confidence)
                    )
                    if tx_hash:
                        suffix = f"\nOn-chain vote tx: {tx_hash}"
                        job.raw_output = ((job.raw_output or "") + suffix)[:2000]
                        logger.info(
                            "Oracle vote submitted for chain_market_id=%s tx=%s",
                            market.chain_market_id,
                            tx_hash,
                        )
                except Exception as exc:
                    logger.exception(
                        "On-chain vote failed for chain_market_id=%s",
                        market.chain_market_id,
                    )
                    job.error = f"On-chain vote failed: {exc}"[:500]

        except Exception as exc:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = datetime.utcnow()

        await db.commit()

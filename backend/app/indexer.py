"""
Lightweight on-chain event indexer.

Polls the PredictionMarket contract for BetPlaced and MarketResolved events
and syncs the data back into the local database.

Usage (run as a background task from main.py lifespan, or standalone):
    python -m app.indexer

The indexer is intentionally simple — it re-scans from the last known block
stored in a small state table, so it is safe to restart at any time.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select, text

from .config import settings
from .database import AsyncSessionLocal
from .models import MarketDB, MarketStatus

logger = logging.getLogger(__name__)

# How many blocks to scan per poll cycle (keep small to avoid RPC timeouts)
BLOCK_CHUNK = 2_000
# Seconds between poll cycles
POLL_INTERVAL = 15

_ARTIFACTS_DIR = (
    Path(__file__).parent.parent.parent / "contracts" / "artifacts" / "contracts"
)


def _load_abi(name: str) -> list:
    path = _ARTIFACTS_DIR / f"{name}.sol" / f"{name}.json"
    with open(path) as f:
        return json.load(f)["abi"]


# ─────────────────────────────────────────────────────────────────────────────
# State helpers (persisted in DB as a simple key-value row)
# ─────────────────────────────────────────────────────────────────────────────

_STATE_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS indexer_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
)
"""


async def _ensure_state_table() -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(text(_STATE_TABLE_DDL))
        await db.commit()


async def _get_last_block() -> int:
    async with AsyncSessionLocal() as db:
        row = await db.execute(
            text("SELECT value FROM indexer_state WHERE key = 'last_block'")
        )
        r = row.fetchone()
        return int(r[0]) if r else 0


async def _set_last_block(block: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            text(
                "INSERT INTO indexer_state (key, value) VALUES ('last_block', :v) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
            ),
            {"v": str(block)},
        )
        await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Event handlers
# ─────────────────────────────────────────────────────────────────────────────


async def _handle_bet_placed(event: dict) -> None:
    """Update yes_pool / no_pool in the DB from a BetPlaced event."""
    args = event["args"]
    chain_market_id: int = int(args["marketId"])
    is_yes: bool = bool(args["isYes"])
    amount_wei: int = int(args["amount"])
    amount_eth = amount_wei / 1e18

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MarketDB).where(MarketDB.chain_market_id == chain_market_id)
        )
        market: MarketDB | None = result.scalars().first()
        if market is None:
            logger.debug("BetPlaced: no DB row for chain_market_id=%s", chain_market_id)
            return

        if is_yes:
            market.yes_pool = (market.yes_pool or 0.0) + amount_eth
        else:
            market.no_pool = (market.no_pool or 0.0) + amount_eth

        await db.commit()
        logger.info(
            "BetPlaced synced: market=%s side=%s amount=%.6f ETH",
            chain_market_id,
            "YES" if is_yes else "NO",
            amount_eth,
        )


async def _handle_market_resolved(event: dict) -> None:
    """Mark market as RESOLVED in the DB from a MarketResolved event."""
    args = event["args"]
    chain_market_id: int = int(args["marketId"])
    outcome: bool = bool(args["outcome"])

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MarketDB).where(MarketDB.chain_market_id == chain_market_id)
        )
        market: MarketDB | None = result.scalars().first()
        if market is None:
            logger.debug(
                "MarketResolved: no DB row for chain_market_id=%s", chain_market_id
            )
            return

        market.status = MarketStatus.RESOLVED
        market.outcome = outcome
        await db.commit()
        logger.info(
            "MarketResolved synced: market=%s outcome=%s",
            chain_market_id,
            "YES" if outcome else "NO",
        )


async def _handle_market_disputed(event: dict) -> None:
    """Mark market as DISPUTED in the DB from a MarketDisputed event."""
    args = event["args"]
    chain_market_id: int = int(args["marketId"])

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MarketDB).where(MarketDB.chain_market_id == chain_market_id)
        )
        market: MarketDB | None = result.scalars().first()
        if market is None:
            return

        market.status = MarketStatus.DISPUTED
        await db.commit()
        logger.info("MarketDisputed synced: market=%s", chain_market_id)


# ─────────────────────────────────────────────────────────────────────────────
# Main poll loop
# ─────────────────────────────────────────────────────────────────────────────


async def run_indexer() -> None:
    """
    Continuously poll the chain for new events and sync them to the DB.
    Designed to run as a long-lived asyncio task alongside the FastAPI app.
    """
    if not settings.prediction_market_address:
        logger.warning("PREDICTION_MARKET_ADDRESS not set — indexer disabled.")
        return

    # Lazy import so the app starts even without web3 configured
    from web3 import Web3
    from web3.middleware import ExtraDataToPOAMiddleware

    try:
        abi = _load_abi("PredictionMarket")
    except FileNotFoundError:
        logger.warning("PredictionMarket ABI not found — indexer disabled.")
        return

    await _ensure_state_table()

    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(settings.prediction_market_address),
        abi=abi,
    )

    logger.info(
        "Indexer started — contract=%s rpc=%s",
        settings.prediction_market_address,
        settings.rpc_url,
    )

    while True:
        try:
            latest = w3.eth.block_number
            from_block = (await _get_last_block()) or max(0, latest - BLOCK_CHUNK)
            to_block = min(from_block + BLOCK_CHUNK, latest)

            if from_block >= to_block:
                await asyncio.sleep(POLL_INTERVAL)
                continue

            # Fetch events in parallel
            bet_events = contract.events.BetPlaced.get_logs(  # type: ignore[attr-defined]
                from_block=from_block, to_block=to_block
            )
            resolved_events = contract.events.MarketResolved.get_logs(  # type: ignore[attr-defined]
                from_block=from_block, to_block=to_block
            )
            disputed_events = contract.events.MarketDisputed.get_logs(  # type: ignore[attr-defined]
                from_block=from_block, to_block=to_block
            )

            for ev in bet_events:
                await _handle_bet_placed(ev)
            for ev in resolved_events:
                await _handle_market_resolved(ev)
            for ev in disputed_events:
                await _handle_market_disputed(ev)

            await _set_last_block(to_block)

            if to_block < latest:
                # Still catching up — no sleep
                continue

        except Exception as exc:
            logger.error("Indexer error: %s", exc, exc_info=True)

        await asyncio.sleep(POLL_INTERVAL)


# ─────────────────────────────────────────────────────────────────────────────
# Standalone entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_indexer())

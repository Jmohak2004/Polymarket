"""
Lightweight on-chain event indexer.

Polls the PredictionMarket contract for BetPlaced and MarketResolved events
and syncs the data back into MongoDB.

Usage (run as a background task from main.py lifespan, or standalone):
    python -m app.indexer
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from .config import settings
from . import store
from .models import MarketStatus

logger = logging.getLogger(__name__)

BLOCK_CHUNK = 2_000
POLL_INTERVAL = 15

_ARTIFACTS_DIR = (
    Path(__file__).parent.parent.parent / "contracts" / "artifacts" / "contracts"
)


def _load_abi(name: str) -> list:
    path = _ARTIFACTS_DIR / f"{name}.sol" / f"{name}.json"
    with open(path) as f:
        return json.load(f)["abi"]


async def _handle_bet_placed(event: dict) -> None:
    args = event["args"]
    chain_market_id: int = int(args["marketId"])
    is_yes: bool = bool(args["isYes"])
    amount_wei: int = int(args["amount"])
    amount_eth = amount_wei / 1e18

    market = await store.find_market_by_chain_id(chain_market_id)
    if market is None:
        logger.debug("BetPlaced: no DB row for chain_market_id=%s", chain_market_id)
        return

    if is_yes:
        await store.update_market(
            market.id, yes_pool=(market.yes_pool or 0.0) + amount_eth
        )
    else:
        await store.update_market(
            market.id, no_pool=(market.no_pool or 0.0) + amount_eth
        )

    logger.info(
        "BetPlaced synced: market=%s side=%s amount=%.6f ETH",
        chain_market_id,
        "YES" if is_yes else "NO",
        amount_eth,
    )


async def _handle_market_resolved(event: dict) -> None:
    args = event["args"]
    chain_market_id: int = int(args["marketId"])
    outcome: bool = bool(args["outcome"])

    market = await store.find_market_by_chain_id(chain_market_id)
    if market is None:
        logger.debug(
            "MarketResolved: no DB row for chain_market_id=%s", chain_market_id
        )
        return

    await store.update_market(
        market.id,
        status=MarketStatus.RESOLVED,
        outcome=outcome,
    )
    logger.info(
        "MarketResolved synced: market=%s outcome=%s",
        chain_market_id,
        "YES" if outcome else "NO",
    )


async def _handle_market_disputed(event: dict) -> None:
    args = event["args"]
    chain_market_id: int = int(args["marketId"])

    market = await store.find_market_by_chain_id(chain_market_id)
    if market is None:
        return

    await store.update_market(market.id, status=MarketStatus.DISPUTED)
    logger.info("MarketDisputed synced: market=%s", chain_market_id)


async def run_indexer() -> None:
    if not settings.prediction_market_address:
        logger.warning("PREDICTION_MARKET_ADDRESS not set — indexer disabled.")
        return

    from web3 import Web3
    from web3.middleware import ExtraDataToPOAMiddleware

    try:
        abi = _load_abi("PredictionMarket")
    except FileNotFoundError:
        logger.warning("PredictionMarket ABI not found — indexer disabled.")
        return

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
            from_block = (await store.get_indexer_last_block()) or max(
                0, latest - BLOCK_CHUNK
            )
            to_block = min(from_block + BLOCK_CHUNK, latest)

            if from_block >= to_block:
                await asyncio.sleep(POLL_INTERVAL)
                continue

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

            await store.set_indexer_last_block(to_block)

            if to_block < latest:
                continue

        except Exception as exc:
            logger.error("Indexer error: %s", exc, exc_info=True)

        await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    async def _main() -> None:
        from .database import init_db

        await init_db()
        await run_indexer()

    asyncio.run(_main())

"""MongoDB persistence layer (Motor async driver)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import DESCENDING, ReturnDocument

from .config import settings
from .models import MarketStatus

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized — call init_db() first")
    return _db


@dataclass
class MarketRecord:
    id: int
    question: str
    market_type: int
    data_source: str
    resolution_time: datetime
    created_at: datetime
    chain_market_id: int | None = None
    creator_address: str | None = None
    yes_pool: float = 0.0
    no_pool: float = 0.0
    status: int = MarketStatus.OPEN
    outcome: bool | None = None
    oracle_confidence: float | None = None
    tx_hash: str | None = None

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> MarketRecord:
        return cls(
            id=int(doc["id"]),
            chain_market_id=doc.get("chain_market_id"),
            question=str(doc["question"]),
            market_type=int(doc.get("market_type", 0)),
            data_source=str(doc.get("data_source") or ""),
            resolution_time=doc["resolution_time"],
            created_at=doc.get("created_at") or datetime.utcnow(),
            creator_address=doc.get("creator_address"),
            yes_pool=float(doc.get("yes_pool") or 0.0),
            no_pool=float(doc.get("no_pool") or 0.0),
            status=int(doc.get("status", MarketStatus.OPEN)),
            outcome=doc.get("outcome"),
            oracle_confidence=doc.get("oracle_confidence"),
            tx_hash=doc.get("tx_hash"),
        )


@dataclass
class OracleJobRecord:
    id: int
    market_id: int
    job_type: str
    status: str
    created_at: datetime
    result: bool | None = None
    confidence: float | None = None
    raw_output: str | None = None
    error: str | None = None
    completed_at: datetime | None = None

    @classmethod
    def from_doc(cls, doc: dict[str, Any]) -> OracleJobRecord:
        return cls(
            id=int(doc["id"]),
            market_id=int(doc["market_id"]),
            job_type=str(doc.get("job_type") or ""),
            status=str(doc.get("status") or "pending"),
            result=doc.get("result"),
            confidence=doc.get("confidence"),
            raw_output=doc.get("raw_output"),
            error=doc.get("error"),
            created_at=doc.get("created_at") or datetime.utcnow(),
            completed_at=doc.get("completed_at"),
        )


async def init_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongodb_url)
    _db = _client[settings.mongodb_db_name]

    await _db.markets.create_index("id", unique=True)
    await _db.markets.create_index("chain_market_id", unique=True, sparse=True)
    await _db.markets.create_index([("created_at", DESCENDING)])
    await _db.markets.create_index("status")

    await _db.oracle_jobs.create_index("id", unique=True)
    await _db.oracle_jobs.create_index([("created_at", DESCENDING)])
    await _db.oracle_jobs.create_index("market_id")


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def check_db_alive() -> bool:
    try:
        await get_db().command("ping")
        return True
    except Exception:
        return False


async def _next_seq(name: str) -> int:
    doc = await get_db().counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(doc["seq"])


# ── Markets ───────────────────────────────────────────────────────────────────


async def create_market(**fields: Any) -> MarketRecord:
    market_id = await _next_seq("markets")
    now = datetime.utcnow()
    doc = {
        "id": market_id,
        "chain_market_id": None,
        "yes_pool": 0.0,
        "no_pool": 0.0,
        "status": MarketStatus.OPEN,
        "outcome": None,
        "oracle_confidence": None,
        "tx_hash": None,
        "created_at": now,
        **fields,
    }
    await get_db().markets.insert_one(doc)
    return MarketRecord.from_doc(doc)


async def get_market(market_id: int) -> MarketRecord | None:
    doc = await get_db().markets.find_one({"id": market_id})
    return MarketRecord.from_doc(doc) if doc else None


async def find_market_by_chain_id(chain_market_id: int, exclude_id: int | None = None) -> MarketRecord | None:
    query: dict[str, Any] = {"chain_market_id": chain_market_id}
    if exclude_id is not None:
        query["id"] = {"$ne": exclude_id}
    doc = await get_db().markets.find_one(query)
    return MarketRecord.from_doc(doc) if doc else None


async def update_market(market_id: int, **fields: Any) -> MarketRecord | None:
    doc = await get_db().markets.find_one_and_update(
        {"id": market_id},
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )
    return MarketRecord.from_doc(doc) if doc else None


async def list_markets(
    *,
    status_filter: int | None = None,
    offset: int = 0,
    limit: int = 40,
) -> tuple[list[MarketRecord], int]:
    query: dict[str, Any] = {}
    if status_filter is not None:
        query["status"] = status_filter
    coll = get_db().markets
    total = await coll.count_documents(query)
    cursor = coll.find(query).sort("created_at", DESCENDING).skip(offset).limit(limit)
    rows = [MarketRecord.from_doc(doc) async for doc in cursor]
    return rows, total


async def market_summary() -> tuple[int, dict[str, int]]:
    coll = get_db().markets
    total = await coll.count_documents({})
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    by_status: dict[str, int] = {}
    async for row in coll.aggregate(pipeline):
        by_status[str(row["_id"])] = int(row["count"])
    return total, by_status


# ── Oracle jobs ───────────────────────────────────────────────────────────────


async def create_oracle_job(market_id: int, job_type: str) -> OracleJobRecord:
    job_id = await _next_seq("oracle_jobs")
    now = datetime.utcnow()
    doc = {
        "id": job_id,
        "market_id": market_id,
        "job_type": job_type,
        "status": "pending",
        "result": None,
        "confidence": None,
        "raw_output": None,
        "error": None,
        "created_at": now,
        "completed_at": None,
    }
    await get_db().oracle_jobs.insert_one(doc)
    return OracleJobRecord.from_doc(doc)


async def get_oracle_job(job_id: int) -> OracleJobRecord | None:
    doc = await get_db().oracle_jobs.find_one({"id": job_id})
    return OracleJobRecord.from_doc(doc) if doc else None


async def list_oracle_jobs(limit: int = 100) -> list[OracleJobRecord]:
    cursor = get_db().oracle_jobs.find({}).sort("created_at", DESCENDING).limit(limit)
    return [OracleJobRecord.from_doc(doc) async for doc in cursor]


async def update_oracle_job(job_id: int, **fields: Any) -> OracleJobRecord | None:
    doc = await get_db().oracle_jobs.find_one_and_update(
        {"id": job_id},
        {"$set": fields},
        return_document=ReturnDocument.AFTER,
    )
    return OracleJobRecord.from_doc(doc) if doc else None


# ── Indexer state ─────────────────────────────────────────────────────────────


async def get_indexer_last_block() -> int:
    doc = await get_db().indexer_state.find_one({"_id": "last_block"})
    if not doc:
        return 0
    try:
        return int(doc.get("value", 0))
    except (TypeError, ValueError):
        return 0


async def set_indexer_last_block(block: int) -> None:
    await get_db().indexer_state.update_one(
        {"_id": "last_block"},
        {"$set": {"value": str(block)}},
        upsert=True,
    )

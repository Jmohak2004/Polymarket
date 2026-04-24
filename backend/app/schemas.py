from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from .models import MarketType, MarketStatus


class MarketCreateRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    market_type: MarketType = MarketType.SPEECH_EVENT
    data_source: str = Field(..., description="IPFS CID or URL for full metadata")
    resolution_time: datetime
    creator_address: str = Field(..., description="Wallet address of creator")


class MarketResponse(BaseModel):
    id: int
    chain_market_id: Optional[int]
    question: str
    market_type: int
    data_source: str
    resolution_time: datetime
    created_at: datetime
    creator_address: Optional[str]
    yes_pool: float
    no_pool: float
    status: int
    outcome: Optional[bool]
    oracle_confidence: Optional[float]
    tx_hash: Optional[str]

    class Config:
        from_attributes = True


class BetRequest(BaseModel):
    market_id: int
    is_yes: bool
    amount_eth: float = Field(..., gt=0)
    bettor_address: str


class OracleJobResponse(BaseModel):
    id: int
    market_id: int
    job_type: str
    status: str
    result: Optional[bool]
    confidence: Optional[float]
    raw_output: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class OracleVoteRequest(BaseModel):
    market_id: int
    outcome: bool
    confidence: int = Field(..., ge=0, le=100)


class HealthResponse(BaseModel):
    status: str
    version: str
    chain_id: int

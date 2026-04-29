import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from .models import MarketType


class MarketCreateRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    market_type: MarketType = MarketType.SPEECH_EVENT
    data_source: Optional[str] = Field(
        default=None,
        description="Direct URL, stream, or ipfs:// — required unless auto_discover is true",
    )
    resolution_time: datetime
    creator_address: str = Field(..., description="Wallet address of creator")
    auto_discover: bool = Field(
        default=False,
        description="If true, search the web and use the top result as data_source",
    )
    search_hints: Optional[str] = Field(
        default=None,
        description="Extra keywords to guide web search (names, dates, channel names)",
    )

    @model_validator(mode="after")
    def require_source_or_auto(self) -> "MarketCreateRequest":
        if self.auto_discover:
            return self
        if not self.data_source or not str(self.data_source).strip():
            raise ValueError("data_source is required unless auto_discover is true")
        return self


class DiscoverRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    market_type: int = Field(0, ge=0, le=4)
    search_hints: Optional[str] = None
    max_results: int = Field(8, ge=1, le=20)


class SourceItem(BaseModel):
    url: str
    title: str
    snippet: str
    provider: str


class DiscoverResponse(BaseModel):
    search_query: str
    sources: list[SourceItem]


class UrlPreviewResponse(BaseModel):
    url: str
    title: Optional[str] = None
    text: str
    warning: Optional[str] = None


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


_HEX64 = re.compile(r"^0x[a-fA-F0-9]{64}$")


class MarketChainSyncRequest(BaseModel):
    """Link a DB row to the on-chain market id (and optional deployment tx)."""

    chain_market_id: int = Field(..., ge=0)
    tx_hash: Optional[str] = Field(
        default=None,
        description="Transaction hash of createMarket (hex, 32 bytes).",
    )
    creator_address: str = Field(
        ...,
        min_length=42,
        max_length=42,
        description="Must match markets.creator_address when that field is set.",
    )

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None or str(v).strip() == "":
            return None
        s = v.strip()
        if not _HEX64.match(s):
            raise ValueError("tx_hash must be 66-char 0x-prefixed hex")
        return s


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

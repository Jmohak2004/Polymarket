from enum import IntEnum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Enum,
    Text,
)
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime


class Base(DeclarativeBase):
    pass


class MarketType(IntEnum):
    SPEECH_EVENT = 0
    IMAGE_EVENT = 1
    WEATHER_EVENT = 2
    SOCIAL_MEDIA_EVENT = 3
    CUSTOM = 4


class MarketStatus(IntEnum):
    OPEN = 0
    CLOSED = 1
    RESOLVED = 2
    DISPUTED = 3
    CANCELLED = 4


class MarketDB(Base):
    __tablename__ = "markets"

    id = Column(Integer, primary_key=True, index=True)
    chain_market_id = Column(Integer, unique=True, nullable=True)
    question = Column(String(500), nullable=False)
    market_type = Column(Integer, default=MarketType.SPEECH_EVENT)
    data_source = Column(String(500))
    ipfs_cid = Column(String(100))
    resolution_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    creator_address = Column(String(42))
    yes_pool = Column(Float, default=0.0)
    no_pool = Column(Float, default=0.0)
    status = Column(Integer, default=MarketStatus.OPEN)
    outcome = Column(Boolean, nullable=True)
    oracle_confidence = Column(Float, nullable=True)
    tx_hash = Column(String(66), nullable=True)


class OracleJobDB(Base):
    __tablename__ = "oracle_jobs"

    id = Column(Integer, primary_key=True, index=True)
    market_id = Column(Integer, nullable=False)
    job_type = Column(String(50))  # speech, image, weather, social
    status = Column(String(20), default="pending")  # pending, running, done, failed
    result = Column(Boolean, nullable=True)
    confidence = Column(Float, nullable=True)
    raw_output = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

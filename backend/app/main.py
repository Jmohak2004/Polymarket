from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import check_db_alive, init_db
from .routers import markets, oracle, sources
from .config import settings


def cors_allow_origins() -> list[str]:
    raw = (settings.cors_origins or "").strip()
    if raw:
        return [p.strip() for p in raw.split(",") if p.strip()]
    if settings.app_env == "development":
        return ["*"]
    return []


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Polymarket AI Oracle API",
    description=(
        "Backend for a decentralized prediction market with an AI oracle resolution layer. "
        "Supports speech, image, weather, and social media event markets."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(markets.router)
app.include_router(oracle.router)
app.include_router(sources.router)


@app.get("/health")
async def health():
    """Lightweight liveness probe — does not validate the database."""
    return {
        "status": "ok",
        "version": "0.1.0",
        "chain_id": settings.chain_id,
        "env": settings.app_env,
    }


@app.get("/health/ready")
async def health_ready():
    """Readiness: returns 503 if the primary database cannot be reached."""
    if not await check_db_alive():
        raise HTTPException(status_code=503, detail={"database": "unreachable"})
    return {
        "status": "ok",
        "database": "connected",
        "chain_id": settings.chain_id,
        "env": settings.app_env,
    }

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import markets, oracle, sources
from .config import settings


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
    allow_origins=["*"] if settings.app_env == "development" else ["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(markets.router)
app.include_router(oracle.router)
app.include_router(sources.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "chain_id": settings.chain_id,
        "env": settings.app_env,
    }

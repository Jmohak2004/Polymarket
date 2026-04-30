# PolyOracle — Decentralized Prediction Markets with AI Oracle

A prediction market platform where markets are resolved automatically by a **multi-node AI oracle network**. Bet on real-world events — speeches, images, weather, social media — and let the AI figure out what happened.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  Markets list · Create market · Bet UI · Oracle job monitor  │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│                     Backend (FastAPI)                        │
│  /markets  /sources/discover  /sources/preview               │
│  /oracle/trigger  /oracle/jobs                                │
│                                                              │
│  Oracle Pipelines:                                           │
│    SpeechOracle  → Whisper / AssemblyAI → keyword detect     │
│    ImageOracle   → GPT-4o Vision → yes/no classify           │
│    WeatherOracle → OpenWeatherMap / Tomorrow.io               │
│    SocialOracle  → GPT-4o → event extraction                 │
│                                                              │
│  Chain Indexer (background task):                            │
│    Polls BetPlaced / MarketResolved / MarketDisputed events  │
│    and syncs pool totals + status back to the DB             │
└────────────────────────┬────────────────────────────────────┘
                         │ web3.py (submitVote)
┌────────────────────────▼────────────────────────────────────┐
│               Smart Contracts (Polygon / Base)               │
│                                                              │
│  OracleResolver                                              │
│    - Registers oracle nodes                                  │
│    - Collects votes (outcome + confidence)                   │
│    - Triggers consensus (≥75% agree, quorum met)             │
│    - Calls PredictionMarket.resolveMarket()                  │
│                                                              │
│  PredictionMarket                                            │
│    - createMarket() / placeBet() / claimReward()             │
│    - Proportional payout, 2% platform fee                    │
│    - 24h dispute window after resolution                     │
└─────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
PolyOracle/
├── docker-compose.yml  # PostgreSQL 16 + Redis 7 + optional API container
├── contracts/          # Hardhat + Solidity (TypeScript)
│   ├── contracts/
│   │   ├── PredictionMarket.sol
│   │   ├── OracleResolver.sol
│   │   └── interfaces/
│   ├── scripts/
│   │   ├── deploy.ts          # deploys both contracts + wires them up
│   │   └── post-deploy.sh     # patches backend/.env + frontend/.env.local
│   └── test/PredictionMarket.test.ts
│
├── backend/            # FastAPI (Python)
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py            # FastAPI app + lifespan (starts indexer)
│   │   ├── indexer.py         # on-chain event → DB sync (BetPlaced, MarketResolved)
│   │   ├── routers/           markets.py · oracle.py · sources.py
│   │   ├── sources/           web search + page text extraction
│   │   ├── oracle/            speech · image · weather · social
│   │   ├── blockchain.py      web3.py helpers + submitVote
│   │   ├── models.py
│   │   └── schemas.py
│   └── requirements.txt
│
└── frontend/           # Next.js 15 + Tailwind + wagmi
    └── src/
        ├── app/        page · create · market/[id] · oracle
        ├── components/ Navbar · MarketCard · TxHashLink
        └── lib/        api.ts · wagmi.ts · predictionMarket.ts · chainEnv.ts
```

---

## Full Local Stack — Quick Start

Follow these steps in order. Each section lists the exact env vars you need.

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| Python | ≥ 3.11 |
| Docker Desktop | any recent |

---

### Step 1 — Smart Contracts

```bash
cd contracts
cp .env.example .env
npm install
npm run compile
npm run test          # all tests should pass
```

Start a local Hardhat node in a **separate terminal** and keep it running:

```bash
npm run node
```

Deploy to the local node:

```bash
npm run deploy:local
```

Patch the backend and frontend env files automatically:

```bash
npm run post-deploy:local
```

This writes `PREDICTION_MARKET_ADDRESS` / `ORACLE_RESOLVER_ADDRESS` into `backend/.env`
and `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS` / `NEXT_PUBLIC_CHAIN_ID` into `frontend/.env.local`.

**`contracts/.env` checklist**

| Variable | Required | Notes |
|---|---|---|
| `PRIVATE_KEY` | testnet only | Deployer wallet private key |
| `POLYGON_AMOY_RPC_URL` | testnet only | Alchemy / Infura Amoy endpoint |
| `ORACLE_NODE_ADDRESS` | optional | Registers an oracle node on deploy |

---

### Step 2 — Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# .env was already created by post-deploy.sh — just fill in API keys:
```

**`backend/.env` checklist**

| Variable | Required | Notes |
|---|---|---|
| `PREDICTION_MARKET_ADDRESS` | yes | Set by `post-deploy.sh` |
| `ORACLE_RESOLVER_ADDRESS` | yes | Set by `post-deploy.sh` |
| `ORACLE_PRIVATE_KEY` | yes | Oracle wallet that calls `submitVote` |
| `OPENAI_API_KEY` | for image + social oracles | `sk-…` |
| `ASSEMBLYAI_API_KEY` | for speech oracle | alternative to Whisper |
| `OPENWEATHER_API_KEY` | for weather oracle | |
| `TAVILY_API_KEY` | recommended | Web source search; falls back to DuckDuckGo |
| `DATABASE_URL` | optional | Default: SQLite. See Postgres section below |
| `REDIS_URL` | optional | Default: `redis://localhost:6379/0` |
| `CORS_ORIGINS` | optional | Default: `*` in dev. Set to frontend origin in prod |

Start the API:

```bash
uvicorn app.main:app --reload
# → http://localhost:8000/docs
```

The **chain indexer** starts automatically when `PREDICTION_MARKET_ADDRESS` is set.
It polls `BetPlaced`, `MarketResolved`, and `MarketDisputed` events every 15 s and
syncs pool totals + market status back to the database.

**Health checks**

- `GET /health` — liveness (always 200 if the process is up)
- `GET /health/ready` — readiness; returns **503** if the database is unreachable

---

### Step 3 — Frontend

```bash
cd frontend
# .env.local was already created by post-deploy.sh — review it:
cat .env.local
npm install
npm run dev
# → http://localhost:3000
```

**`frontend/.env.local` checklist**

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Default: `http://localhost:8000` |
| `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS` | yes | Set by `post-deploy.sh` |
| `NEXT_PUBLIC_CHAIN_ID` | yes | `31337` for Hardhat local |
| `NEXT_PUBLIC_CHAIN_EXPLORER` | optional | Block explorer base URL for tx links |
| `NEXT_PUBLIC_SITE_URL` | optional | Used for OG metadata |

---

### Optional — Postgres + Redis via Docker

For a production-like local setup, start the database and cache services:

```bash
# From repo root
docker compose up -d db redis
```

Then set in `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://polymarket:polymarket@localhost:5432/polymarket
REDIS_URL=redis://localhost:6379/0
```

Restart the API — tables are created on startup via `init_db`.

To run the full stack (API + DB + Redis) in Docker:

```bash
docker compose --profile full up -d
```

---

### Testnet Deployment (Polygon Amoy)

```bash
cd contracts
# Fill in PRIVATE_KEY + POLYGON_AMOY_RPC_URL in contracts/.env
npm run deploy:amoy
npm run post-deploy:amoy   # patches backend/.env + frontend/.env.local
```

Update `frontend/.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_CHAIN_EXPLORER=https://amoy.polygonscan.com
```

---

## Web Source Discovery

The backend searches the open web for evidence URLs and extracts page text for the oracle.

| Endpoint | Purpose |
|---|---|
| `POST /sources/discover` | Build a type-aware search query, return ranked `url` / `title` / `snippet` |
| `GET /sources/preview?url=` | Download a URL and return extracted text (trafilatura) |

**Search providers** (configure one or more in `backend/.env`):
`TAVILY_API_KEY` (recommended), `SERPAPI_KEY`, `GOOGLE_CSE_ID` + `GOOGLE_CSE_API_KEY`, `BRAVE_SEARCH_API_KEY`.
If none are set, **DuckDuckGo** HTML search is used (fine for local dev, rate-limited in production).

**Market creation:** set `auto_discover: true` to let the server pick the top search result as `data_source` automatically. The create form also has "Find web sources" to pick a result manually.

---

## Markets API

| Endpoint | Purpose |
|---|---|
| `GET /markets/summary` | Total markets + counts per `status` (for dashboard stats) |
| `GET /markets/?limit=40&offset=0&status_filter=` | Paginated listing (`limit` max 100) |
| `POST /markets/` | Create a market listing (optionally auto-discover source) |
| `GET /markets/{id}` | Fetch a single market |
| `PATCH /markets/{id}/chain-sync` | Link DB row to on-chain market ID after deploy |
| `DELETE /markets/{id}` | Cancel a market (sets status = CANCELLED) |

---

## Smart Contract Design

### PredictionMarket.sol

| Function | Description |
|---|---|
| `createMarket()` | Creates market, pays creation fee to treasury |
| `placeBet(id, isYes)` | Stakes ETH on YES or NO |
| `resolveMarket(id, outcome)` | Called only by OracleResolver |
| `claimReward(id)` | Winners claim proportional payout after dispute window |
| `disputeMarket(id)` | Raise dispute within 24h of resolution |
| `cancelMarket(id)` | Owner cancels unresolved markets |

**Payout formula:**
`payout = userBet / winningPool × (totalPool − platformFee)`

**Constants:** `CREATION_FEE` = 0.001 ETH · `MIN_BET` = 0.001 ETH · `DISPUTE_BOND` = 0.01 ETH · `PLATFORM_FEE_BPS` = 200 (2%)

### OracleResolver.sol

- Multiple oracle nodes vote independently
- Requires **strict majority quorum** before consensus can fire
- Consensus requires **≥75% agreement** among votes cast
- Minimum **60% confidence** per vote
- After consensus → automatically calls `PredictionMarket.resolveMarket()`

---

## Oracle Pipelines

| Type | Input | Model | Logic |
|---|---|---|---|
| Speech | Audio/Video URL | Whisper / AssemblyAI | Transcribe → keyword search |
| Image | Image URL | GPT-4o Vision | Visual yes/no question |
| Weather | Location + threshold | OpenWeatherMap / Tomorrow.io | Compare measured vs threshold |
| Social | News/tweet URL | GPT-4o | Event extraction + NLI |

---

## Chain Indexer

The backend runs a lightweight event indexer as a background asyncio task.
It polls the `PredictionMarket` contract for:

- `BetPlaced` → updates `yes_pool` / `no_pool` in the DB
- `MarketResolved` → sets `status = RESOLVED`, `outcome`
- `MarketDisputed` → sets `status = DISPUTED`

The indexer stores its last-scanned block in an `indexer_state` table so it
resumes correctly after restarts. It is disabled automatically when
`PREDICTION_MARKET_ADDRESS` is not set (e.g. API-only mode).

To run the indexer standalone (useful for debugging):

```bash
cd backend
python -m app.indexer
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solidity 0.8.24, Hardhat, OpenZeppelin |
| Chain | Polygon / Base (low gas) |
| Backend | FastAPI, SQLAlchemy async, web3.py |
| AI | OpenAI Whisper + GPT-4o, AssemblyAI |
| Weather | OpenWeatherMap, Tomorrow.io |
| Frontend | Next.js 15, Tailwind CSS v4, wagmi v2, viem |
| Storage | SQLite (dev) → Postgres (prod), Redis |
| Infra | Docker Compose (db + redis + optional api) |

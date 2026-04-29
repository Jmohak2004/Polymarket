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
Polymarket/
├── docker-compose.yml  # optional local PostgreSQL
├── contracts/          # Hardhat + Solidity (TypeScript)
│   ├── contracts/
│   │   ├── PredictionMarket.sol
│   │   ├── OracleResolver.sol
│   │   └── interfaces/
│   ├── scripts/deploy.ts
│   └── test/PredictionMarket.test.ts
│
├── backend/            # FastAPI (Python)
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/    markets.py · oracle.py · sources.py
│   │   ├── sources/    web search + page text extraction
│   │   ├── oracle/     speech · image · weather · social
│   │   ├── blockchain.py
│   │   ├── models.py
│   │   └── schemas.py
│   └── requirements.txt
│
└── frontend/           # Next.js 15 + Tailwind + wagmi
    └── src/
        ├── app/        page · create · market/[id] · oracle
        ├── components/ Navbar · MarketCard
        └── lib/        api.ts · wagmi.ts
```

## Web source discovery

The backend can **search the open web** for evidence URLs (news, YouTube, transcripts) and **extract main text** from pages for the oracle.

| Endpoint | Purpose |
|---|---|
| `POST /sources/discover` | Build a type-aware search query, return ranked `url` / `title` / `snippet` |
| `GET /sources/preview?url=` | Download a URL and return extracted text (trafilatura) |

**Search providers (configure one or more in `backend/.env`):** `TAVILY_API_KEY` (recommended for agents), `SERPAPI_KEY`, `GOOGLE_CSE_ID` + `GOOGLE_CSE_API_KEY`, `BRAVE_SEARCH_API_KEY`. If none are set, **DuckDuckGo** HTML search is used (fine for local dev, not for production load).

**Market creation:** set `auto_discover: true` to let the server pick the **top search result** as `data_source` automatically. The create form also has “Find web sources” to pick a result manually.

## Quick Start

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env        # fill in keys
npm install
npm run compile
npm run test                # 15/15 tests pass
npm run node                # local Hardhat node
npm run deploy:local        # deploy to localhost
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in API keys + contract addresses
uvicorn app.main:app --reload
# → http://localhost:8000/docs
```

**Health checks**

- `GET /health` — process liveness (always 200 if the server is up; does not ping the database).
- `GET /health/ready` — readiness for load balancers; returns **503** if the database cannot be reached.

**Postgres (optional, for production-like local dev)**

```bash
# From repo root — starts PostgreSQL 16 on port 5432
docker compose up -d db
```

Set in `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://polymarket:polymarket@localhost:5432/polymarket
```

Then start the API as above (tables are created on startup via `init_db`).

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL
npm install
npm run dev
# → http://localhost:3000
```

**Markets listing**

| Endpoint | Purpose |
|---|---|
| `GET /markets/summary` | Total markets + counts per `status` (for dashboard stats) |
| `GET /markets/?limit=40&offset=0&status_filter=` | Paginated listing (`limit` max 100) |

## Smart Contract Design

### PredictionMarket.sol

| Function | Description |
|---|---|
| `createMarket()` | Creates market, pays creation fee to treasury |
| `placeBet(id, isYes)` | Stakes ETH on YES or NO |
| `resolveMarket(id, outcome)` | Called only by OracleResolver |
| `claimReward(id)` | Winners claim proportional payout after dispute window |
| `disputeMarket(id)` | Raise dispute within 24h of resolution |

**Payout formula:**  
`payout = userBet / winningPool * (totalPool - platformFee)`

### OracleResolver.sol

- Multiple oracle nodes vote independently  
- Requires **strict majority quorum** before consensus can fire  
- Consensus requires **≥75% agreement** among votes cast  
- Minimum **60% confidence** per vote  
- After consensus → automatically calls `PredictionMarket.resolveMarket()`

## Oracle Pipelines

| Type | Input | Model | Logic |
|---|---|---|---|
| Speech | Audio/Video URL | Whisper / AssemblyAI | Transcribe → keyword search |
| Image | Image URL | GPT-4o Vision | Visual yes/no question |
| Weather | Location + threshold | OpenWeatherMap / Tomorrow.io | Compare measured vs threshold |
| Social | News/tweet URL | GPT-4o | Event extraction + NLI |

## Deployment

Deploy to **Polygon Amoy** testnet:

```bash
cd contracts
npm run deploy:amoy
```

Set the deployed contract addresses in `backend/.env` and `frontend/.env.local`.

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Solidity 0.8.24, Hardhat, OpenZeppelin |
| Chain | Polygon / Base (low gas) |
| Backend | FastAPI, SQLAlchemy, web3.py |
| AI | OpenAI Whisper + GPT-4o, AssemblyAI |
| Weather | OpenWeatherMap, Tomorrow.io |
| Frontend | Next.js 15, Tailwind CSS, wagmi v2, viem |
| Storage | IPFS / Arweave (metadata), SQLite → Postgres |

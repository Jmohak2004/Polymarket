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
│  /markets  /oracle/trigger  /oracle/jobs                     │
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
│   │   ├── routers/    markets.py · oracle.py
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

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL
npm install
npm run dev
# → http://localhost:3000
```

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

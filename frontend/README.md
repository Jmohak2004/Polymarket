# PolyOracle frontend

The frontend supports two modes:

- **Demo mode:** leave `NEXT_PUBLIC_API_URL` empty. The app ships with illustrative markets and a browser-local virtual wallet, portfolio, watchlist, trade history, and market creator. No real money is used and demo markets do not settle automatically.
- **Connected mode:** set `NEXT_PUBLIC_API_URL`, the chain ID, and the deployed contract address. Browsing uses FastAPI and transactions are approved in the visitor's wallet.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3005`. To use connected mode, copy `.env.example` to `.env.local` and configure the API and contract values.

## Validate

```bash
npx tsc --noEmit
npm run build
```

The default build produces a standalone Next.js server. A static demo bundle can be generated with:

```bash
STATIC_EXPORT=true npm run build
```

The static output is written to `out/`.

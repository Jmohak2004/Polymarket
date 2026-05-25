#!/usr/bin/env bash
# post-deploy.sh — reads the latest deployment JSON and patches .env files.
#
# Usage (after `npm run deploy:local` or `npm run deploy:amoy`):
#   bash scripts/post-deploy.sh <chainId>
#
# Example:
#   bash scripts/post-deploy.sh 31337          # Hardhat local
#   bash scripts/post-deploy.sh 80002          # Polygon Amoy
#
# The script writes:
#   ../backend/.env          — PREDICTION_MARKET_ADDRESS, ORACLE_RESOLVER_ADDRESS
#   ../frontend/.env.local   — NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS, NEXT_PUBLIC_CHAIN_ID

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CONTRACTS_ROOT}/.." && pwd)"

CHAIN_ID="${1:-31337}"
DEPLOY_FILE="${CONTRACTS_ROOT}/deployments/${CHAIN_ID}.json"

if [ ! -f "$DEPLOY_FILE" ]; then
  echo "❌  Deployment file not found: $DEPLOY_FILE"
  echo "    Run 'npm run deploy:local' (or deploy:amoy) first."
  exit 1
fi

PM_ADDR="$(node -e "const d=require(process.argv[1]); console.log(d.contracts.PredictionMarket)" "$DEPLOY_FILE")"
OR_ADDR="$(node -e "const d=require(process.argv[1]); console.log(d.contracts.OracleResolver)" "$DEPLOY_FILE")"

echo "📄  Deployment: $DEPLOY_FILE"
echo "    PredictionMarket : $PM_ADDR"
echo "    OracleResolver   : $OR_ADDR"
echo "    Chain ID         : $CHAIN_ID"

# ── Backend .env ──────────────────────────────────────────────────────────────
BACKEND_ENV="${REPO_ROOT}/backend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
  cp "${REPO_ROOT}/backend/.env.example" "$BACKEND_ENV"
  echo "    Created $BACKEND_ENV from .env.example"
fi

_upsert() {
  local file="$1" key="$2" val="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file" && rm -f "${file}.bak"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

_upsert "$BACKEND_ENV" "PREDICTION_MARKET_ADDRESS" "$PM_ADDR"
_upsert "$BACKEND_ENV" "ORACLE_RESOLVER_ADDRESS"   "$OR_ADDR"
_upsert "$BACKEND_ENV" "CHAIN_ID"                  "$CHAIN_ID"
_upsert "$BACKEND_ENV" "RPC_URL"                   "http://127.0.0.1:8545"

if [ "$CHAIN_ID" = "31337" ]; then
  # Hardhat account #0 — matches `hardhat node` default funded wallet
  _upsert "$BACKEND_ENV" "ORACLE_PRIVATE_KEY" "0xac0974bec39a17e36ba4a6ba40d6901b6711aed4ebbe0da16f1ab0b5af6a8e2"
fi

echo "    ✅  Updated $BACKEND_ENV"

# ── Frontend .env.local ───────────────────────────────────────────────────────
FRONTEND_ENV="${REPO_ROOT}/frontend/.env.local"

if [ ! -f "$FRONTEND_ENV" ]; then
  cp "${REPO_ROOT}/frontend/.env.example" "$FRONTEND_ENV"
  echo "    Created $FRONTEND_ENV from .env.example"
fi

_upsert "$FRONTEND_ENV" "NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS" "$PM_ADDR"
_upsert "$FRONTEND_ENV" "NEXT_PUBLIC_CHAIN_ID"                  "$CHAIN_ID"
_upsert "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL"                   "http://localhost:8000"
echo "    ✅  Updated $FRONTEND_ENV"

echo ""
echo "✅  Done. Restart the backend and frontend to pick up the new addresses."

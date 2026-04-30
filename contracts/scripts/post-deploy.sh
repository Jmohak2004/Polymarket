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

CHAIN_ID="${1:-31337}"
DEPLOY_FILE="$(dirname "$0")/../deployments/${CHAIN_ID}.json"

if [ ! -f "$DEPLOY_FILE" ]; then
  echo "❌  Deployment file not found: $DEPLOY_FILE"
  echo "    Run 'npm run deploy:local' (or deploy:amoy) first."
  exit 1
fi

PM_ADDR=$(node -e "const d=require('$DEPLOY_FILE'); console.log(d.contracts.PredictionMarket)")
OR_ADDR=$(node -e "const d=require('$DEPLOY_FILE'); console.log(d.contracts.OracleResolver)")

echo "📄  Deployment: $DEPLOY_FILE"
echo "    PredictionMarket : $PM_ADDR"
echo "    OracleResolver   : $OR_ADDR"
echo "    Chain ID         : $CHAIN_ID"

# ── Backend .env ──────────────────────────────────────────────────────────────
BACKEND_ENV="$(dirname "$0")/../../backend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
  cp "$(dirname "$0")/../../backend/.env.example" "$BACKEND_ENV"
  echo "    Created $BACKEND_ENV from .env.example"
fi

_upsert() {
  local file="$1" key="$2" val="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # Replace existing line (macOS + Linux compatible)
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file" && rm -f "${file}.bak"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

_upsert "$BACKEND_ENV" "PREDICTION_MARKET_ADDRESS" "$PM_ADDR"
_upsert "$BACKEND_ENV" "ORACLE_RESOLVER_ADDRESS"   "$OR_ADDR"
_upsert "$BACKEND_ENV" "CHAIN_ID"                  "$CHAIN_ID"
echo "    ✅  Updated $BACKEND_ENV"

# ── Frontend .env.local ───────────────────────────────────────────────────────
FRONTEND_ENV="$(dirname "$0")/../../frontend/.env.local"

if [ ! -f "$FRONTEND_ENV" ]; then
  cp "$(dirname "$0")/../../frontend/.env.example" "$FRONTEND_ENV"
  echo "    Created $FRONTEND_ENV from .env.example"
fi

_upsert "$FRONTEND_ENV" "NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS" "$PM_ADDR"
_upsert "$FRONTEND_ENV" "NEXT_PUBLIC_CHAIN_ID"                  "$CHAIN_ID"
echo "    ✅  Updated $FRONTEND_ENV"

echo ""
echo "✅  Done. Restart the backend and frontend to pick up the new addresses."

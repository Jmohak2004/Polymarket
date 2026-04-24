"""
Thin Web3 wrapper for interacting with PredictionMarket and OracleResolver contracts.
ABIs are loaded from the compiled Hardhat artifacts.
"""
import json
import os
from pathlib import Path
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from .config import settings

ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "contracts" / "artifacts" / "contracts"


def _load_abi(contract_name: str) -> list:
    artifact_path = ARTIFACTS_DIR / f"{contract_name}.sol" / f"{contract_name}.json"
    with open(artifact_path) as f:
        return json.load(f)["abi"]


def get_web3() -> Web3:
    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    # PoA middleware for Polygon / testnet
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return w3


def get_prediction_market_contract(w3: Web3):
    if not settings.prediction_market_address:
        raise RuntimeError("PREDICTION_MARKET_ADDRESS not set")
    abi = _load_abi("PredictionMarket")
    return w3.eth.contract(
        address=Web3.to_checksum_address(settings.prediction_market_address),
        abi=abi,
    )


def get_oracle_resolver_contract(w3: Web3):
    if not settings.oracle_resolver_address:
        raise RuntimeError("ORACLE_RESOLVER_ADDRESS not set")
    abi = _load_abi("OracleResolver")
    return w3.eth.contract(
        address=Web3.to_checksum_address(settings.oracle_resolver_address),
        abi=abi,
    )


def sign_and_send(w3: Web3, tx: dict) -> str:
    """Sign a transaction with the oracle's private key and broadcast it."""
    signed = w3.eth.account.sign_transaction(tx, private_key=settings.oracle_private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt["status"] != 1:
        raise RuntimeError(f"Transaction reverted: {tx_hash.hex()}")
    return tx_hash.hex()


def submit_oracle_vote(market_id: int, outcome: bool, confidence: int) -> str:
    """Submit a vote to OracleResolver from the oracle wallet."""
    w3 = get_web3()
    contract = get_oracle_resolver_contract(w3)
    oracle_address = w3.eth.account.from_key(settings.oracle_private_key).address

    tx = contract.functions.submitVote(market_id, outcome, confidence).build_transaction({
        "from": oracle_address,
        "nonce": w3.eth.get_transaction_count(oracle_address),
        "gas": 200_000,
        "gasPrice": w3.eth.gas_price,
    })
    return sign_and_send(w3, tx)

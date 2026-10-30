import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_DOWN, Decimal

from stellar_sdk import Asset, Keypair, Network, Server, TransactionBuilder

TESTNET_PASSPHRASE = Network.TESTNET_NETWORK_PASSPHRASE
STROOP = Decimal("0.0000001")


class StellarPaymentNotFound(Exception):
    pass


class StellarServiceUnavailable(Exception):
    pass


@dataclass(frozen=True)
class StellarPaymentProof:
    transaction_hash: str
    operation_id: str
    source_account: str
    destination_account: str
    amount_xlm: Decimal
    memo: str
    ledger: int
    confirmed_at: datetime | None = None


def validate_public_key(value: str) -> str:
    try:
        return Keypair.from_public_key(value.strip()).public_key
    except Exception as error:
        raise ValueError("Enter a valid Stellar G... public account") from error


def generate_receiving_account() -> str:
    """Create a public-only testnet receiving account without retaining a secret key."""
    return Keypair.random().public_key


def demo_xlm_amount(amount_ugx: Decimal, ugx_per_xlm: Decimal) -> Decimal:
    result = (amount_ugx / ugx_per_xlm).quantize(STROOP, rounding=ROUND_DOWN)
    if result <= 0:
        raise ValueError("Amount is too small for the testnet demonstration")
    return result


def format_xlm(value: Decimal) -> str:
    return f"{value:.7f}"


def payment_uri(*, destination: str, amount: Decimal, memo: str) -> str:
    query = urllib.parse.urlencode(
        {
            "destination": destination,
            "amount": format_xlm(amount),
            "memo": memo,
            "memo_type": "MEMO_TEXT",
            "msg": "HarambeeOne testnet demonstration - no real monetary value",
            "network_passphrase": TESTNET_PASSPHRASE,
        }
    )
    return f"web+stellar:pay?{query}"


def _json(url: str) -> dict:
    try:
        request = urllib.request.Request(
            url,
            headers={"Accept": "application/json", "User-Agent": "HarambeeOne-Testnet-Demo/1.0"},
        )
        with urllib.request.urlopen(request, timeout=12) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            raise StellarPaymentNotFound from error
        raise StellarServiceUnavailable("Stellar testnet rejected the request") from error
    except (OSError, ValueError) as error:
        raise StellarServiceUnavailable("Stellar testnet is temporarily unavailable") from error


def verify_transaction(
    *, horizon_url: str, transaction_hash: str, destination: str, memo: str, amount: Decimal
) -> StellarPaymentProof:
    if not re.fullmatch(r"[0-9a-fA-F]{64}", transaction_hash):
        raise StellarPaymentNotFound
    base = horizon_url.rstrip("/")
    transaction = _json(f"{base}/transactions/{transaction_hash.lower()}")
    if not transaction.get("successful"):
        raise StellarPaymentNotFound
    if transaction.get("memo_type") != "text" or transaction.get("memo") != memo:
        raise StellarPaymentNotFound
    operations = _json(
        f"{base}/transactions/{transaction_hash.lower()}/operations?limit=200"
    ).get("_embedded", {}).get("records", [])
    for operation in operations:
        if (
            operation.get("type") == "payment"
            and operation.get("asset_type") == "native"
            and operation.get("to") == destination
            and Decimal(operation.get("amount", "0")) == amount
            and operation.get("transaction_successful", True)
        ):
            return StellarPaymentProof(
                transaction_hash=transaction_hash.lower(),
                operation_id=str(operation.get("id", "")),
                source_account=str(operation.get("from", "")),
                destination_account=destination,
                amount_xlm=amount,
                memo=memo,
                ledger=int(transaction["ledger"]),
            )
    raise StellarPaymentNotFound


def find_payment(
    *, horizon_url: str, destination: str, memo: str, amount: Decimal
) -> StellarPaymentProof:
    encoded = urllib.parse.quote(destination, safe="")
    records = _json(
        f"{horizon_url.rstrip('/')}/accounts/{encoded}/payments?order=desc&limit=200&include_failed=false"
    ).get("_embedded", {}).get("records", [])
    for operation in records:
        if (
            operation.get("type") == "payment"
            and operation.get("asset_type") == "native"
            and operation.get("to") == destination
            and Decimal(operation.get("amount", "0")) == amount
        ):
            try:
                return verify_transaction(
                    horizon_url=horizon_url,
                    transaction_hash=operation["transaction_hash"],
                    destination=destination,
                    memo=memo,
                    amount=amount,
                )
            except StellarPaymentNotFound:
                continue
    raise StellarPaymentNotFound


def submit_demo_payment(
    *, horizon_url: str, destination: str, memo: str, amount: Decimal
) -> str:
    source = Keypair.random()
    _json(f"https://friendbot.stellar.org/?addr={urllib.parse.quote(source.public_key)}")
    try:
        _json(f"{horizon_url.rstrip('/')}/accounts/{urllib.parse.quote(destination)}")
    except StellarPaymentNotFound:
        _json(f"https://friendbot.stellar.org/?addr={urllib.parse.quote(destination)}")
    server = Server(horizon_url=horizon_url)
    transaction = (
        TransactionBuilder(
            source_account=server.load_account(source.public_key),
            network_passphrase=TESTNET_PASSPHRASE,
            base_fee=server.fetch_base_fee(),
        )
        .add_text_memo(memo)
        .append_payment_op(destination, Asset.native(), format_xlm(amount))
        .set_timeout(30)
        .build()
    )
    transaction.sign(source)
    response = server.submit_transaction(transaction)
    return str(response["hash"])

#!/usr/bin/env python3
"""Small, secret-safe client for the SellerSprite endpoints used by this skill."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


BASE_URL = "https://api.sellersprite.com"
ASIN_PATTERN = re.compile(r"^[A-Z0-9]{10}$")


class SellerSpriteAPIError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


def validate_asin(value: str) -> str:
    asin = value.strip().upper()
    if not ASIN_PATTERN.fullmatch(asin):
        raise ValueError("ASIN must contain exactly 10 letters or digits")
    return asin


def _headers(secret: str) -> dict[str, str]:
    if not secret:
        raise ValueError("SellerSprite secret is not configured")
    return {
        "secret-key": secret,
        "Content-Type": "application/json;charset=utf-8",
        "x-request-id": str(uuid.uuid4()),
    }


def build_request(
    *,
    command: str,
    secret: str,
    marketplace: str = "US",
    asin: str | None = None,
    page: int = 1,
    size: int = 50,
    month: str | None = None,
    reverse_type: str = "W",
    date: str | None = None,
    stars: list[int] | None = None,
) -> tuple[Request, dict[str, Any]]:
    market = marketplace.strip().upper()
    body: dict[str, Any] | None = None
    method = "GET"

    if command == "visits":
        url = f"{BASE_URL}/v1/visits"
    else:
        if asin is None:
            raise ValueError(f"ASIN is required for {command}")
        clean_asin = validate_asin(asin)
        if command == "asin-detail":
            url = f"{BASE_URL}/v1/asin/{quote(market)}/{quote(clean_asin)}"
        elif command == "traffic-keywords":
            if not 1 <= size <= 100:
                raise ValueError("traffic keyword size must be between 1 and 100")
            url = f"{BASE_URL}/v1/traffic/keyword"
            method = "POST"
            body = {"marketplace": market, "asin": clean_asin, "page": page, "size": size}
            if month:
                body["month"] = month
        elif command == "order-keywords":
            if reverse_type not in {"W", "M"}:
                raise ValueError("reverse_type must be W or M")
            url = f"{BASE_URL}/v1/keyword-order"
            method = "POST"
            body = {
                "marketplace": market,
                "asins": [clean_asin],
                "reverseType": reverse_type,
                "page": page,
                "size": 50,
            }
            if date:
                body["date"] = date
        elif command == "reviews":
            if not 1 <= size <= 10:
                raise ValueError("review size must be between 1 and 10")
            url = f"{BASE_URL}/v1/review"
            method = "POST"
            body = {"marketplace": market, "asin": clean_asin, "page": page, "size": size}
            if stars:
                body["starList"] = stars
        else:
            raise ValueError(f"Unsupported command: {command}")

    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(url, data=data, headers=_headers(secret), method=method)
    safe_summary = {
        "command": command,
        "method": method,
        "url": url,
        "body": body,
        "authenticated": True,
    }
    return request, safe_summary


def interpret_response(payload: dict[str, Any]) -> Any:
    if not isinstance(payload, dict):
        raise SellerSpriteAPIError(
            "ERROR_PROTOCOL",
            "SellerSprite returned a non-object JSON response",
        )
    code = str(payload.get("code", "ERROR_UNKNOWN"))
    if code != "OK":
        raise SellerSpriteAPIError(code, str(payload.get("message", "SellerSprite request failed")))
    return payload.get("data")


def execute(request: Request, *, timeout: int = 30) -> Any:
    try:
        with urlopen(request, timeout=timeout) as response:
            try:
                payload = json.load(response)
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                raise SellerSpriteAPIError(
                    "ERROR_PROTOCOL",
                    "SellerSprite returned malformed JSON",
                ) from exc
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise SellerSpriteAPIError("ERROR_HTTP", f"HTTP {exc.code}") from exc
        return interpret_response(payload)
    except SellerSpriteAPIError:
        raise
    except (URLError, TimeoutError, OSError) as exc:
        reason = getattr(exc, "reason", str(exc))
        raise SellerSpriteAPIError("ERROR_NETWORK", str(reason)) from exc
    return interpret_response(payload)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=("visits", "asin-detail", "traffic-keywords", "order-keywords", "reviews"),
    )
    parser.add_argument("--marketplace", default="US")
    parser.add_argument("--asin")
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--size", type=int)
    parser.add_argument("--month")
    parser.add_argument("--reverse-type", choices=("W", "M"), default="W")
    parser.add_argument("--date")
    parser.add_argument("--stars", type=int, nargs="*")
    parser.add_argument("--timeout", type=int, default=30)
    return parser


def main() -> int:
    args = _parser().parse_args()
    secret = os.environ.get("SELLERSPRITE_SECRET_KEY", "")
    size = args.size if args.size is not None else (10 if args.command == "reviews" else 50)
    try:
        request, _ = build_request(
            command=args.command,
            secret=secret,
            marketplace=args.marketplace,
            asin=args.asin,
            page=args.page,
            size=size,
            month=args.month,
            reverse_type=args.reverse_type,
            date=args.date,
            stars=args.stars,
        )
        result = execute(request, timeout=args.timeout)
    except (ValueError, SellerSpriteAPIError) as exc:
        if isinstance(exc, SellerSpriteAPIError):
            message = exc.message.replace(secret, "[REDACTED]") if secret else exc.message
            error = {"code": exc.code, "message": message, "fallback": "logged-in-web-page"}
        else:
            error = {"code": "ERROR_CONFIG", "message": str(exc), "fallback": "logged-in-web-page"}
        print(json.dumps(error, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

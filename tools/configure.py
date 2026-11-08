#!/usr/bin/env python3
"""Create a hosted CINE MARKS configuration from the bundled relative JSON."""

from __future__ import annotations

import argparse
import copy
import ipaddress
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit, urlunsplit


SAFE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*\Z")
SAFE_HOST_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\Z")


def validate_base_url(value: str) -> str:
    """Return a normalized HTTPS base URL without credentials or traversal."""
    if not value or any(ord(char) <= 32 or ord(char) == 127 for char in value):
        raise ValueError("base URL must not contain whitespace or control characters")
    if any(char in value for char in "\\?#"):
        raise ValueError("base URL must not contain backslashes, a query, or a fragment")
    if re.search(r"%(?![0-9A-Fa-f]{2})", value):
        raise ValueError("base URL contains invalid percent encoding")

    try:
        parts = urlsplit(value)
        host = parts.hostname
        port = parts.port
    except ValueError as exc:
        raise ValueError("base URL is not a valid absolute HTTPS URL") from exc
    if parts.scheme.lower() != "https" or not host or not parts.netloc:
        raise ValueError("base URL must be an absolute HTTPS URL")
    if parts.username is not None or parts.password is not None:
        raise ValueError("base URL must not include a username or password")
    if "@" in parts.netloc or "%" in parts.netloc:
        raise ValueError("base URL contains an invalid authority")
    if port is not None and not 1 <= port <= 65535:
        raise ValueError("base URL port must be between 1 and 65535")

    try:
        ipaddress.ip_address(host)
    except ValueError:
        try:
            ascii_host = host.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise ValueError("base URL hostname is invalid") from exc
        if len(ascii_host) > 253 or not all(
            SAFE_HOST_LABEL.fullmatch(label) for label in ascii_host.split(".")
        ):
            raise ValueError("base URL hostname is invalid")
    else:
        ascii_host = host

    decoded_path = parts.path
    # Inspect repeated encodings so encoded slashes or dots cannot conceal traversal.
    for _ in range(len(parts.path) + 1):
        if "\\" in decoded_path or any(
            ord(char) < 32 or ord(char) == 127 for char in decoded_path
        ):
            raise ValueError("base URL path contains invalid characters")
        if any(segment in (".", "..") for segment in decoded_path.split("/")):
            raise ValueError("base URL path must not contain dot segments")
        next_path = unquote(decoded_path)
        if next_path == decoded_path:
            break
        decoded_path = next_path

    authority = f"[{ascii_host}]" if ":" in ascii_host else ascii_host
    if port is not None:
        authority += f":{port}"
    return urlunsplit(("https", authority, parts.path.rstrip("/"), "", ""))


def build_config(source: dict, base_url: str) -> dict:
    """Preserve every source field except each filter's imageURL."""
    if not isinstance(source, dict) or not isinstance(source.get("filters"), list):
        raise ValueError("source JSON must be an object containing a filters array")
    normalized_base = validate_base_url(base_url)
    result = copy.deepcopy(source)
    seen = set()
    for index, item in enumerate(result["filters"]):
        if not isinstance(item, dict):
            raise ValueError(f"filter {index} must be an object")
        badge_id = item.get("id")
        if not isinstance(badge_id, str) or not SAFE_ID.fullmatch(badge_id):
            raise ValueError(f"filter {index} has an unsafe or missing id")
        if badge_id in seen:
            raise ValueError(f"filter {index} has a duplicate id")
        seen.add(badge_id)
        relative_path = f"badges/png/{badge_id}.png"
        if item.get("imageURL") != relative_path:
            raise ValueError(f"filter {index} imageURL does not match its safe PNG path")
        item["imageURL"] = f"{normalized_base}/{relative_path}"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a hosted HTTPS PNG configuration; no files are uploaded."
    )
    parser.add_argument("--base-url", required=True, help="Public HTTPS URL of the cine-marks folder")
    parser.add_argument("--output", required=True, type=Path, help="New JSON output path; existing files are not overwritten")
    args = parser.parse_args()
    source_path = Path(__file__).resolve().parent.parent / "badges.relative.json"
    try:
        output_path = args.output.expanduser().resolve()
        if output_path == source_path.resolve():
            raise ValueError("output must not replace badges.relative.json")
        source = json.loads(source_path.read_text(encoding="utf-8"))
        result = build_config(source, args.base_url)
        encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        # Exclusive creation protects both bundled configurations and prior exports.
        with output_path.open("x", encoding="utf-8", newline="\n") as output:
            output.write(encoded)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(f"Created {output_path} ({len(result['filters'])} filters). No files were uploaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

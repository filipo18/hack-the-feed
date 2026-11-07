"""One POST helper. Timeouts stay on the client. There is no retry loop."""

from __future__ import annotations

import httpx


class ProviderCallError(Exception):
    """Network failure. The message is safe to show; it has no credentials."""


def post_json(
    url: str,
    body: dict,
    headers: dict[str, str],
    timeout_seconds: float,
) -> tuple[int, object | None]:
    timeout = httpx.Timeout(timeout_seconds, connect=min(5.0, timeout_seconds))
    try:
        with httpx.Client(timeout=timeout) as client:
            # Default User-Agent is python-httpx/<version>. It is not replaced.
            response = client.post(url, json=body, headers=headers)
    except httpx.TimeoutException as exc:
        raise ProviderCallError("provider timed out") from exc
    except httpx.HTTPError as exc:
        raise ProviderCallError("provider connection failed") from exc
    try:
        payload = response.json()
    except ValueError:
        payload = None
    return response.status_code, payload


def provider_http_note(who: str, status: int, payload: object | None) -> str:
    """Status and a numeric provider code only. Response text is not copied."""
    code = _provider_code(payload)
    note = f"{who} returned HTTP {status}."
    if code is not None:
        note += f" Provider code {code}."
    if payload is None:
        note += " Body was not JSON."
    note += " Nothing was ranked from that response."
    return note


def _provider_code(payload: object | None) -> int | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get("code")
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    error = payload.get("error")
    if isinstance(error, dict):
        nested = error.get("code")
        if isinstance(nested, int) and not isinstance(nested, bool):
            return nested
    return None

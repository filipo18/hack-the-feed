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

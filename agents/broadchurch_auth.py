"""
Broadchurch agent auth — handles Elemental API config and authentication.

Lives at agents/broadchurch_auth.py and is automatically copied into each
agent directory at deploy time. During local dev (adk web from agents/),
it's importable directly since agents/ is on sys.path.

Usage in your agent code:

    try:
        from broadchurch_auth import elemental_client
    except ImportError:
        from .broadchurch_auth import elemental_client

    def my_tool() -> dict:
        resp = elemental_client.get("/elemental/metadata/schema")
        resp.raise_for_status()
        return resp.json()

Local dev:  set ELEMENTAL_API_URL and ELEMENTAL_API_TOKEN env vars.
Production: reads broadchurch.yaml (bundled at deploy) and mints GCP ID tokens.
"""

import os
import time
from pathlib import Path

import httpx
import yaml

_config_cache: dict | None = None
_token_cache: dict = {"token": None, "expires_at": 0.0}


def _load_config() -> dict:
    global _config_cache
    if _config_cache is not None:
        return _config_cache

    for candidate in [
        Path("broadchurch.yaml"),
        Path(__file__).parent / "broadchurch.yaml",
    ]:
        if candidate.exists():
            with open(candidate) as f:
                _config_cache = yaml.safe_load(f) or {}
                return _config_cache

    _config_cache = {}
    return _config_cache


def get_elemental_url() -> str:
    """Return the Elemental API base URL (no trailing slash)."""
    url = os.environ.get("ELEMENTAL_API_URL")
    if url:
        return url.rstrip("/")

    config = _load_config()
    url = config.get("query_server", {}).get("url", "https://stable-query.lovelace.ai")
    return url.rstrip("/")


def get_elemental_token() -> str:
    """Return a valid bearer token for the Elemental API.

    Local dev:   uses ELEMENTAL_API_TOKEN env var.
    Production:  mints a GCP ID token for the audience in broadchurch.yaml.
    """
    static = os.environ.get("ELEMENTAL_API_TOKEN")
    if static:
        return static

    now = time.time()
    if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["token"]

    config = _load_config()
    audience = config.get("query_server", {}).get("audience", "queryserver:api")

    try:
        import google.auth.transport.requests
        import google.oauth2.id_token

        request = google.auth.transport.requests.Request()
        token = google.oauth2.id_token.fetch_id_token(request, audience)
    except Exception as e:
        raise RuntimeError(
            f"Failed to mint ID token for audience '{audience}'. "
            f"Set ELEMENTAL_API_TOKEN for local dev. Error: {e}"
        ) from e

    _token_cache["token"] = token
    _token_cache["expires_at"] = now + 3500
    return token


def get_auth_headers() -> dict[str, str]:
    """Return Authorization + Content-Type headers for Elemental API calls."""
    return {
        "Authorization": f"Bearer {get_elemental_token()}",
        "Content-Type": "application/x-www-form-urlencoded",
    }


class _ElementalClient:
    """Thin wrapper around httpx that injects auth and the base URL."""

    def __init__(self, timeout: float = 30.0):
        self._timeout = timeout

    @property
    def base_url(self) -> str:
        return get_elemental_url()

    def get(self, path: str, **kwargs) -> httpx.Response:
        kwargs.setdefault("timeout", self._timeout)
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {get_elemental_token()}"
        return httpx.get(f"{self.base_url}{path}", headers=headers, **kwargs)

    def post(self, path: str, **kwargs) -> httpx.Response:
        kwargs.setdefault("timeout", self._timeout)
        headers = kwargs.pop("headers", {})
        headers.update(get_auth_headers())
        return httpx.post(f"{self.base_url}{path}", headers=headers, **kwargs)


elemental_client = _ElementalClient()

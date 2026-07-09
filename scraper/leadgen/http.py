"""Polite HTTP session: identifies itself, rate-limits per host, retries."""

from __future__ import annotations

import logging
import time
from urllib.parse import urlsplit

import requests

log = logging.getLogger(__name__)

USER_AGENT = (
    "leadgen-contractor-scraper/1.0 "
    "(public-records research; contact: caspatore@gmail.com)"
)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class PoliteSession:
    """Wraps ``requests.Session`` with a minimum delay between requests to
    the same host and exponential-backoff retries."""

    def __init__(
        self,
        min_delay_seconds: float = 2.0,
        timeout: float = 30.0,
        max_retries: int = 3,
    ) -> None:
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.min_delay = min_delay_seconds
        self.timeout = timeout
        self.max_retries = max_retries
        self._last_request_at: dict[str, float] = {}

    def _throttle(self, url: str) -> None:
        host = urlsplit(url).netloc
        last = self._last_request_at.get(host)
        if last is not None:
            wait = self.min_delay - (time.monotonic() - last)
            if wait > 0:
                time.sleep(wait)
        self._last_request_at[host] = time.monotonic()

    def request(self, method: str, url: str, **kwargs) -> requests.Response:
        kwargs.setdefault("timeout", self.timeout)
        backoff = 2.0
        for attempt in range(1, self.max_retries + 1):
            self._throttle(url)
            try:
                resp = self.session.request(method, url, **kwargs)
            except requests.RequestException as exc:
                if attempt == self.max_retries:
                    raise
                log.warning("%s %s failed (%s); retry %d/%d in %.0fs",
                            method, url, exc, attempt, self.max_retries,
                            backoff)
            else:
                if resp.status_code not in RETRYABLE_STATUS:
                    resp.raise_for_status()
                    return resp
                if attempt == self.max_retries:
                    resp.raise_for_status()
                log.warning("%s %s -> HTTP %d; retry %d/%d in %.0fs",
                            method, url, resp.status_code, attempt,
                            self.max_retries, backoff)
            time.sleep(backoff)
            backoff *= 2
        raise RuntimeError("unreachable")

    def get(self, url: str, **kwargs) -> requests.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> requests.Response:
        return self.request("POST", url, **kwargs)

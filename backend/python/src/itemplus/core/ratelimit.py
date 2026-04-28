"""Simple in-memory rate limiter."""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Sliding window rate limiter per IP.

    Usage as a FastAPI dependency:
        Depends(RateLimiter(max_requests=5, window_seconds=60))
    """

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, respecting X-Forwarded-For behind a proxy."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _cleanup(self, ip: str, now: float) -> None:
        """Remove timestamps outside the current window."""
        cutoff = now - self.window_seconds
        timestamps = self._requests[ip]
        # Find first timestamp within window
        idx = 0
        while idx < len(timestamps) and timestamps[idx] < cutoff:
            idx += 1
        if idx > 0:
            self._requests[ip] = timestamps[idx:]
        # Remove empty entries to prevent memory leak
        if not self._requests[ip]:
            del self._requests[ip]

    async def __call__(self, request: Request) -> None:
        """Check rate limit — raises 429 if exceeded."""
        ip = self._get_client_ip(request)
        now = time.monotonic()

        self._cleanup(ip, now)

        timestamps = self._requests.get(ip, [])
        if len(timestamps) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Max {self.max_requests} requests per {self.window_seconds}s.",
            )

        self._requests[ip].append(now)

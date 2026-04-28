"""Apple Sign-In token verification."""

import jwt
from httpx import AsyncClient

from itemplus.core.config import settings

APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"


async def verify_apple_token(identity_token: str) -> dict:
    """Verify an Apple identity token and return the decoded payload.

    Returns dict with 'sub' (Apple user ID), 'email', etc.
    """
    # Fetch Apple's public keys
    async with AsyncClient() as client:
        resp = await client.get(APPLE_KEYS_URL)
        resp.raise_for_status()
        apple_keys = resp.json()

    # Decode header to find the right key
    header = jwt.get_unverified_header(identity_token)
    key = next(k for k in apple_keys["keys"] if k["kid"] == header["kid"])
    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)

    # Verify audience — APPLE_BUNDLE_ID must be configured
    bundle_id = settings.apple_bundle_id
    if not bundle_id:
        raise ValueError("APPLE_BUNDLE_ID not configured — cannot verify Apple token audience")

    return jwt.decode(
        identity_token,
        public_key,
        algorithms=["RS256"],
        audience=bundle_id,
        issuer="https://appleid.apple.com",
    )

"""JWT token creation and verification."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt

from itemplus.core.config import settings


def create_token(user_id: int, apple_sub: str, is_admin: bool) -> str:
    payload = {
        "sub": apple_sub,
        "user_id": user_id,
        "is_admin": is_admin,
        "iss": "itemplus",
        "jti": str(uuid4()),
        "type": "access",
        "exp": datetime.now(UTC) + timedelta(days=settings.jwt_expiry_days),
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        issuer="itemplus",
    )

"""Authentication routes: Apple Sign-In, Magic Link, status."""

import logging
import re
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from itemplus.core.ratelimit import RateLimiter

logger = logging.getLogger(__name__)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.config import settings
from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_user, get_current_user_allow_inactive
from itemplus.core.security import create_token, decode_token
from itemplus.core.websocket import ws_manager
from itemplus.models.device import MagicLinkToken
from itemplus.models.user import User
from itemplus.schemas.auth import AppleLoginRequest, TokenResponse
from itemplus.services.apple_auth import verify_apple_token
from itemplus.services.email import send_magic_link

router = APIRouter(prefix="/auth", tags=["auth"])

# ── WebSocket ticket store (short-lived, in-memory) ──
_ws_tickets: dict[str, dict] = {}


@router.post("/apple", response_model=TokenResponse, dependencies=[Depends(RateLimiter(5, 60))])
async def apple_login(body: AppleLoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with Apple Sign-In identity token."""
    try:
        apple_data = await verify_apple_token(body.identity_token)
    except Exception as e:
        logger.error("Apple token verification failed: %s", e)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Apple token")

    apple_sub = apple_data["sub"]
    user = await db.scalar(select(User).where(User.apple_sub == apple_sub))

    if not user:
        # Try matching by email (e.g. seed user with placeholder apple_sub)
        email = body.email or apple_data.get("email")
        if email:
            user = await db.scalar(select(User).where(User.email == email))
            if user:
                user.apple_sub = apple_sub
                await db.commit()
                await db.refresh(user)

    if not user:
        # New user — first becomes admin, rest start inactive
        user_count = await db.scalar(select(func.count(User.id)))
        is_first = user_count == 0
        user = User(
            apple_sub=apple_sub,
            email=body.email or apple_data.get("email"),
            display_name=body.display_name,
            is_admin=is_first,
            is_active=is_first,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        if not is_first:
            await ws_manager.send_to_admins("admin.new_user_registered", {"user_id": user.id})

        logger.info("[AUDIT] user=%d action=auth.register email=%s", user.id, user.email)

    user.last_login = datetime.now(UTC)
    await db.commit()

    logger.info("[AUDIT] user=%d action=auth.apple email=%s", user.id, user.email)

    token = create_token(user.id, user.apple_sub, user.is_admin)
    response = JSONResponse(content={
        "access_token": token,
        "user_id": user.id,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
    })
    response.set_cookie(
        key="itemplus_token",
        value=token,
        httponly=True,
        secure=bool(settings.app_domain),
        samesite="strict",
        path="/",
        max_age=settings.jwt_expiry_days * 86400,
    )
    return response


@router.get("/status")
async def auth_status(user: User = Depends(get_current_user_allow_inactive)):
    """Check if current user is activated."""
    return {"is_active": user.is_active, "is_admin": user.is_admin}


# ── Magic Link ──


class MagicLinkRequest(BaseModel):
    email: str


@router.post("/magic/request", dependencies=[Depends(RateLimiter(5, 60))])
async def request_magic_link(body: MagicLinkRequest, db: AsyncSession = Depends(get_db)):
    """Send a magic link to the given email address."""
    email = body.email.strip().lower()
    if not email or not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid email")

    # Generate token
    token = secrets.token_urlsafe(48)
    ml = MagicLinkToken(
        email=email,
        token=token,
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.magic_link_expiry_minutes),
    )
    db.add(ml)
    await db.commit()

    # Check if user exists (for email wording only)
    user = await db.scalar(select(User).where(User.email == email))
    sent = send_magic_link(email, token, is_new_user=user is None)
    if not sent:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "E-Mail konnte nicht gesendet werden")

    logger.info("[AUDIT] user=0 action=auth.magic_request email=%s", email)
    return {"status": "sent"}


@router.post("/magic/verify")
async def verify_magic_link(
    body: dict | None = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Verify a magic link token sent in the JSON body and return JWT."""
    actual_token = (body or {}).get("token")
    if not actual_token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token required")

    ml = await db.scalar(
        select(MagicLinkToken).where(
            MagicLinkToken.token == actual_token,
            MagicLinkToken.used == False,  # noqa: E712
            MagicLinkToken.expires_at > datetime.now(UTC),
        )
    )
    if not ml:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Ungültiger oder abgelaufener Link")

    ml.used = True

    # Find or create user
    user = await db.scalar(select(User).where(User.email == ml.email))
    if not user:
        user_count = await db.scalar(select(func.count(User.id)))
        is_first = user_count == 0
        user = User(
            apple_sub=f"magic_{ml.email}",
            email=ml.email,
            is_admin=is_first,
            is_active=is_first,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        if not is_first:
            await ws_manager.send_to_admins("admin.new_user_registered", {"user_id": user.id})

        logger.info("[AUDIT] user=%d action=auth.register email=%s", user.id, user.email)

    user.last_login = datetime.now(UTC)
    await db.commit()

    logger.info("[AUDIT] user=%d action=auth.magic_verify email=%s", user.id, user.email)

    jwt_token = create_token(user.id, user.apple_sub, user.is_admin)
    response = JSONResponse(content={
        "access_token": jwt_token,
        "user_id": user.id,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
    })
    response.set_cookie(
        key="itemplus_token",
        value=jwt_token,
        httponly=True,
        secure=bool(settings.app_domain),
        samesite="strict",
        path="/",
        max_age=settings.jwt_expiry_days * 86400,
    )
    return response


# ── Logout ──


@router.post("/logout")
async def logout():
    """Clear the HttpOnly auth cookie."""
    response = JSONResponse(content={"status": "ok"})
    response.delete_cookie("itemplus_token", path="/")
    return response


# ── WebSocket Ticket ──


@router.post("/ws-ticket")
async def create_ws_ticket(user: User = Depends(get_current_user)):
    """Issue a short-lived ticket for WebSocket authentication.

    Browsers using HttpOnly cookies cannot pass the JWT via query param,
    so they exchange the cookie for a one-time ticket first.
    """
    # Clean up expired tickets
    now = datetime.now(UTC)
    expired = [k for k, v in _ws_tickets.items() if v["expires"] < now]
    for k in expired:
        del _ws_tickets[k]

    ticket = secrets.token_urlsafe(32)
    _ws_tickets[ticket] = {
        "user_id": user.id,
        "expires": now + timedelta(seconds=30),
    }
    return {"ticket": ticket}


def validate_ws_ticket(ticket: str) -> int | None:
    """Validate and consume a WebSocket ticket. Returns user_id or None."""
    entry = _ws_tickets.pop(ticket, None)
    if not entry:
        return None
    if entry["expires"] < datetime.now(UTC):
        return None
    return entry["user_id"]

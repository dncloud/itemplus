"""QR-Login — Browser shows QR code, iPhone scans and confirms, Browser gets token via WebSocket."""

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.ratelimit import RateLimiter

from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_user
from starlette.responses import JSONResponse

from itemplus.core.config import settings
from itemplus.core.security import create_token
from itemplus.core.websocket import ws_manager
from itemplus.models.device import QRLoginToken
from itemplus.models.user import User

router = APIRouter(prefix="/login", tags=["qr-login"])

QR_TOKEN_EXPIRY_SECONDS = 120  # 2 minutes


class QRLoginRequest(BaseModel):
    session_id: int | None = None  # Browser's WS session to notify on confirm


class QRLoginConfirm(BaseModel):
    qr_token: str


@router.post("/qr", dependencies=[Depends(RateLimiter(10, 60))])
async def create_qr_token(body: QRLoginRequest, db: AsyncSession = Depends(get_db)):
    """Browser requests a QR login token. Returns a token string that gets encoded as QR code.

    The token is valid for 2 minutes. When an iPhone scans it and confirms,
    the browser receives a JWT via WebSocket.
    """
    token = secrets.token_urlsafe(32)
    qr = QRLoginToken(
        token=token,
        expires_at=datetime.utcnow() + timedelta(seconds=QR_TOKEN_EXPIRY_SECONDS),
    )
    db.add(qr)
    await db.commit()

    return {
        "qr_token": token,
        "expires_in": QR_TOKEN_EXPIRY_SECONDS,
        "qr_value": f"itemplus://login/{token}",  # What the QR code contains
    }


@router.post("/qr/confirm")
async def confirm_qr_login(
    body: QRLoginConfirm,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """iPhone confirms a QR login. Generates a JWT and sends it to the waiting browser via WebSocket.

    The iPhone must be logged in (has a valid JWT) to confirm.
    """
    qr = await db.scalar(
        select(QRLoginToken).where(
            QRLoginToken.token == body.qr_token,
            QRLoginToken.used == False,  # noqa: E712
            QRLoginToken.expires_at > datetime.utcnow(),
        )
    )
    if not qr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token expired or invalid")

    # Mark as used
    qr.used = True
    qr.confirmed_by_user_id = user.id
    await db.commit()

    # Generate JWT for the browser
    access_token = create_token(user.id, user.apple_sub, user.is_admin)

    return {
        "status": "confirmed",
        "user_id": user.id,
        "display_name": user.display_name,
    }


@router.get("/qr/{qr_token}/status")
async def check_qr_status(qr_token: str, db: AsyncSession = Depends(get_db)):
    """Browser polls to check if QR was confirmed (fallback if WebSocket isn't connected)."""
    qr = await db.scalar(
        select(QRLoginToken).where(QRLoginToken.token == qr_token)
    )
    if not qr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")

    if qr.used and qr.confirmed_by_user_id:
        # Generate a fresh token for the browser and set cookie
        user = await db.get(User, qr.confirmed_by_user_id)
        if user:
            access_token = create_token(user.id, user.apple_sub, user.is_admin)
            response = JSONResponse(content={
                "status": "confirmed", "access_token": access_token,
                "user_id": user.id, "is_admin": user.is_admin,
            })
            response.set_cookie(
                key="itemplus_token", value=access_token,
                httponly=True, secure=bool(settings.app_domain),
                samesite="strict", path="/",
                max_age=settings.jwt_expiry_days * 86400,
            )
            return response

    if qr.expires_at < datetime.utcnow():
        return {"status": "expired"}

    return {"status": "pending"}

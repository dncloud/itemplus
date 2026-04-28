"""Device management — push tokens + active device sessions."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_user
from itemplus.core.websocket import ws_manager
from itemplus.models.device import DeviceSession
from itemplus.models.user import User

router = APIRouter(prefix="/devices", tags=["devices"])


# ── Active Device Sessions (WebSocket connected) ──

@router.get("/sessions")
async def list_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List device sessions — online first, then recent offline. Max 10."""
    from datetime import datetime, timedelta

    # Auto-cleanup: delete offline sessions older than 7 days
    cutoff = datetime.utcnow() - timedelta(days=7)
    await db.execute(
        DeviceSession.__table__.delete().where(
            DeviceSession.user_id == user.id,
            DeviceSession.is_online == False,  # noqa: E712
            DeviceSession.last_seen < cutoff,
        )
    )
    await db.commit()

    # Get all sessions, limited
    sessions = (await db.scalars(
        select(DeviceSession)
        .where(DeviceSession.user_id == user.id)
        .order_by(DeviceSession.last_seen.desc())
        .limit(20)
    )).all()

    # Truth comes from WS manager, not DB
    live_sessions = {c["session_id"] for c in ws_manager.get_user_devices(user.id)}

    # Sync DB online status with reality
    for s in sessions:
        actual_online = s.id in live_sessions
        if s.is_online != actual_online:
            s.is_online = actual_online
    await db.commit()

    # Online first, then offline, max 10
    online = [s for s in sessions if s.id in live_sessions]
    offline = [s for s in sessions if s.id not in live_sessions]
    display = online + offline[:max(0, 10 - len(online))]

    return {
        "sessions": [
            {
                "id": s.id,
                "device_type": s.device_type,
                "device_name": s.device_name,
                "ip_address": s.ip_address,
                "is_online": s.id in live_sessions,
                "last_seen": s.last_seen.isoformat() if s.last_seen else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in display
        ]
    }


@router.get("/sessions/online")
async def list_online_sessions(user: User = Depends(get_current_user)):
    """List only currently connected devices (via WebSocket)."""
    return {"devices": ws_manager.get_user_devices(user.id)}


@router.delete("/sessions/{session_id}")
async def kick_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect and remove a device session."""
    session = await db.get(DeviceSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    # Kick the WS connection (sends event + closes socket)
    logger.info("[AUDIT] user=%d kicked session=%d (device=%s)", user.id, session_id, session.device_name)
    await ws_manager.kick(session_id)

    # Remove from DB
    await db.delete(session)
    await db.commit()
    return {"status": "kicked"}

"""User management routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.database import get_db
from itemplus.core.dependencies import PERMISSIONS, get_current_admin, get_current_user, get_current_user_allow_inactive
from itemplus.core.websocket import ws_manager
from itemplus.models.device import DeviceSession
from itemplus.models.user import User
from itemplus.schemas.user import UserAdminUpdate, UserResponse, UserUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["users"])


def _resp(user: User, last_session: DeviceSession | None = None) -> UserResponse:
    r = UserResponse.from_user(user)
    if last_session:
        r.last_ip = last_session.ip_address
        r.last_device = last_session.device_name or last_session.device_type
    return r


# -- Current user --

@router.get("/user", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user_allow_inactive)):
    return _resp(user)


@router.put("/user", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = body.resolved_display_name()
    if name is not None:
        user.display_name = name
    if body.email is not None:
        user.email = body.email
    await db.commit()
    await db.refresh(user)
    return _resp(user)


@router.delete("/user", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    logger.info("[AUDIT] user=%d deleted own account (email=%s)", user.id, user.email)
    await db.delete(user)
    await db.commit()


# -- Admin: manage users --

@router.get("/users", response_model=list[UserResponse])
async def list_users(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    users = (await db.scalars(select(User).order_by(User.created_at.desc()))).all()
    result = []
    for u in users:
        last = await db.scalar(
            select(DeviceSession).where(DeviceSession.user_id == u.id).order_by(DeviceSession.last_seen.desc()).limit(1)
        )
        result.append(_resp(u, last))
    return result


@router.get("/users/lookup")
async def users_lookup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Public list of active users (id + name only) for picker dropdowns."""
    result = await db.scalars(select(User).where(User.is_active == True).order_by(User.display_name))  # noqa: E712
    return [{"id": u.id, "name": u.display_name or u.email or f"User #{u.id}"} for u in result.all()]


@router.get("/users/inactive", response_model=list[UserResponse])
async def list_inactive(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(User).where(User.is_active == False).order_by(User.created_at.desc()))  # noqa: E712
    return [_resp(u) for u in result.all()]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _resp(user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserAdminUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    was_inactive = not user.is_active
    name = body.resolved_display_name()
    if name is not None:
        user.display_name = name
    if body.email is not None:
        user.email = body.email
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.permissions is not None:
        unknown = [p for p in body.permissions if p not in PERMISSIONS]
        if unknown:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown permissions: {', '.join(unknown)}")
        user.permissions = body.permissions
        logger.info("[AUDIT] admin=%d changed permissions for user=%d to %s", admin.id, user.id, body.permissions)
    await db.commit()
    await db.refresh(user)

    logger.info("[AUDIT] user=%d action=user.update target=%d", admin.id, user_id)

    if was_inactive and user.is_active:
        await ws_manager.send_to_user(user.id, "user.activated")

    return _resp(user)


@router.put("/users/{user_id}/activate", response_model=UserResponse)
async def activate_user(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    logger.info("[AUDIT] user=%d action=user.activate target=%d", admin.id, user_id)
    await ws_manager.send_to_user(user.id, "user.activated")
    return _resp(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    logger.info("[AUDIT] admin=%d deleted user=%d (email=%s)", admin.id, user.id, user.email)
    await db.delete(user)
    await db.commit()

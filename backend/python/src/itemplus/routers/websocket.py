"""WebSocket endpoint for real-time updates and cross-device communication."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from itemplus.core.database import async_session
from itemplus.core.security import decode_token
from itemplus.core.websocket import ws_manager
from itemplus.models.device import DeviceSession
from itemplus.models.user import User
from itemplus.routers.auth import validate_ws_ticket

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str | None = Query(None),
    ticket: str | None = Query(None),
    device_type: str = Query("browser"),
    device_name: str | None = Query(None),
):
    """WebSocket connection with JWT auth or one-time ticket.

    Query params:
        token: JWT access token (iOS / direct)
        ticket: One-time ticket from POST /auth/ws-ticket (browser with HttpOnly cookie)
        device_type: "browser" or "ios"
        device_name: e.g. "Mac Safari", "iPhone 15 Pro"
    """
    user_id: int | None = None
    is_admin: bool = False

    # Try ticket-based auth first (one-time use)
    if ticket:
        user_id = validate_ws_ticket(ticket)
        if user_id is None:
            await ws.close(code=4001, reason="Invalid or expired ticket")
            return
        # Look up admin status from DB below
    elif token:
        try:
            payload = decode_token(token)
        except Exception:
            await ws.close(code=4001, reason="Invalid token")
            return
        user_id = payload["user_id"]
        is_admin = payload.get("is_admin", False)
    else:
        await ws.close(code=4001, reason="Token or ticket required")
        return

    # Verify user
    async with async_session() as db:
        user = await db.scalar(select(User).where(User.id == user_id))
        if not user or not user.is_active:
            await ws.close(code=4003, reason="User not active")
            return

        # For ticket auth, resolve admin status from DB
        if ticket:
            is_admin = user.is_admin

        # Get client IP and user-agent
        client_ip = ws.client.host if ws.client else None
        user_agent = dict(ws.headers).get("user-agent")

        # Reuse existing session for same user+device_type+ip, or create new
        session = await db.scalar(
            select(DeviceSession).where(
                DeviceSession.user_id == user_id,
                DeviceSession.device_type == device_type,
                DeviceSession.ip_address == client_ip,
            ).order_by(DeviceSession.last_seen.desc()).limit(1)
        )
        if session:
            session.is_online = True
            session.last_seen = datetime.now(UTC)
            session.device_name = device_name or session.device_name
            session.user_agent = user_agent or session.user_agent
        else:
            session = DeviceSession(
                user_id=user_id,
                device_type=device_type,
                device_name=device_name,
                ip_address=client_ip,
                is_online=True,
                last_seen=datetime.now(UTC),
                user_agent=user_agent,
            )
            db.add(session)

        # Clean up old offline sessions for this user (keep max 10)
        old_offline = (await db.scalars(
            select(DeviceSession).where(
                DeviceSession.user_id == user_id,
                DeviceSession.is_online == False,  # noqa: E712
            ).order_by(DeviceSession.last_seen.desc()).offset(10)
        )).all()
        for old in old_offline:
            await db.delete(old)

        await db.commit()
        await db.refresh(session)
        session_id = session.id

    await ws_manager.connect(ws, user_id, session_id, device_type, device_name, is_admin)

    try:
        while True:
            data = await ws.receive_json()
            await _handle_message(data, user_id, session_id, device_type)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(session_id)
        # Update session
        async with async_session() as db:
            session = await db.get(DeviceSession, session_id)
            if session:
                session.is_online = False
                session.last_seen = datetime.now(UTC)
                await db.commit()
        # Notify other devices
        await ws_manager.send_to_user(user_id, "device.disconnected", {
            "session_id": session_id,
            "device_type": device_type,
            "device_name": device_name,
        })


async def _do_delete_entity(user_id: int, target_session: int | None, realm: str, entity_type: str, entity_id: int):
    """Delete a non-item entity (category, location, vendor, attachment, user)."""
    from itemplus.models import archive, collection
    from itemplus.models.user import User as UserModel

    table_map = {
        "category": {"archive": archive.Category, "collection": collection.Category},
        "location": {"archive": archive.Location, "collection": collection.Location},
        "manufacturer": {"archive": archive.Manufacturer, "collection": collection.Manufacturer},
        "supplier": {"archive": archive.Supplier, "collection": collection.Supplier},
        "vendor": {"archive": archive.Vendor, "collection": collection.Vendor},
        "attachment": {"archive": archive.Attachment, "collection": collection.Attachment},
        "property": {"archive": archive.Property, "collection": collection.Property},
    }

    async with async_session() as db:
        if entity_type == "user":
            obj = await db.get(UserModel, entity_id)
        elif entity_type in table_map and realm in table_map[entity_type]:
            obj = await db.get(table_map[entity_type][realm], entity_id)
        else:
            obj = None

        if obj:
            await db.delete(obj)
            await db.commit()

    payload = {"entity_id": entity_id, "entity_type": entity_type}
    if target_session:
        await ws_manager.send_to_session(target_session, "delete.done", payload)
    await ws_manager.send_to_user_browsers(user_id, "delete.done", payload)


async def _do_delete(user_id: int, target_session: int | None, realm: str, item_id: int):
    """Actually delete the item and notify browsers. Caller must verify permissions."""
    from itemplus.models import archive, collection
    models = archive if realm == "archive" else collection
    async with async_session() as db:
        item = await db.get(models.Item, item_id)
        if item:
            await db.delete(item)
            await db.commit()
    if target_session:
        await ws_manager.send_to_session(target_session, "delete.done", {"item_id": item_id})
    await ws_manager.send_to_user_browsers(user_id, "delete.done", {"item_id": item_id})
    await ws_manager.broadcast(f"stats.{realm}_updated")


async def _check_permission(user_id: int, perm: str) -> bool:
    """Check if user has permission. Admins always pass."""
    from itemplus.models.user import User
    async with async_session() as db:
        user = await db.get(User, user_id)
        if not user:
            return False
        if user.is_admin:
            return True
        return perm in (user.permissions or [])


def _permissions_for_entity_type(entity_type: str, action: str) -> list[str]:
    """Return the required permissions for a websocket entity action."""
    match entity_type:
        case "item":
            return [f"items.{action}"]
        case "category":
            return [f"categories.{action}"]
        case "location":
            return [f"locations.{action}"]
        case "manufacturer" | "supplier" | "vendor":
            return [f"vendors.{action}"]
        case "attachment":
            return ["attachments.write", "items.read"]
        case "property":
            return ["items.write"]
        case "user":
            return ["__admin_only__"]
        case _:
            return [f"items.{action}"]


async def _check_permissions(user_id: int, perms: list[str]) -> bool:
    return all(await _check_permission(user_id, perm) for perm in perms)


async def _handle_message(data: dict, user_id: int, session_id: int, device_type: str):
    """Handle incoming WebSocket messages and route cross-device events."""
    msg_type = data.get("type", "")

    match msg_type:
        case "ping":
            await ws_manager.send_to_session(session_id, "pong")

        # ── iPhone scanned a QR code on a physical item ──
        case "qr.scan":
            item_id = data.get("item_id")
            target_session = data.get("target_session")  # specific browser session, or None for all

            if target_session and ws_manager.session_belongs_to_user(target_session, user_id):
                # Send to specific browser (verified same user)
                await ws_manager.send_to_session(target_session, "browser.open_item", {
                    "item_id": item_id,
                    "from_device": device_type,
                    "from_session": session_id,
                })
            else:
                # Send to all user's browsers
                await ws_manager.send_to_user_browsers(user_id, "browser.open_item", {
                    "item_id": item_id,
                    "from_device": device_type,
                    "from_session": session_id,
                })

        # ── iPhone scanned a location QR ──
        case "qr.scan_location":
            location_id = data.get("location_id")
            realm = data.get("realm", "archive")
            await ws_manager.send_to_user_browsers(user_id, "browser.open_location", {
                "location_id": location_id,
                "realm": realm,
                "from_device": device_type,
                "from_session": session_id,
            })

        # ── Browser wants to delete something — ask iPhone for confirmation ──
        case "delete.request":
            entity_type = data.get("entity_type", "item")  # item, category, location, vendor, attachment, user
            entity_id = data.get("entity_id") or data.get("item_id")
            entity_name = data.get("entity_name") or data.get("item_name", "")
            realm = data.get("realm", "archive")
            perms = _permissions_for_entity_type(entity_type, "delete")
            if not await _check_permissions(user_id, perms):
                await ws_manager.send_to_session(session_id, "delete.rejected", {
                    "entity_id": entity_id,
                    "entity_type": entity_type,
                })
                return
            has_ios = ws_manager.has_ios_devices(user_id)
            payload = {"entity_id": entity_id, "entity_type": entity_type, "entity_name": entity_name, "realm": realm}
            if not has_ios:
                await ws_manager.send_to_session(session_id, "delete.no_device", payload)
            else:
                await ws_manager.send_to_user_ios(user_id, "delete.confirm_request", {
                    **payload,
                    "from_session": session_id,
                })
                await ws_manager.send_to_session(session_id, "delete.pending", payload)

        # ── iPhone confirmed/rejected delete ──
        case "delete.confirm":
            entity_id = data.get("entity_id") or data.get("item_id")
            entity_type = data.get("entity_type", "item")
            realm = data.get("realm", "archive")
            target_session = data.get("target_session")
            perms = _permissions_for_entity_type(entity_type, "delete")
            if not await _check_permissions(user_id, perms):
                return
            if target_session and not ws_manager.session_belongs_to_user(target_session, user_id):
                return
            if entity_type == "item":
                await _do_delete(user_id, target_session, realm, entity_id)
            else:
                await _do_delete_entity(user_id, target_session, realm, entity_type, entity_id)

        case "delete.reject":
            entity_id = data.get("entity_id") or data.get("item_id")
            target_session = data.get("target_session")
            payload = {"entity_id": entity_id, "entity_type": data.get("entity_type", "item")}
            if target_session and ws_manager.session_belongs_to_user(target_session, user_id):
                await ws_manager.send_to_session(target_session, "delete.rejected", payload)
            else:
                await ws_manager.send_to_user_browsers(user_id, "delete.rejected", payload)

        # ── Browser requests a photo from iPhone ──
        case "photo.request":
            item_id = data.get("item_id")
            item_name = data.get("item_name")
            realm = data.get("realm", "archive")
            await ws_manager.send_to_user_ios(user_id, "photo.request", {
                "item_id": item_id,
                "item_name": item_name,
                "realm": realm,
                "from_session": session_id,
            })

        # ── iPhone uploaded a photo (notify browsers) ──
        case "photo.uploaded":
            item_id = data.get("item_id")
            attachment_id = data.get("attachment_id")
            await ws_manager.send_to_user_browsers(user_id, "photo.uploaded", {
                "item_id": item_id,
                "attachment_id": attachment_id,
            })

        # ── Request list of connected devices ──
        case "devices.list":
            devices = ws_manager.get_user_devices(user_id)
            await ws_manager.send_to_session(session_id, "devices.list", {"devices": devices})

        case _:
            logger.debug("Unknown WS message type: %s", msg_type)

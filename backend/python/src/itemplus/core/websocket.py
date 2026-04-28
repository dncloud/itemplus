"""WebSocket connection manager for real-time events and cross-device communication."""

import json
import logging
from dataclasses import dataclass, field

from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class DeviceConnection:
    ws: WebSocket
    user_id: int
    session_id: int
    device_type: str  # "browser" or "ios"
    device_name: str | None = None
    is_admin: bool = False


@dataclass
class ConnectionManager:
    """Manages WebSocket connections, grouped by user, device type, and session."""

    _connections: dict[int, DeviceConnection] = field(default_factory=dict)  # session_id -> connection

    def _user_connections(self, user_id: int) -> list[DeviceConnection]:
        return [c for c in self._connections.values() if c.user_id == user_id]

    def _user_browsers(self, user_id: int) -> list[DeviceConnection]:
        return [c for c in self._connections.values() if c.user_id == user_id and c.device_type == "browser"]

    def _user_ios(self, user_id: int) -> list[DeviceConnection]:
        return [c for c in self._connections.values() if c.user_id == user_id and c.device_type == "ios"]

    async def connect(self, ws: WebSocket, user_id: int, session_id: int, device_type: str, device_name: str | None = None, is_admin: bool = False):
        await ws.accept()
        conn = DeviceConnection(ws=ws, user_id=user_id, session_id=session_id, device_type=device_type, device_name=device_name, is_admin=is_admin)
        self._connections[session_id] = conn
        logger.info("WS connected: user=%d session=%d type=%s name=%s", user_id, session_id, device_type, device_name)

        # Notify user's other devices about new connection
        await self.send_to_user(user_id, "device.connected", {
            "session_id": session_id,
            "device_type": device_type,
            "device_name": device_name,
        }, exclude_session=session_id)

    def disconnect(self, session_id: int):
        conn = self._connections.pop(session_id, None)
        if conn:
            logger.info("WS disconnected: user=%d session=%d", conn.user_id, session_id)

    async def kick(self, session_id: int):
        """Send kicked event and close the WebSocket connection."""
        await self.send_to_session(session_id, "session.kicked", {"reason": "Removed by user"})
        conn = self._connections.pop(session_id, None)
        if conn:
            try:
                await conn.ws.close(code=4002, reason="Session kicked")
            except Exception:
                pass
            logger.info("WS kicked: user=%d session=%d", conn.user_id, session_id)

    async def send_to_session(self, session_id: int, event: str, data: dict | None = None):
        conn = self._connections.get(session_id)
        if conn:
            try:
                await conn.ws.send_json({"event": event, "data": data or {}})
            except Exception:
                self.disconnect(session_id)

    async def send_to_user(self, user_id: int, event: str, data: dict | None = None, exclude_session: int | None = None):
        msg = json.dumps({"event": event, "data": data or {}})
        for conn in self._user_connections(user_id):
            if exclude_session and conn.session_id == exclude_session:
                continue
            try:
                await conn.ws.send_text(msg)
            except Exception:
                self.disconnect(conn.session_id)

    async def send_to_user_browsers(self, user_id: int, event: str, data: dict | None = None):
        msg = json.dumps({"event": event, "data": data or {}})
        for conn in self._user_browsers(user_id):
            try:
                await conn.ws.send_text(msg)
            except Exception:
                self.disconnect(conn.session_id)

    async def send_to_user_ios(self, user_id: int, event: str, data: dict | None = None):
        msg = json.dumps({"event": event, "data": data or {}})
        for conn in self._user_ios(user_id):
            try:
                await conn.ws.send_text(msg)
            except Exception:
                self.disconnect(conn.session_id)

    async def send_to_admins(self, event: str, data: dict | None = None):
        msg = json.dumps({"event": event, "data": data or {}})
        for conn in list(self._connections.values()):
            if conn.is_admin:
                try:
                    await conn.ws.send_text(msg)
                except Exception:
                    self.disconnect(conn.session_id)

    async def broadcast(self, event: str, data: dict | None = None):
        msg = json.dumps({"event": event, "data": data or {}})
        for sid in list(self._connections):
            try:
                await self._connections[sid].ws.send_text(msg)
            except Exception:
                self.disconnect(sid)

    def session_belongs_to_user(self, session_id: int, user_id: int) -> bool:
        conn = self._connections.get(session_id)
        return conn is not None and conn.user_id == user_id

    def has_ios_devices(self, user_id: int) -> bool:
        return len(self._user_ios(user_id)) > 0

    def get_user_devices(self, user_id: int) -> list[dict]:
        """Get list of connected devices for a user."""
        return [
            {
                "session_id": c.session_id,
                "device_type": c.device_type,
                "device_name": c.device_name,
            }
            for c in self._user_connections(user_id)
        ]


ws_manager = ConnectionManager()

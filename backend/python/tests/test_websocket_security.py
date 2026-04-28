import unittest

from itemplus.routers import websocket


class WebSocketSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_delete_confirm_requires_permissions(self):
        called = {"delete": False}

        async def deny_permissions(user_id, perms):
            return False

        async def track_delete(user_id, target_session, realm, item_id):
            called["delete"] = True

        original_check = websocket._check_permissions
        original_delete = websocket._do_delete
        try:
            websocket._check_permissions = deny_permissions
            websocket._do_delete = track_delete

            await websocket._handle_message(
                {"type": "delete.confirm", "item_id": 7, "realm": "archive"},
                user_id=5,
                session_id=11,
                device_type="ios",
            )
        finally:
            websocket._check_permissions = original_check
            websocket._do_delete = original_delete

        self.assertFalse(called["delete"])

    async def test_delete_request_rejects_when_permissions_missing(self):
        events = []

        async def deny_permissions(user_id, perms):
            return False

        async def capture_send_to_session(session_id, event, data):
            events.append((session_id, event, data))

        original_check = websocket._check_permissions
        original_send = websocket.ws_manager.send_to_session
        try:
            websocket._check_permissions = deny_permissions
            websocket.ws_manager.send_to_session = capture_send_to_session

            await websocket._handle_message(
                {"type": "delete.request", "entity_type": "attachment", "entity_id": 12, "realm": "archive"},
                user_id=5,
                session_id=11,
                device_type="browser",
            )
        finally:
            websocket._check_permissions = original_check
            websocket.ws_manager.send_to_session = original_send

        self.assertEqual(events, [(11, "delete.rejected", {"entity_id": 12, "entity_type": "attachment"})])

    def test_attachment_delete_requires_write_and_read_permissions(self):
        self.assertEqual(
            websocket._permissions_for_entity_type("attachment", "delete"),
            ["attachments.write", "items.read"],
        )

    async def test_login_confirm_message_is_ignored(self):
        events = []

        async def capture_send_to_session(session_id, event, data):
            events.append((session_id, event, data))

        original_send = websocket.ws_manager.send_to_session
        try:
            websocket.ws_manager.send_to_session = capture_send_to_session

            await websocket._handle_message(
                {"type": "login.confirm", "target_session": 42, "access_token": "fake"},
                user_id=5,
                session_id=11,
                device_type="ios",
            )
        finally:
            websocket.ws_manager.send_to_session = original_send

        self.assertEqual(events, [])


if __name__ == "__main__":
    unittest.main()

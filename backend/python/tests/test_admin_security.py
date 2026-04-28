import unittest

from fastapi import HTTPException

from itemplus.routers import admin


class AdminSecurityTests(unittest.TestCase):
    def test_import_requires_confirm_when_wiping(self):
        with self.assertRaises(HTTPException) as ctx:
            admin._require_import_confirm(True, None)

        self.assertEqual(ctx.exception.status_code, 400)

    def test_import_allows_confirmed_wipe(self):
        admin._require_import_confirm(True, "IMPORT")

    def test_import_without_wipe_needs_no_confirm(self):
        admin._require_import_confirm(False, None)


if __name__ == "__main__":
    unittest.main()

import unittest

from fastapi import HTTPException

from itemplus.routers import branding


class BrandingTests(unittest.TestCase):
    def test_validate_branding_accepts_defaults(self):
        payload = branding._validate_branding_payload(None, "", None)
        self.assertIsNone(payload.logo)
        self.assertEqual(payload.subtitle, "")
        self.assertEqual(payload.width, 180)

    def test_validate_branding_rejects_non_image_logo(self):
        with self.assertRaises(HTTPException) as ctx:
            branding._validate_branding_payload("data:text/plain;base64,abc", "", 180)

        self.assertEqual(ctx.exception.status_code, 400)

    def test_validate_branding_rejects_invalid_width(self):
        with self.assertRaises(HTTPException) as ctx:
            branding._validate_branding_payload(None, "", 40)

        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()

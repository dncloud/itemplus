import unittest

from fastapi import HTTPException

from itemplus.routers import printer


class PrinterSecurityTests(unittest.TestCase):
    def test_generate_qr_svg_rejects_invalid_color(self):
        with self.assertRaises(HTTPException) as ctx:
            printer._generate_qr_svg("itp://a/i/00000001", 'fff" onload="alert(1)')

        self.assertEqual(ctx.exception.status_code, 400)

    def test_generate_qr_svg_accepts_hex_color(self):
        response = printer._generate_qr_svg("itp://a/i/00000001", "00ff99")
        self.assertEqual(response.media_type, "image/svg+xml")

    def test_printer_host_validation_rejects_bad_value(self):
        with self.assertRaises(HTTPException) as ctx:
            printer._validate_printer_host('printer local"')

        self.assertEqual(ctx.exception.status_code, 400)

    def test_printer_host_validation_accepts_hostname(self):
        self.assertEqual(printer._validate_printer_host("printer.local"), "printer.local")


if __name__ == "__main__":
    unittest.main()

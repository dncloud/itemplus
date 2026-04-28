"""TSC thermal printer service — generates TSPL for QR-only labels and sends via TCP."""

import asyncio
import logging

from itemplus.core.config import settings

logger = logging.getLogger(__name__)

# 203 DPI = 8 dots per mm
DOTS_PER_MM = 8


def compact_qr(realm: str, entity_type: str, entity_id: int) -> str:
    """Generate compact QR code content.

    Format: itp://a/i/00000123 (archive item)
            itp://c/i/00000123 (collection item)
            itp://a/l/00000005 (archive location)
    """
    prefix = "a" if realm == "archive" else "c"
    t = "i" if entity_type == "item" else "l"
    return f"itp://{prefix}/{t}/{entity_id:08d}"


def generate_qr_tspl(qr_content: str, copies: int = 1) -> str:
    """Generate TSPL commands for a QR-only label."""
    w = settings.printer_label_width
    h = settings.printer_label_height
    gap = settings.printer_gap
    speed = settings.printer_speed
    density = settings.printer_density

    tspl = f"""SIZE {w} mm, {h} mm
GAP {gap} mm, 0 mm
SPEED {speed}
DENSITY {density}
DIRECTION 1
CODEPAGE 1252
CLS
QRCODE 55,55,H,13,A,0,M2,"{qr_content}"
PRINT {copies}
"""
    return tspl


async def send_tspl(tspl: str) -> bool:
    """Send TSPL commands to printer via TCP."""
    host = settings.printer_host
    port = settings.printer_port

    if not host:
        logger.error("Printer host not configured")
        return False

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=5.0,
        )

        # Convert to Windows-1252 for European character support
        data = tspl.replace("\n", "\r\n").encode("cp1252", errors="replace")
        writer.write(data)
        await writer.drain()

        # Brief wait for printer to process
        await asyncio.sleep(0.5)

        writer.close()
        await writer.wait_closed()

        logger.info("TSPL sent to %s:%d (%d bytes)", host, port, len(data))
        return True

    except asyncio.TimeoutError:
        logger.error("Printer connection timeout: %s:%d", host, port)
        return False
    except Exception as e:
        logger.error("Printer error: %s", e)
        return False


async def test_connection() -> bool:
    """Test printer connectivity."""
    host = settings.printer_host
    port = settings.printer_port

    if not host:
        return False

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=5.0,
        )
        # Send status query
        writer.write(b"~!@\r\n")
        await writer.drain()
        await asyncio.sleep(0.3)
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False

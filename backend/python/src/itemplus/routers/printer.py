"""Print routes — QR label printing via TSC thermal printer + QR code image generation."""

import io
import ipaddress
import logging
import re

logger = logging.getLogger(__name__)

import qrcode
import qrcode.constants
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.config import settings
from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_admin, require_permission
from itemplus.models import archive, collection
from itemplus.models.user import User
from itemplus.services.printer import compact_qr, generate_qr_tspl, send_tspl, test_connection

router = APIRouter(prefix="/print", tags=["print"])

_realms = {"archive": archive, "collection": collection}
_HEX_COLOR_RE = re.compile(r"^[0-9a-fA-F]{6}$")


class PrintRequest(BaseModel):
    copies: int = 1


class PrinterConfigUpdate(BaseModel):
    host: str | None = None
    port: int | None = None
    speed: int | None = None
    density: int | None = None
    label_width: int | None = None
    label_height: int | None = None
    gap: float | None = None


def _validate_printer_host(host: str) -> str:
    value = host.strip()
    if not value:
        return ""
    if len(value) > 255 or any(ch.isspace() for ch in value):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid printer host")
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError:
        pass
    if value == "localhost":
        return value
    if not re.fullmatch(r"[A-Za-z0-9.-]+", value) or value.startswith(".") or value.endswith(".") or ".." in value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid printer host")
    return value


@router.post("/{realm}/item/{item_id}")
async def print_item_qr(
    realm: str,
    item_id: int,
    body: PrintRequest = PrintRequest(),
    user: User = Depends(require_permission("print")),
    db: AsyncSession = Depends(get_db),
):
    """Print a QR code label for an item."""
    models = _realms.get(realm)
    if not models:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid realm")

    item = await db.get(models.Item, item_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")

    qr = compact_qr(realm, "item", item_id)
    tspl = generate_qr_tspl(qr, copies=body.copies)

    success = await send_tspl(tspl)
    if not success:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Printer not reachable")

    return {"status": "printed", "qr_content": qr, "copies": body.copies}


@router.post("/{realm}/location/{location_id}")
async def print_location_qr(
    realm: str,
    location_id: int,
    body: PrintRequest = PrintRequest(),
    user: User = Depends(require_permission("print")),
    db: AsyncSession = Depends(get_db),
):
    """Print a QR code label for a location."""
    models = _realms.get(realm)
    if not models:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid realm")

    location = await db.get(models.Location, location_id)
    if not location:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found")

    qr = compact_qr(realm, "location", location_id)
    tspl = generate_qr_tspl(qr, copies=body.copies)

    success = await send_tspl(tspl)
    if not success:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Printer not reachable")

    return {"status": "printed", "qr_content": qr, "copies": body.copies}


@router.get("/status")
async def printer_status(admin: User = Depends(get_current_admin)):
    """Check printer connection and return config."""
    reachable = await test_connection()
    return {
        "reachable": reachable,
        "host": settings.printer_host,
        "port": settings.printer_port,
        "speed": settings.printer_speed,
        "density": settings.printer_density,
        "label_width": settings.printer_label_width,
        "label_height": settings.printer_label_height,
        "gap": settings.printer_gap,
    }


def _generate_qr_svg(content: str, color: str = "000000") -> StreamingResponse:
    """Generate a compact QR code as SVG with transparent background."""
    if not _HEX_COLOR_RE.fullmatch(color):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid color")

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=1, border=0)
    qr.add_data(content)
    qr.make(fit=True)

    matrix = qr.get_matrix()
    n = len(matrix)
    fill = f"#{color}"

    # Use a single path instead of individual rects — smaller SVG, no visible grid
    path_parts = []
    for y, row in enumerate(matrix):
        x = 0
        while x < n:
            if row[x]:
                # Find consecutive filled modules in this row
                start = x
                while x < n and row[x]:
                    x += 1
                # One rect for the entire run
                path_parts.append(f"M{start},{y}h{x - start}v1h-{x - start}z")
            else:
                x += 1

    path_d = "".join(path_parts)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges"><path d="{path_d}" fill="{fill}"/></svg>'

    return StreamingResponse(
        io.BytesIO(svg.encode()),
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/qr/generate.svg")
async def qr_code_generic(data: str = Query(...), color: str = Query("000000")):
    """Generate a QR code SVG for arbitrary content (login QR, etc.)."""
    if len(data) > 2048:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "QR data too long")
    return _generate_qr_svg(data, color)


@router.get("/qr/{realm}/{entity_type}/{entity_id}.svg")
async def qr_code_entity(realm: str, entity_type: str, entity_id: int, color: str = Query("000000")):
    """Generate a QR code SVG for an item or location."""
    return _generate_qr_svg(compact_qr(realm, entity_type, entity_id), color)


@router.post("/calibrate")
async def calibrate_printer(admin: User = Depends(get_current_admin)):
    """Send GAP calibration command. The printer feeds labels to detect the gap sensor."""
    w = settings.printer_label_width
    h = settings.printer_label_height
    gap = settings.printer_gap

    tspl = f"""SIZE {w} mm, {h} mm
GAP {gap} mm, 0 mm
GAPDETECT
"""
    success = await send_tspl(tspl)
    if not success:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Printer not reachable")
    return {"status": "calibrated", "tspl": tspl}


class TestPrintRequest(BaseModel):
    tspl: str | None = None  # Custom TSPL — if empty, generates a test label


@router.post("/test")
async def test_print(
    body: TestPrintRequest = TestPrintRequest(),
    admin: User = Depends(get_current_admin),
):
    """Send a test print. Optionally with custom TSPL commands."""
    if body.tspl:
        tspl = body.tspl
    else:
        # Default test label
        qr = compact_qr("archive", "item", 0)
        tspl = generate_qr_tspl(qr, copies=1)

    success = await send_tspl(tspl)
    if not success:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Printer not reachable")
    return {"status": "printed", "tspl": tspl}


@router.get("/test/preview")
async def test_preview(admin: User = Depends(get_current_admin)):
    """Get the default test TSPL for preview."""
    qr = compact_qr("archive", "item", 0)
    tspl = generate_qr_tspl(qr, copies=1)
    return {"tspl": tspl}


@router.put("/config")
async def update_printer_config(
    body: PrinterConfigUpdate,
    admin: User = Depends(get_current_admin),
):
    """Update printer configuration (runtime only, not persisted to .env). Admin only."""
    if body.host is not None:
        settings.printer_host = _validate_printer_host(body.host)
    if body.port is not None:
        if body.port < 1 or body.port > 65535:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid printer port")
        settings.printer_port = body.port
    if body.speed is not None:
        settings.printer_speed = max(1, min(15, body.speed))
    if body.density is not None:
        settings.printer_density = max(0, min(15, body.density))
    if body.label_width is not None:
        if body.label_width < 10 or body.label_width > 200:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid label width")
        settings.printer_label_width = body.label_width
    if body.label_height is not None:
        if body.label_height < 10 or body.label_height > 200:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid label height")
        settings.printer_label_height = body.label_height
    if body.gap is not None:
        if body.gap < 0 or body.gap > 20:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid label gap")
        settings.printer_gap = body.gap

    logger.info("[AUDIT] user=%d action=config.printer", admin.id)
    return {"status": "updated"}

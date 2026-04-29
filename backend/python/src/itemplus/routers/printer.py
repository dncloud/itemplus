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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.config import settings
from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_admin, require_permission
from itemplus.models import LabelTemplate, archive, collection
from itemplus.models.user import User
from itemplus.services.printer import calibration_tspl, compact_qr, render_entity_tspl, render_preview_tspl, send_tspl, test_connection
from itemplus.services.label_templates import (
    is_valid_label_template_target,
    label_template_variables,
    normalize_multiline,
    nullable_trimmed_string,
    supported_tspl_commands,
    validate_label_template_definition,
)

router = APIRouter(prefix="/print", tags=["print"])

_realms = {"archive": archive, "collection": collection}
_HEX_COLOR_RE = re.compile(r"^[0-9a-fA-F]{6}$")


class PrintRequest(BaseModel):
    copies: int = 1


class PrinterConfigUpdate(BaseModel):
    host: str | None = None
    port: int | None = None


class LabelTemplatePayload(BaseModel):
    name: str | None = None
    description: str | None = None
    target: str | None = None
    dpi: int | None = None
    width_mm: int | None = None
    height_mm: int | None = None
    gap_mm: float | None = None
    speed: int | None = None
    density: int | None = None
    direction: int | None = None
    reference_x: int | None = None
    reference_y: int | None = None
    shift_x: int | None = None
    shift_y: int | None = None
    copies_default: int | None = None
    is_default: bool | None = None
    is_active: bool | None = None
    tspl_template: str | None = None


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


def _serialize_label_template(template: LabelTemplate) -> dict[str, object]:
    return {
        "id": template.id,
        "system_key": template.system_key,
        "name": template.name,
        "description": template.description,
        "target": template.target,
        "dpi": template.dpi,
        "width_mm": template.width_mm,
        "height_mm": template.height_mm,
        "gap_mm": template.gap_mm,
        "speed": template.speed,
        "density": template.density,
        "direction": template.direction,
        "reference_x": template.reference_x,
        "reference_y": template.reference_y,
        "shift_x": template.shift_x,
        "shift_y": template.shift_y,
        "copies_default": template.copies_default,
        "is_default": template.is_default,
        "is_system": template.is_system,
        "is_active": template.is_active,
        "tspl_template": template.tspl_template,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None,
    }


async def _load_label_template(db: AsyncSession, template_id: int) -> LabelTemplate:
    template = await db.get(LabelTemplate, template_id)
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Label template not found")
    return template


async def _clear_template_defaults(db: AsyncSession, target: str, keep_id: int) -> None:
    templates = (
        await db.scalars(
            select(LabelTemplate)
            .where(LabelTemplate.target == target)
        )
    ).all()
    for template in templates:
        template.is_default = template.id == keep_id
        if template.id == keep_id:
            template.is_active = True


async def _assign_replacement_default(db: AsyncSession, target: str) -> None:
    candidates = (
        await db.scalars(
            select(LabelTemplate)
            .where(LabelTemplate.is_active.is_(True))
            .where(LabelTemplate.target == target)
            .order_by(LabelTemplate.is_system.desc(), LabelTemplate.name.asc(), LabelTemplate.id.asc())
        )
    ).all()
    if not candidates and target != "both":
        candidates = (
            await db.scalars(
                select(LabelTemplate)
                .where(LabelTemplate.is_active.is_(True))
                .where(LabelTemplate.target == "both")
                .order_by(LabelTemplate.is_system.desc(), LabelTemplate.name.asc(), LabelTemplate.id.asc())
            )
        ).all()

    if not candidates:
        return

    replacement = candidates[0]
    replacement.is_default = True
    replacement.is_active = True


@router.get("/templates/meta")
async def get_label_template_meta(user: User = Depends(require_permission("print"))):
    return {
        "targets": ["item", "location", "both"],
        "dpis": [203, 300, 600],
        "supported_commands": supported_tspl_commands(),
        "variables": label_template_variables(),
    }


@router.get("/templates")
async def list_label_templates(
    target: str = Query("", description="Optional template target filter"),
    include_inactive: bool = Query(False),
    user: User = Depends(require_permission("print")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LabelTemplate)
    if target:
        if not is_valid_label_template_target(target):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid template target")
        stmt = stmt.where(LabelTemplate.target.in_([target, "both"]))
    if not include_inactive:
        stmt = stmt.where(LabelTemplate.is_active.is_(True))
    stmt = stmt.order_by(LabelTemplate.is_default.desc(), LabelTemplate.is_system.desc(), LabelTemplate.name.asc())
    templates = (await db.scalars(stmt)).all()
    return [_serialize_label_template(template) for template in templates]


@router.get("/templates/{template_id}")
async def get_label_template(
    template_id: int,
    user: User = Depends(require_permission("print")),
    db: AsyncSession = Depends(get_db),
):
    template = await _load_label_template(db, template_id)
    return _serialize_label_template(template)


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_label_template(
    body: LabelTemplatePayload,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if any(
        value is None
        for value in (
            body.name,
            body.target,
            body.dpi,
            body.width_mm,
            body.height_mm,
            body.gap_mm,
            body.speed,
            body.density,
            body.direction,
            body.copies_default,
            body.tspl_template,
        )
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing required fields")

    name = body.name.strip()
    description = nullable_trimmed_string(body.description)
    target = body.target.strip()
    tspl_template = normalize_multiline(body.tspl_template)

    try:
        validate_label_template_definition(
            name=name,
            target=target,
            dpi=body.dpi,
            width_mm=body.width_mm,
            height_mm=body.height_mm,
            gap_mm=body.gap_mm,
            speed=body.speed,
            density=body.density,
            direction=body.direction,
            copies_default=body.copies_default,
            tspl_template=tspl_template,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    template = LabelTemplate(
        name=name,
        description=description,
        target=target,
        dpi=body.dpi,
        width_mm=body.width_mm,
        height_mm=body.height_mm,
        gap_mm=body.gap_mm,
        speed=body.speed,
        density=body.density,
        direction=body.direction,
        reference_x=body.reference_x or 0,
        reference_y=body.reference_y or 0,
        shift_x=body.shift_x or 0,
        shift_y=body.shift_y or 0,
        copies_default=body.copies_default,
        is_default=bool(body.is_default),
        is_system=False,
        is_active=True if body.is_active is None else body.is_active,
        tspl_template=tspl_template,
    )
    db.add(template)
    await db.flush()

    if template.is_default:
        await _clear_template_defaults(db, target, template.id)

    await db.commit()
    await db.refresh(template)
    logger.info("[AUDIT] user=%d action=label_template.create template_id=%d", admin.id, template.id)
    return _serialize_label_template(template)


@router.put("/templates/{template_id}")
async def update_label_template(
    template_id: int,
    body: LabelTemplatePayload,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    template = await _load_label_template(db, template_id)
    old_target = template.target

    if body.name is not None:
        template.name = body.name.strip()
    if body.description is not None:
        template.description = nullable_trimmed_string(body.description)
    if body.target is not None:
        template.target = body.target.strip()
    if body.dpi is not None:
        template.dpi = body.dpi
    if body.width_mm is not None:
        template.width_mm = body.width_mm
    if body.height_mm is not None:
        template.height_mm = body.height_mm
    if body.gap_mm is not None:
        template.gap_mm = body.gap_mm
    if body.speed is not None:
        template.speed = body.speed
    if body.density is not None:
        template.density = body.density
    if body.direction is not None:
        template.direction = body.direction
    if body.reference_x is not None:
        template.reference_x = body.reference_x
    if body.reference_y is not None:
        template.reference_y = body.reference_y
    if body.shift_x is not None:
        template.shift_x = body.shift_x
    if body.shift_y is not None:
        template.shift_y = body.shift_y
    if body.copies_default is not None:
        template.copies_default = body.copies_default
    if body.is_default is not None:
        template.is_default = body.is_default
    if body.is_active is not None:
        template.is_active = body.is_active
    if body.tspl_template is not None:
        template.tspl_template = normalize_multiline(body.tspl_template)

    try:
        validate_label_template_definition(
            name=template.name,
            target=template.target,
            dpi=template.dpi,
            width_mm=template.width_mm,
            height_mm=template.height_mm,
            gap_mm=template.gap_mm,
            speed=template.speed,
            density=template.density,
            direction=template.direction,
            copies_default=template.copies_default,
            tspl_template=template.tspl_template,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    if old_target != template.target and template.is_default:
        old_target_templates = (
            await db.scalars(select(LabelTemplate).where(LabelTemplate.target == old_target))
        ).all()
        for old_template in old_target_templates:
            old_template.is_default = False

    if template.is_default:
        await _clear_template_defaults(db, template.target, template.id)

    await db.commit()
    await db.refresh(template)
    logger.info("[AUDIT] user=%d action=label_template.update template_id=%d", admin.id, template.id)
    return _serialize_label_template(template)


@router.post("/templates/{template_id}/default")
async def set_default_label_template(
    template_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    template = await _load_label_template(db, template_id)
    await _clear_template_defaults(db, template.target, template.id)
    await db.commit()
    await db.refresh(template)
    logger.info("[AUDIT] user=%d action=label_template.default template_id=%d", admin.id, template.id)
    return _serialize_label_template(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label_template(
    template_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    template = await _load_label_template(db, template_id)
    deleted_target = template.target
    deleted_was_default = template.is_default
    await db.delete(template)
    await db.flush()
    if deleted_was_default:
        await _assign_replacement_default(db, deleted_target)
    await db.commit()
    logger.info("[AUDIT] user=%d action=label_template.delete template_id=%d", admin.id, template.id)


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

    try:
        tspl, qr = await render_entity_tspl(db, realm, "item", item_id, copies=body.copies)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

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

    try:
        tspl, qr = await render_entity_tspl(db, realm, "location", location_id, copies=body.copies)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

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
async def calibrate_printer(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Send GAP calibration command. The printer feeds labels to detect the gap sensor."""
    try:
        tspl = await calibration_tspl(db)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
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
    db: AsyncSession = Depends(get_db),
):
    """Send a test print. Optionally with custom TSPL commands."""
    if body.tspl:
        tspl = body.tspl
    else:
        try:
            tspl = await render_preview_tspl(db, "archive", "item", 0, copies=1)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    success = await send_tspl(tspl)
    if not success:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Printer not reachable")
    return {"status": "printed", "tspl": tspl}


@router.get("/test/preview")
async def test_preview(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get the default test TSPL for preview."""
    try:
        tspl = await render_preview_tspl(db, "archive", "item", 0, copies=1)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
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

    logger.info("[AUDIT] user=%d action=config.printer", admin.id)
    return {"status": "updated"}

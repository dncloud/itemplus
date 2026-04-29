"""TSC thermal printer service — renders TSPL from stored label templates and sends via TCP."""

import asyncio
import logging
import re
from decimal import Decimal

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from itemplus.core.config import settings
from itemplus.models import LabelTemplate, archive, collection

logger = logging.getLogger(__name__)

_PRINT_LINE_RE = re.compile(r"(?im)^[ \t]*PRINT\b[^\r\n]*$")
_REALMS = {"archive": archive, "collection": collection}


def compact_qr(realm: str, entity_type: str, entity_id: int) -> str:
    """Generate compact QR code content."""
    prefix = "a" if realm == "archive" else "c"
    t = "i" if entity_type == "item" else "l"
    return f"itp://{prefix}/{t}/{entity_id:08d}"


def ensure_tspl_terminated(tspl: str) -> str:
    trimmed = tspl.rstrip("\r\n")
    if not trimmed:
        return "\n\r"
    return trimmed + "\n\r"


async def render_entity_tspl(db: AsyncSession, realm: str, entity_type: str, entity_id: int, copies: int = 1) -> tuple[str, str]:
    if realm not in _REALMS:
        raise ValueError("Invalid realm")
    if entity_type not in {"item", "location"}:
        raise ValueError("Invalid entity type")
    if entity_id <= 0:
        raise ValueError("Invalid entity ID")

    template = await _load_active_template(db, entity_type)
    variables, qr_content = await _load_variables(db, realm, entity_type, entity_id)
    rendered = _render_template(template.tspl_template, variables)
    rendered = _apply_copies(rendered, copies)
    return ensure_tspl_terminated(rendered), qr_content


async def render_preview_tspl(db: AsyncSession, realm: str = "archive", entity_type: str = "item", entity_id: int = 0, copies: int = 1) -> str:
    qr_content = compact_qr(realm, entity_type, entity_id)
    template = await _load_active_template(db, entity_type)
    variables = {
        "qr_content": qr_content,
        "realm": realm,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
    }
    rendered = _render_template(template.tspl_template, variables)
    return ensure_tspl_terminated(_apply_copies(rendered, copies))


async def calibration_tspl(db: AsyncSession, entity_type: str = "item") -> str:
    template = await _load_active_template(db, entity_type)
    return ensure_tspl_terminated(
        f"SIZE {template.width_mm} mm, {template.height_mm} mm\n"
        f"GAP {template.gap_mm:.1f} mm, 0 mm\n"
        "GAPDETECT"
    )


async def send_tspl(tspl: str) -> bool:
    """Send TSPL commands to printer via TCP."""
    host = settings.printer_host
    port = settings.printer_port

    if not host:
        logger.error("Printer host not configured")
        return False

    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=5.0,
        )

        payload = ensure_tspl_terminated(tspl).encode("cp1252", errors="replace")
        writer.write(payload)
        await writer.drain()

        await asyncio.sleep(0.5)

        writer.close()
        await writer.wait_closed()

        logger.info("TSPL sent to %s:%d (%d bytes)", host, port, len(payload))
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
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=5.0,
        )
        writer.write(b"~!@\n\r")
        await writer.drain()
        await asyncio.sleep(0.3)
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False


async def _load_active_template(db: AsyncSession, entity_type: str) -> LabelTemplate:
    target_priority = case((LabelTemplate.target == entity_type, 0), else_=1)
    stmt = (
        select(LabelTemplate)
        .where(LabelTemplate.is_active.is_(True))
        .where(LabelTemplate.target.in_([entity_type, "both"]))
        .order_by(target_priority, LabelTemplate.is_default.desc(), LabelTemplate.is_system.desc(), LabelTemplate.name.asc())
        .limit(1)
    )
    template = await db.scalar(stmt)
    if template is None:
        raise ValueError("No active label template found")
    return template


async def _load_variables(db: AsyncSession, realm: str, entity_type: str, entity_id: int) -> tuple[dict[str, str], str]:
    qr_content = compact_qr(realm, entity_type, entity_id)
    variables: dict[str, str] = {
        "qr_content": qr_content,
        "realm": realm,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
    }

    models = _REALMS[realm]
    if entity_type == "item":
        category = aliased(models.Category)
        location = aliased(models.Location)
        stmt = (
            select(
                models.Item.name,
                models.Item.description,
                category.name.label("category_name"),
                location.name.label("location_name"),
                models.Item.purchase_price,
                models.Item.purchase_currency,
            )
            .outerjoin(category, models.Item.category_id == category.id)
            .outerjoin(location, models.Item.location_id == location.id)
            .where(models.Item.id == entity_id)
        )
        row = (await db.execute(stmt)).mappings().first()
        if row is None:
            raise ValueError("Item not found")
        variables.update(
            {
                "item_name": row["name"] or "",
                "item_description": row["description"] or "",
                "category_name": row["category_name"] or "",
                "location_name": row["location_name"] or "",
                "purchase_price": _format_price(row["purchase_price"]),
                "purchase_currency": row["purchase_currency"] or "",
            }
        )
    else:
        parent = aliased(models.Location)
        stmt = (
            select(
                models.Location.name,
                models.Location.description,
                parent.name.label("parent_location_name"),
            )
            .outerjoin(parent, models.Location.parent_id == parent.id)
            .where(models.Location.id == entity_id)
        )
        row = (await db.execute(stmt)).mappings().first()
        if row is None:
            raise ValueError("Location not found")
        variables.update(
            {
                "location_name": row["name"] or "",
                "location_description": row["description"] or "",
                "parent_location_name": row["parent_location_name"] or "",
            }
        )

    return variables, qr_content


def _render_template(template: str, variables: dict[str, str]) -> str:
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", _escape_tspl_value(value))
    return rendered


def _apply_copies(tspl: str, copies: int) -> str:
    copies = max(1, copies)
    print_line = f"PRINT {copies}"
    if _PRINT_LINE_RE.search(tspl):
        return _PRINT_LINE_RE.sub(print_line, tspl)
    trimmed = tspl.rstrip("\r\n")
    if not trimmed:
        return print_line
    return trimmed + "\n" + print_line


def _escape_tspl_value(value: str) -> str:
    return (
        value.replace('"', r'[\"]')
        .replace("\r\n", " ")
        .replace("\n", " ")
        .replace("\r", " ")
    )


def _format_price(value: float | Decimal | None) -> str:
    if value is None:
        return ""
    return f"{float(value):.2f}"

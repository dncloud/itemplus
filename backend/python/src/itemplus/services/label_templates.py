from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.models import LabelTemplate


@dataclass(frozen=True)
class DefaultLabelTemplate:
    system_key: str
    name: str
    description: str
    target: str
    dpi: int
    width_mm: int
    height_mm: int
    gap_mm: float
    speed: int
    density: int
    direction: int
    reference_x: int
    reference_y: int
    shift_x: int
    shift_y: int
    copies_default: int
    is_default: bool
    tspl_template: str


def default_label_templates() -> list[DefaultLabelTemplate]:
    return [
        DefaultLabelTemplate(
            system_key="qr-only-20x20",
            name="QR only 20x20",
            description="Compact QR label for items and locations.",
            target="both",
            dpi=600,
            width_mm=20,
            height_mm=20,
            gap_mm=3.0,
            speed=4,
            density=8,
            direction=1,
            reference_x=0,
            reference_y=0,
            shift_x=0,
            shift_y=0,
            copies_default=1,
            is_default=True,
            tspl_template=normalize_multiline(
                """
SIZE 20 mm,20 mm
GAP 3 mm,0 mm
SPEED 4
DENSITY 8
DIRECTION 1
CODEPAGE 1252
CLS
QRCODE 55,55,H,13,A,0,M2,"{{qr_content}}"
PRINT 1
"""
            ),
        )
    ]


def label_template_variables() -> list[dict[str, str]]:
    return [
        {"key": "qr_content", "label": "QR content", "target": "both", "description": "Final QR payload for the selected entity."},
        {"key": "realm", "label": "Realm", "target": "both", "description": "Entity realm: archive or collection."},
        {"key": "entity_type", "label": "Entity type", "target": "both", "description": "Entity type: item or location."},
        {"key": "entity_id", "label": "Entity ID", "target": "both", "description": "Numeric ID of the selected entity."},
        {"key": "item_name", "label": "Item name", "target": "item", "description": "Display name of the selected item."},
        {"key": "item_description", "label": "Item description", "target": "item", "description": "Description of the selected item."},
        {"key": "category_name", "label": "Category name", "target": "item", "description": "Category name of the selected item."},
        {"key": "location_name", "label": "Location name", "target": "both", "description": "Resolved location name."},
        {"key": "purchase_price", "label": "Purchase price", "target": "item", "description": "Formatted purchase price."},
        {"key": "purchase_currency", "label": "Purchase currency", "target": "item", "description": "Purchase currency code."},
        {"key": "location_description", "label": "Location description", "target": "location", "description": "Description of the selected location."},
        {"key": "parent_location_name", "label": "Parent location name", "target": "location", "description": "Parent location name, if present."},
    ]


def supported_tspl_commands() -> list[str]:
    return [
        "SIZE",
        "GAP",
        "SPEED",
        "DENSITY",
        "DIRECTION",
        "CODEPAGE",
        "REFERENCE",
        "SHIFT",
        "CLS",
        "TEXT",
        "BAR",
        "BOX",
        "QRCODE",
        "PRINT",
    ]


def is_valid_label_template_target(target: str) -> bool:
    return target in {"item", "location", "both"}


def is_valid_label_template_dpi(dpi: int) -> bool:
    return dpi in {203, 300, 600}


def validate_label_template_definition(
    *,
    name: str,
    target: str,
    dpi: int,
    width_mm: int,
    height_mm: int,
    gap_mm: float,
    speed: int,
    density: int,
    direction: int,
    copies_default: int,
    tspl_template: str,
) -> None:
    if not name.strip():
        raise ValueError("Template name is required")
    if not is_valid_label_template_target(target):
        raise ValueError("Invalid template target")
    if not is_valid_label_template_dpi(dpi):
        raise ValueError("DPI must be one of 203, 300, or 600")
    if width_mm < 10 or width_mm > 200:
        raise ValueError("Width must be between 10 and 200 mm")
    if height_mm < 10 or height_mm > 200:
        raise ValueError("Height must be between 10 and 200 mm")
    if gap_mm < 0 or gap_mm > 20:
        raise ValueError("Gap must be between 0 and 20 mm")
    if speed < 1 or speed > 15:
        raise ValueError("Speed must be between 1 and 15")
    if density < 0 or density > 15:
        raise ValueError("Density must be between 0 and 15")
    if direction not in {0, 1}:
        raise ValueError("Direction must be 0 or 1")
    if copies_default < 1 or copies_default > 999_999_999:
        raise ValueError("Copies default must be between 1 and 999999999")
    if not tspl_template.strip():
        raise ValueError("TSPL template is required")
    if len(tspl_template) > 64 * 1024:
        raise ValueError("TSPL template is too large")


def normalize_multiline(value: str) -> str:
    return value.replace("\r\n", "\n").strip()


def nullable_trimmed_string(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


async def ensure_default_label_templates(db: AsyncSession) -> None:
    defaults = default_label_templates()
    allowed_keys = [tpl.system_key for tpl in defaults]

    await db.execute(
        update(LabelTemplate)
        .where(LabelTemplate.is_system.is_(True))
        .where(LabelTemplate.tspl_template.contains("PRINT {{copies}}"))
        .values(tspl_template=func.replace(LabelTemplate.tspl_template, "PRINT {{copies}}", "PRINT 1"))
    )

    if allowed_keys:
        await db.execute(
            delete(LabelTemplate)
            .where(LabelTemplate.is_system.is_(True))
            .where(LabelTemplate.system_key.not_in(allowed_keys))
        )

    for default in defaults:
        existing = await db.scalar(select(LabelTemplate).where(LabelTemplate.system_key == default.system_key))
        if existing:
            continue
        db.add(
            LabelTemplate(
                system_key=default.system_key,
                name=default.name,
                description=default.description,
                target=default.target,
                dpi=default.dpi,
                width_mm=default.width_mm,
                height_mm=default.height_mm,
                gap_mm=default.gap_mm,
                speed=default.speed,
                density=default.density,
                direction=default.direction,
                reference_x=default.reference_x,
                reference_y=default.reference_y,
                shift_x=default.shift_x,
                shift_y=default.shift_y,
                copies_default=default.copies_default,
                is_default=default.is_default,
                is_system=True,
                is_active=True,
                tspl_template=default.tspl_template,
            )
        )

    await db.commit()

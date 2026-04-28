"""Admin routes: DB export/import/wipe.

BEWARE: These endpoints are powerful and dangerous. They are NOT exposed in the
WebApp UI — they exist only for direct API access (e.g. migration scripts, cronjobs).

- /admin/export — Dumps the entire database as JSON. Contains ALL data.
- /admin/import — Overwrites the database with a JSON dump. Can wipe existing data.
- /admin/wipe   — Deletes ALL items, categories, locations, etc. Users are kept.

All endpoints require admin authentication. Use with extreme caution.
"""

import logging
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.database import Base, engine, get_db
from itemplus.core.dependencies import get_current_admin
from itemplus.core.version import load_shared_version
from itemplus.models import archive, collection
from itemplus.models import AppSetting
from itemplus.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

_realms = {"archive": archive, "collection": collection}


def _serialize(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, date):
        return val.isoformat()
    return val


def _rows_to_dicts(rows) -> list[dict]:
    return [{c.name: _serialize(getattr(r, c.name)) for c in r.__table__.columns} for r in rows]


def _require_import_confirm(wipe_first: bool, confirm: str | None) -> None:
    if wipe_first and confirm != "IMPORT":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Must confirm destructive import with 'IMPORT'")


@router.get("/export")
async def export_db(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """BEWARE: Export entire database as JSON dump. Contains ALL data."""
    data: dict[str, Any] = {"version": load_shared_version()}

    # Users
    users = (await db.scalars(select(User))).all()
    data["users"] = _rows_to_dicts(users)

    app_settings = (await db.scalars(select(AppSetting))).all()
    data["app_settings"] = _rows_to_dicts(app_settings)

    # Per realm
    for realm_name, models in _realms.items():
        realm_data: dict[str, Any] = {}
        for entity_name, model in [
            ("categories", models.Category),
            ("properties", models.Property),
            ("locations", models.Location),
            ("items", models.Item),
            ("item_properties", models.ItemProperty),
            ("attachments", models.Attachment),
            ("checkouts", models.Checkout),
            ("manufacturers", models.Manufacturer),
            ("suppliers", models.Supplier),
            ("vendors", models.Vendor),
        ]:
            rows = (await db.scalars(select(model))).all()
            realm_data[entity_name] = _rows_to_dicts(rows)
        data[realm_name] = realm_data

    return JSONResponse(content=data)


class ImportRequest(BaseModel):
    data: dict[str, Any]
    wipe_first: bool = True
    confirm: str | None = None


class WipeRequest(BaseModel):
    confirm: str


@router.post("/import")
async def import_db(
    body: ImportRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """BEWARE: Import a JSON dump. With wipe_first=true this DESTROYS all existing data."""
    data = body.data

    logger.info("[AUDIT] admin=%d started database import (wipe_first=%s)", admin.id, body.wipe_first)

    _require_import_confirm(body.wipe_first, body.confirm)

    if body.wipe_first:
        # Delete all data in reverse dependency order
        for realm_name, models in _realms.items():
            for model in [models.ItemProperty, models.Attachment, models.Checkout,
                          models.Item, models.Property, models.Location,
                          models.Category, models.Manufacturer, models.Supplier, models.Vendor]:
                await db.execute(model.__table__.delete())
        await db.commit()

    counts: dict[str, int] = {}

    settings_rows = data.get("app_settings", [])
    if settings_rows:
        await db.execute(AppSetting.__table__.delete())
        for row in settings_rows:
            cleaned = {k: v for k, v in row.items() if v is not None}
            db.add(AppSetting(**cleaned))
        counts["app_settings"] = len(settings_rows)
        await db.commit()

    # Import per realm — order matters for foreign keys
    for realm_name, models in _realms.items():
        realm_data = data.get(realm_name, {})

        import_order = [
            ("categories", models.Category),
            ("locations", models.Location),
            ("manufacturers", models.Manufacturer),
            ("suppliers", models.Supplier),
            ("vendors", models.Vendor),
            ("properties", models.Property),
            ("items", models.Item),
            ("item_properties", models.ItemProperty),
            ("attachments", models.Attachment),
            ("checkouts", models.Checkout),
        ]

        for entity_name, model in import_order:
            rows = realm_data.get(entity_name, [])
            for row in rows:
                # Remove None values and let DB set defaults
                cleaned = {k: v for k, v in row.items() if v is not None}
                db.add(model(**cleaned))
            key = f"{realm_name}.{entity_name}"
            counts[key] = len(rows)

        await db.commit()

    return {"status": "ok", "imported": counts}


@router.post("/wipe")
async def wipe_db(body: WipeRequest, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """BEWARE: Irreversibly DELETES all items, categories, locations, vendors, checkouts. Users are kept."""
    if body.confirm != "WIPE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Must confirm with 'WIPE'")
    logger.info("[AUDIT] admin=%d initiated database wipe", admin.id)
    for realm_name, models in _realms.items():
        for model in [models.ItemProperty, models.Attachment, models.Checkout,
                      models.Item, models.Property, models.Location,
                      models.Category, models.Manufacturer, models.Supplier, models.Vendor]:
            await db.execute(model.__table__.delete())
    await db.commit()
    return {"status": "wiped"}


@router.get("/health/locations")
async def check_location_health(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Check for self-parenting and circular references in locations."""
    issues: list[dict] = []
    total_checked = 0

    for realm_name, models in _realms.items():
        locations = (await db.scalars(select(models.Location))).all()
        loc_map = {l.id: l for l in locations}
        total_checked += len(locations)

        for loc in locations:
            # Self-parenting
            if loc.parent_id == loc.id:
                issues.append({"realm": realm_name, "id": loc.id, "name": loc.name, "type": "self_parent"})
                continue

            # Cycle detection — walk parent chain
            if loc.parent_id:
                visited = set()
                current = loc.parent_id
                while current:
                    if current == loc.id:
                        issues.append({"realm": realm_name, "id": loc.id, "name": loc.name, "type": "cycle"})
                        break
                    if current in visited:
                        break
                    visited.add(current)
                    parent = loc_map.get(current)
                    current = parent.parent_id if parent else None

    return {"issues": issues, "total_checked": total_checked}


@router.post("/health/locations/fix")
async def fix_location_health(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Fix location hierarchy issues by removing problematic parent_id."""
    fixed = 0

    for realm_name, models in _realms.items():
        locations = (await db.scalars(select(models.Location))).all()
        loc_map = {l.id: l for l in locations}

        for loc in locations:
            should_fix = False

            # Self-parenting
            if loc.parent_id == loc.id:
                should_fix = True

            # Cycle detection
            elif loc.parent_id:
                visited = set()
                current = loc.parent_id
                while current:
                    if current == loc.id:
                        should_fix = True
                        break
                    if current in visited:
                        break
                    visited.add(current)
                    parent = loc_map.get(current)
                    current = parent.parent_id if parent else None

            if should_fix:
                loc.parent_id = None
                fixed += 1

    await db.commit()
    return {"fixed": fixed}

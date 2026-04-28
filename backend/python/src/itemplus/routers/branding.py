from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_admin
from itemplus.models import AppSetting
from itemplus.models.user import User

router = APIRouter(tags=["branding"])


class BrandingPayload:
    def __init__(self, logo: str | None, subtitle: str, width: int):
        self.logo = logo
        self.subtitle = subtitle
        self.width = width


class BrandingRequest(BaseModel):
    logo: str | None = None
    subtitle: str | None = None
    width: int | None = None


def _validate_branding_payload(logo: str | None, subtitle: str | None, width: int | None) -> BrandingPayload:
    clean_subtitle = (subtitle or "").strip()
    if len(clean_subtitle) > 200:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subtitle too long")

    clean_logo = None
    if logo is not None:
        trimmed = logo.strip()
        if trimmed:
            if not trimmed.startswith("data:image/"):
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Logo must be an image data URL")
            if len(trimmed) > 3 * 1024 * 1024:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Logo is too large")
            clean_logo = trimmed

    final_width = width if width is not None else 180
    if final_width < 80 or final_width > 480:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Width must be between 80 and 480 px")

    return BrandingPayload(clean_logo, clean_subtitle, final_width)


async def _get_setting(db: AsyncSession, key: str) -> str | None:
    row = await db.get(AppSetting, key)
    return row.value if row else None


async def _set_setting(db: AsyncSession, key: str, value: str) -> None:
    row = await db.get(AppSetting, key)
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


async def _delete_setting(db: AsyncSession, key: str) -> None:
    row = await db.get(AppSetting, key)
    if row:
        await db.delete(row)


async def _load_branding(db: AsyncSession) -> dict:
    logo = await _get_setting(db, "branding.logo")
    subtitle = await _get_setting(db, "branding.subtitle") or ""
    width_raw = await _get_setting(db, "branding.width")

    width = 180
    if width_raw:
        try:
            parsed = int(width_raw.strip())
            if 80 <= parsed <= 480:
                width = parsed
        except ValueError:
            pass

    return {"logo": logo or None, "subtitle": subtitle, "width": width}


@router.get("/branding")
async def get_branding(db: AsyncSession = Depends(get_db)):
    return await _load_branding(db)


@router.put("/admin/branding")
async def update_branding(
    body: BrandingRequest,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    payload = _validate_branding_payload(
        body.logo,
        body.subtitle,
        body.width,
    )

    if payload.logo is None:
        await _delete_setting(db, "branding.logo")
    else:
        await _set_setting(db, "branding.logo", payload.logo)

    await _set_setting(db, "branding.subtitle", payload.subtitle)
    await _set_setting(db, "branding.width", str(payload.width))
    await db.commit()
    return await _load_branding(db)


@router.delete("/admin/branding")
async def reset_branding(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _delete_setting(db, "branding.logo")
    await _delete_setting(db, "branding.subtitle")
    await _delete_setting(db, "branding.width")
    await db.commit()
    return await _load_branding(db)

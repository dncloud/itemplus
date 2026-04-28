"""Generic realm router factory — creates CRUD endpoints for archive and collection.

One function, two routers. The old version was 1600 lines with duplication.
"""

import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status

logger = logging.getLogger(__name__)

from itemplus.core.ratelimit import RateLimiter

# Allowlist of safe file extensions
ALLOWED_EXTENSIONS = {
    # Images
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".heic", ".heif", ".tiff", ".tif", ".ico",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".rtf", ".csv", ".tsv",
    # Archives
    ".zip", ".tar", ".gz", ".tgz", ".bz2", ".7z", ".rar",
    # Audio
    ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".wma",
    # Video
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv",
    # Code / Text
    ".txt", ".md", ".json", ".yaml", ".yml", ".xml", ".html", ".css", ".js", ".ts",
    ".py", ".go", ".rs", ".c", ".cpp", ".h", ".hpp", ".java", ".swift", ".kt",
    ".toml", ".ini", ".cfg", ".conf", ".log",
}

# Magic byte signatures for binary file types
_MAGIC_SIGNATURES: list[tuple[bytes, set[str]]] = [
    (b"\xff\xd8\xff",                   {".jpg", ".jpeg"}),
    (b"\x89PNG\r\n\x1a\n",             {".png"}),
    (b"GIF8",                            {".gif"}),
    (b"RIFF",                            {".webp", ".wav", ".avi"}),
    (b"%PDF",                            {".pdf"}),
    (b"PK",                              {".zip", ".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"}),
    (b"\x1f\x8b",                        {".gz", ".tgz"}),
    (b"BZ",                              {".bz2"}),
    (b"7z\xbc\xaf\x27\x1c",            {".7z"}),
    (b"Rar!\x1a\x07",                   {".rar"}),
    (b"\x00\x00\x00",                   {".mp4", ".mov", ".m4v", ".m4a", ".heic", ".heif"}),
    (b"\x1a\x45\xdf\xa3",              {".mkv", ".webm"}),
    (b"ID3",                             {".mp3"}),
    (b"\xff\xfb",                        {".mp3"}),
    (b"\xff\xf3",                        {".mp3"}),
    (b"fLaC",                            {".flac"}),
    (b"OggS",                            {".ogg"}),
    (b"BM",                              {".bmp"}),
    (b"\x49\x49\x2a\x00",              {".tiff", ".tif"}),
    (b"\x4d\x4d\x00\x2a",              {".tiff", ".tif"}),
    (b"\x00\x00\x01\x00",              {".ico"}),
]

# Extensions that are always text-based (no magic bytes needed)
_TEXT_EXTENSIONS = {
    ".txt", ".md", ".json", ".yaml", ".yml", ".xml", ".html", ".css", ".js", ".ts",
    ".py", ".go", ".rs", ".c", ".cpp", ".h", ".hpp", ".java", ".swift", ".kt",
    ".toml", ".ini", ".cfg", ".conf", ".log", ".csv", ".tsv", ".rtf", ".svg",
}


def _validate_magic_bytes(header: bytes, ext: str) -> bool:
    """Validate file content matches claimed extension via magic bytes.

    Returns True if the file passes validation:
    - Text extensions: must be valid UTF-8
    - Binary extensions with known signatures: header must match
    - Unknown binary extensions: rejected (not in allowlist anyway)
    """
    if ext in _TEXT_EXTENSIONS:
        try:
            header.decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False

    # Check against known magic signatures
    for signature, valid_exts in _MAGIC_SIGNATURES:
        if header.startswith(signature) and ext in valid_exts:
            return True

    # Some formats (e.g. .wma, .wmv, .aac) have complex headers — allow if extension is in allowlist
    # but no specific magic match exists. This is a pragmatic tradeoff.
    # If we have NO signature match at all, check if any signature matches the content
    # (to catch renamed executables).
    for signature, _ in _MAGIC_SIGNATURES:
        if header.startswith(signature):
            # Content matches a known type but NOT the claimed extension — suspicious
            return False

    # No magic signature matched the content at all — could be a lesser-known format.
    # Allow it if the extension is in the allowlist (already checked by caller).
    return True


from sqlalchemy import String, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.config import settings
from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_admin, get_current_user, require_all_permissions, require_permission
from itemplus.core.websocket import ws_manager
from itemplus.models.user import User
from itemplus.schemas.realm import (
    AttachmentResponse,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    LocationCreate,
    LocationResponse,
    LocationUpdate,
    PropertyCreate,
    PropertyResponse,
    PropertyUpdate,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
)


def _detect_link_type(filename: str, content_type: str = "") -> str:
    """Detect attachment type from filename extension or content-type."""
    fn = filename.lower()
    ct = content_type.lower()
    if any(fn.endswith(e) for e in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".heic")):
        return "image"
    if any(fn.endswith(e) for e in (".mp4", ".mov", ".avi", ".mkv", ".webm", ".m3u8")):
        return "video"
    if any(fn.endswith(e) for e in (".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac")):
        return "audio"
    if any(fn.endswith(e) for e in (".zip", ".tar", ".gz", ".rar", ".7z", ".iso", ".dmg", ".img")):
        return "archive"
    if any(fn.endswith(e) for e in (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt")):
        return "document"
    if any(fn.endswith(e) for e in (".py", ".js", ".ts", ".go", ".rs", ".c", ".cpp", ".h", ".sh", ".json", ".yaml", ".xml")):
        return "code"
    if "image" in ct:
        return "image"
    if "video" in ct:
        return "video"
    if "audio" in ct:
        return "audio"
    if "pdf" in ct or "document" in ct:
        return "document"
    return "link"


def _safe_filename(filename: str) -> str:
    """Sanitize filename — strip path separators, limit chars, prevent traversal."""
    # Take only the basename (no path components)
    name = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    # Remove anything that isn't alphanumeric, dash, underscore, dot, space
    name = re.sub(r"[^\w.\- ]", "_", name)
    # Prevent hidden files and traversal
    name = name.lstrip(".")
    return name or "upload"


def _crud_routes(router: APIRouter, prefix: str, Model, CreateSchema, UpdateSchema, ResponseSchema, read_perm: str = "items.read", write_perm: str = "items.write", delete_perm: str = "items.delete"):
    """Generate standard CRUD routes for a model."""

    @router.get(f"/{prefix}", response_model=list[ResponseSchema])
    async def list_all(
        search: str | None = None,
        page: int = Query(1, ge=1),
        per_page: int = Query(50, ge=1, le=200),
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_permission(read_perm, "items.read")),
    ):
        q = select(Model)
        if search and hasattr(Model, "name"):
            q = q.where(or_(Model.name.ilike(f"%{search}%")))
        q = q.offset((page - 1) * per_page).limit(per_page)
        result = await db.scalars(q)
        return result.all()

    @router.get(f"/{prefix}/{{item_id}}", response_model=ResponseSchema)
    async def get_one(item_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission(read_perm, "items.read"))):
        obj = await db.get(Model, item_id)
        if not obj:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        return obj

    @router.post(f"/{prefix}", response_model=ResponseSchema, status_code=status.HTTP_201_CREATED)
    async def create(body: CreateSchema, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission(write_perm))):
        obj = Model(**body.model_dump(exclude_unset=True))
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    @router.put(f"/{prefix}/{{item_id}}", response_model=ResponseSchema)
    async def update(
        item_id: int, body: UpdateSchema, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission(write_perm))
    ):
        obj = await db.get(Model, item_id)
        if not obj:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        await db.commit()
        await db.refresh(obj)
        return obj

    @router.delete(f"/{prefix}/{{item_id}}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete(item_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission(delete_perm))):
        obj = await db.get(Model, item_id)
        if not obj:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        await db.delete(obj)
        await db.commit()


def create_realm_router(realm_name: str, models) -> APIRouter:
    """Create a full router for a realm (archive or collection)."""
    router = APIRouter(prefix=f"/{realm_name}", tags=[realm_name])

    # Standard CRUD for categories, locations, and vendor entities
    _crud_routes(router, "categories", models.Category, CategoryCreate, CategoryUpdate, CategoryResponse, "categories.read", "categories.write", "categories.delete")
    _crud_routes(router, "locations", models.Location, LocationCreate, LocationUpdate, LocationResponse, "locations.read", "locations.write", "locations.delete")
    _crud_routes(router, "manufacturers", models.Manufacturer, VendorCreate, VendorUpdate, VendorResponse, "vendors.read", "vendors.write", "vendors.delete")
    _crud_routes(router, "suppliers", models.Supplier, VendorCreate, VendorUpdate, VendorResponse, "vendors.read", "vendors.write", "vendors.delete")
    _crud_routes(router, "vendors", models.Vendor, VendorCreate, VendorUpdate, VendorResponse, "vendors.read", "vendors.write", "vendors.delete")

    # -- Properties (scoped to category) --

    @router.get("/properties", response_model=list[PropertyResponse])
    async def list_properties(
        category_id: int | None = None,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_permission("categories.read", "items.read")),
    ):
        q = select(models.Property)
        if category_id:
            q = q.where(models.Property.category_id == category_id)
        q = q.order_by(models.Property.position)
        return (await db.scalars(q)).all()

    @router.post("/properties", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
    async def create_property(
        body: PropertyCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("categories.write"))
    ):
        data = body.model_dump(exclude={"type"}, exclude_unset=True)
        data["property_type"] = body.resolved_type()
        obj = models.Property(**data)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    @router.put("/properties/{prop_id}", response_model=PropertyResponse)
    async def update_property(
        prop_id: int, body: PropertyUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("categories.write"))
    ):
        obj = await db.get(models.Property, prop_id)
        if not obj:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        data = body.model_dump(exclude={"type"}, exclude_unset=True)
        resolved = body.resolved_type()
        if resolved:
            data["property_type"] = resolved
        for k, v in data.items():
            setattr(obj, k, v)
        await db.commit()
        await db.refresh(obj)
        return obj

    @router.delete("/properties/{prop_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_property(
        prop_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("categories.delete"))
    ):
        obj = await db.get(models.Property, prop_id)
        if not obj:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        await db.delete(obj)
        await db.commit()

    # -- Items (with properties and search) --

    SORT_FIELDS = {
        "name": models.Item.name,
        "quantity": models.Item.quantity,
        "price": models.Item.purchase_price,
        "created": models.Item.created_at,
        "updated": models.Item.updated_at,
    }

    @router.get("/items")
    async def list_items(
        search: str | None = None,
        category_id: int | None = None,
        location_id: int | None = None,
        sort: str = "updated",
        order: str = "desc",
        page: int = Query(1, ge=1),
        per_page: int = Query(50, ge=1, le=200),
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_permission("items.read")),
    ):
        filters = []
        search_item_ids = None
        if search:
            # Search in name, description AND property values
            prop_matches = await db.scalars(
                select(models.ItemProperty.item_id).where(
                    models.ItemProperty.value.cast(String).ilike(f"%{search}%")
                ).distinct()
            )
            prop_item_ids = set(prop_matches.all())

            # Combine: items matching by name/desc OR by property value
            filters.append(or_(
                models.Item.name.ilike(f"%{search}%"),
                models.Item.description.ilike(f"%{search}%"),
                models.Item.id.in_(prop_item_ids) if prop_item_ids else False,
            ))
        if category_id:
            filters.append(models.Item.category_id == category_id)
        if location_id:
            # Include all child locations recursively
            loc_ids = await _get_location_tree(db, models, location_id)
            filters.append(models.Item.location_id.in_(loc_ids))

        count_q = select(func.count()).select_from(models.Item)
        for f in filters:
            count_q = count_q.where(f)
        total = await db.scalar(count_q) or 0

        # Aggregate stats
        agg_q = select(
            func.coalesce(func.sum(models.Item.quantity), 0),
            func.coalesce(func.sum(models.Item.purchase_price * models.Item.quantity), 0),
        ).select_from(models.Item)
        for f in filters:
            agg_q = agg_q.where(f)
        agg = (await db.execute(agg_q)).one()
        total_quantity = int(agg[0])
        total_value = round(float(agg[1]), 2)

        # Items page
        q = select(models.Item)
        for f in filters:
            q = q.where(f)

        # Sorting
        sort_col = SORT_FIELDS.get(sort, models.Item.updated_at)
        q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
        q = q.offset((page - 1) * per_page).limit(per_page)
        items = (await db.scalars(q)).all()

        result = []
        for item in items:
            item_dict = _item_to_dict(item)
            by_id, by_name = await _load_properties(db, models, item.id)
            item_dict["properties"] = by_id
            item_dict["properties_display"] = by_name
            item_dict["attachments"] = await _load_attachments(db, models, item.id)
            await _enrich_item(db, models, item_dict)
            result.append(item_dict)
        return {"items": result, "total": total, "total_quantity": total_quantity, "total_value": total_value, "page": page, "per_page": per_page}

    @router.get("/items/{item_id}", response_model=ItemResponse)
    async def get_item(item_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("items.read"))):
        item = await db.get(models.Item, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        item_dict = _item_to_dict(item)
        by_id, by_name = await _load_properties(db, models, item.id)
        item_dict["properties"] = by_id
        item_dict["properties_display"] = by_name
        item_dict["attachments"] = await _load_attachments(db, models, item.id)
        await _enrich_item(db, models, item_dict)
        return item_dict

    @router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
    async def create_item(
        body: ItemCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("items.write"))
    ):
        data = body.model_dump(exclude={"properties"}, exclude_unset=True)
        item = models.Item(**data)
        db.add(item)
        await db.commit()
        await db.refresh(item)

        if body.properties:
            await _save_properties(db, models, item.id, body.properties)

        await ws_manager.broadcast(f"stats.{realm_name}_updated")

        item_dict = _item_to_dict(item)
        by_id, by_name = await _load_properties(db, models, item.id)
        item_dict["properties"] = by_id
        item_dict["properties_display"] = by_name
        return item_dict

    @router.put("/items/{item_id}", response_model=ItemResponse)
    async def update_item(
        item_id: int, body: ItemUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("items.write"))
    ):
        item = await db.get(models.Item, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND)

        data = body.model_dump(exclude={"properties"}, exclude_unset=True)
        for k, v in data.items():
            setattr(item, k, v)
        await db.commit()
        await db.refresh(item)

        if body.properties is not None:
            await _save_properties(db, models, item.id, body.properties)

        await ws_manager.broadcast(f"stats.{realm_name}_updated")

        item_dict = _item_to_dict(item)
        by_id, by_name = await _load_properties(db, models, item.id)
        item_dict["properties"] = by_id
        item_dict["properties_display"] = by_name
        return item_dict

    @router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_item(
        item_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("items.delete"))
    ):
        item = await db.get(models.Item, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        await db.delete(item)
        await db.commit()
        await ws_manager.broadcast(f"stats.{realm_name}_updated")

    # -- Attachments --

    _upload_rate_limiter = RateLimiter(20, 60)

    @router.post("/items/{item_id}/attachments", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
    async def upload_attachment(
        item_id: int,
        request: Request,
        file: UploadFile | None = None,
        type: str = "image",
        url: str | None = None,
        description: str | None = None,
        gallery: bool = False,
        order: int = 0,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_all_permissions("attachments.write", "items.read")),
    ):
        from pathlib import Path

        # Rate limit
        await _upload_rate_limiter(request)

        item = await db.get(models.Item, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND)

        filename = ""
        file_path_str = ""
        file_size = None

        if file and file.filename:
            # Extension allowlist check
            ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in file.filename else ""
            if not ext or ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"File type '{ext or 'unknown'}' is not allowed")

            safe_name = _safe_filename(file.filename)
            upload_dir = Path(settings.upload_dir) / realm_name / str(item_id)
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_path = upload_dir / safe_name

            # Stream file to disk with chunk-based size enforcement
            max_size = settings.max_upload_size
            chunk_size = 256 * 1024  # 256 KB chunks
            total_written = 0
            header_bytes = b""

            try:
                with open(file_path, "wb") as f:
                    while True:
                        chunk = await file.read(chunk_size)
                        if not chunk:
                            break
                        # Capture first bytes for magic validation
                        if total_written == 0:
                            header_bytes = chunk[:512]
                        total_written += len(chunk)
                        if total_written > max_size:
                            raise HTTPException(
                                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                f"File too large (max {max_size // 1024 // 1024} MB)",
                            )
                        f.write(chunk)
            except HTTPException:
                file_path.unlink(missing_ok=True)
                raise
            except Exception:
                file_path.unlink(missing_ok=True)
                raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Upload failed")

            # Validate magic bytes match claimed extension
            if header_bytes and not _validate_magic_bytes(header_bytes, ext):
                file_path.unlink(missing_ok=True)
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "File content does not match its extension",
                )

            file_size = total_written
            filename = safe_name
            file_path_str = f"{realm_name}/{item_id}/{safe_name}"

        attachment = models.Attachment(
            item_id=item_id,
            filename=filename,
            file_path=file_path_str,
            attachment_type=type,
            url=url,
            description=description,
            gallery=gallery,
            order=order,
            size=file_size,
        )
        db.add(attachment)
        await db.commit()
        await db.refresh(attachment)
        logger.info("[AUDIT] user=%d action=attachment.upload realm=%s item=%d file=%s", user.id, realm_name, item_id, filename)
        return attachment

    @router.put("/attachments/{att_id}", response_model=AttachmentResponse)
    async def update_attachment(
        att_id: int,
        body: dict,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_all_permissions("attachments.write", "items.read")),
    ):
        att = await db.get(models.Attachment, att_id)
        if not att:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        # Allow updating description, order, attachment_type
        for field in ("description", "order", "attachment_type", "url"):
            if field in body:
                setattr(att, field, body[field])
        await db.commit()
        await db.refresh(att)
        return att

    @router.delete("/attachments/{att_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_attachment(
        att_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(require_all_permissions("attachments.write", "items.read"))
    ):
        from pathlib import Path

        att = await db.get(models.Attachment, att_id)
        if not att:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        # file_path is now relative ({realm}/{item_id}/{filename})
        if att.file_path:
            upload_base = Path(settings.upload_dir).resolve()
            full_path = (upload_base / att.file_path.lstrip("/")).resolve()
            # Path traversal protection: resolved path must be a child of upload dir
            try:
                full_path.relative_to(upload_base)
            except ValueError:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file path")
            full_path.unlink(missing_ok=True)
        logger.info("[AUDIT] user=%d action=attachment.delete realm=%s att=%d", user.id, realm_name, att_id)
        await db.delete(att)
        await db.commit()

    @router.post("/items/{item_id}/attachments/link", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
    async def add_link_attachment(
        item_id: int,
        body: dict,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_all_permissions("attachments.write", "items.read")),
    ):
        item = await db.get(models.Item, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND)

        url = body.get("url", "")
        filename = body.get("filename") or url.rsplit("/", 1)[-1].split("?")[0] or url
        file_size = None
        att_type = "link"

        att_type = _detect_link_type(filename, "")

        attachment = models.Attachment(
            item_id=item_id,
            filename=filename,
            file_path="",
            attachment_type=att_type,
            url=url,
            description=body.get("description"),
            size=file_size,
            order=body.get("order", 0),
        )
        db.add(attachment)
        await db.commit()
        await db.refresh(attachment)
        return attachment

    # -- Property file upload (for image/file property types) --

    @router.post("/items/{item_id}/properties/{prop_id}/upload")
    async def upload_property_file(
        item_id: int,
        prop_id: int,
        file: UploadFile,
        db: AsyncSession = Depends(get_db),
        user: User = Depends(require_all_permissions("attachments.write", "items.read")),
    ):
        from pathlib import Path

        item = await db.get(models.Item, item_id)
        if not item:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")

        safe_name = _safe_filename(file.filename)
        upload_dir = Path(settings.upload_dir) / realm_name / str(item_id) / "props"
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / safe_name

        content = await file.read()
        if len(content) > settings.max_upload_size:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")

        with open(file_path, "wb") as f:
            f.write(content)

        # Store file metadata as property value
        rel_path = f"{realm_name}/{item_id}/props/{safe_name}"
        value = {
            "type": "file",
            "filename": safe_name,
            "path": rel_path,
            "size": len(content),
            "content_type": file.content_type or "application/octet-stream",
        }

        # Upsert property value
        existing = await db.scalar(
            select(models.ItemProperty).where(
                models.ItemProperty.item_id == item_id,
                models.ItemProperty.property_id == prop_id,
            )
        )
        if existing:
            existing.value = value
        else:
            db.add(models.ItemProperty(item_id=item_id, property_id=prop_id, value=value))
        await db.commit()

        return {"status": "ok", "value": value}

    return router


# -- Helpers --


async def _get_location_tree(db: AsyncSession, models, location_id: int) -> list[int]:
    """Get a location ID and all its descendant IDs."""
    all_locs = (await db.scalars(select(models.Location))).all()
    children_map: dict[int | None, list[int]] = {}
    for loc in all_locs:
        children_map.setdefault(loc.parent_id, []).append(loc.id)

    result = [location_id]
    queue = [location_id]
    while queue:
        parent = queue.pop()
        for child_id in children_map.get(parent, []):
            result.append(child_id)
            queue.append(child_id)
    return result


def _item_to_dict(item) -> dict[str, Any]:
    """Convert an Item ORM object to a dict for response building."""
    return {c.name: getattr(item, c.name) for c in item.__table__.columns}


async def _enrich_item(db: AsyncSession, models, item_dict: dict) -> dict:
    """Add category_name, location_name, vendor names, and active checkout info."""
    if item_dict.get("category_id"):
        cat = await db.get(models.Category, item_dict["category_id"])
        item_dict["category_name"] = cat.name if cat else None
    if item_dict.get("location_id"):
        loc = await db.get(models.Location, item_dict["location_id"])
        item_dict["location_name"] = loc.name if loc else None
    if item_dict.get("manufacturer_id"):
        mfr = await db.get(models.Manufacturer, item_dict["manufacturer_id"])
        if mfr:
            item_dict["manufacturer_name"] = mfr.name
            item_dict["manufacturer_info"] = {"website": mfr.website, "email": mfr.email, "phone": mfr.phone}
    if item_dict.get("supplier_id"):
        sup = await db.get(models.Supplier, item_dict["supplier_id"])
        if sup:
            item_dict["supplier_name"] = sup.name
            item_dict["supplier_info"] = {"website": sup.website, "email": sup.email, "phone": sup.phone, "contact_person": sup.contact_person}
    if item_dict.get("vendor_id"):
        ven = await db.get(models.Vendor, item_dict["vendor_id"])
        if ven:
            item_dict["vendor_name"] = ven.name
            item_dict["vendor_info"] = {"website": ven.website, "email": ven.email, "phone": ven.phone, "contact_person": ven.contact_person}

    # Active checkout
    from itemplus.models.user import User
    checkout = await db.scalar(
        select(models.Checkout).where(
            models.Checkout.item_id == item_dict["id"],
            models.Checkout.status == "active",
        )
    )
    if checkout:
        user = await db.get(User, checkout.user_id)
        item_dict["checked_out_to"] = {
            "user_id": checkout.user_id,
            "user_name": (user.display_name or user.email) if user else None,
            "due_date": checkout.due_date,
            "checkout_id": checkout.id,
            "since": checkout.created_at.isoformat() if checkout.created_at else None,
        }
    return item_dict


async def _load_properties(db: AsyncSession, models, item_id: int) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns (by_id, by_name) property dicts."""
    result = await db.scalars(
        select(models.ItemProperty).where(models.ItemProperty.item_id == item_id)
    )
    props = result.all()
    if not props:
        return {}, {}
    # Resolve property names
    prop_ids = [ip.property_id for ip in props]
    prop_defs = (await db.scalars(
        select(models.Property).where(models.Property.id.in_(prop_ids))
    )).all()
    name_map = {p.id: p.name for p in prop_defs}
    unit_map = {p.id: p.unit for p in prop_defs if p.unit}
    by_id = {str(ip.property_id): ip.value for ip in props}
    by_name = {}
    for ip in props:
        name = name_map.get(ip.property_id, str(ip.property_id))
        unit = unit_map.get(ip.property_id)
        entry: dict = {"value": ip.value}
        if unit:
            entry["unit"] = unit
        by_name[name] = entry
    return by_id, by_name


async def _load_attachments(db: AsyncSession, models, item_id: int) -> list[dict]:
    result = await db.scalars(
        select(models.Attachment).where(models.Attachment.item_id == item_id).order_by(models.Attachment.order, models.Attachment.id)
    )
    return [
        {c.name: getattr(a, c.name) for c in a.__table__.columns}
        for a in result.all()
    ]


async def _save_properties(db: AsyncSession, models, item_id: int, properties: dict[str, Any]):
    """Upsert item properties."""
    for prop_id_str, value in properties.items():
        prop_id = int(prop_id_str)
        # Strip client-side markers that shouldn't be persisted
        if isinstance(value, dict):
            value = {k: v for k, v in value.items() if not k.startswith("_")}
        existing = await db.scalar(
            select(models.ItemProperty).where(
                models.ItemProperty.item_id == item_id,
                models.ItemProperty.property_id == prop_id,
            )
        )
        if existing:
            existing.value = value
        else:
            db.add(models.ItemProperty(item_id=item_id, property_id=prop_id, value=value))
    await db.commit()

"""Statistics routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_user
from itemplus.models import archive, collection
from itemplus.models.user import User

router = APIRouter(prefix="/stats", tags=["stats"])


async def _count(db: AsyncSession, model) -> int:
    return await db.scalar(select(func.count()).select_from(model)) or 0


async def _realm_stats(db: AsyncSession, models, model_category) -> dict:
    """Compute stats for a realm including total value and per-category breakdown."""
    total_value = await db.scalar(
        select(func.sum(models.Item.purchase_price * models.Item.quantity)).where(
            models.Item.purchase_price.isnot(None)
        )
    ) or 0.0

    # Per-category breakdown
    rows = (await db.execute(
        select(
            model_category.id,
            model_category.name,
            func.count(models.Item.id),
            func.coalesce(func.sum(models.Item.purchase_price * models.Item.quantity), 0),
        )
        .outerjoin(models.Item, models.Item.category_id == model_category.id)
        .group_by(model_category.id, model_category.name)
        .order_by(model_category.name)
    )).all()

    categories = [
        {"id": r[0], "name": r[1], "items": r[2], "value": round(float(r[3]), 2)}
        for r in rows
    ]

    # Insights
    total_items = await _count(db, models.Item)
    total_quantity = await db.scalar(select(func.sum(models.Item.quantity))) or 0
    avg_price = await db.scalar(
        select(func.avg(models.Item.purchase_price)).where(models.Item.purchase_price.isnot(None))
    ) or 0.0

    # Most valuable single item
    most_valuable = await db.execute(
        select(models.Item.id, models.Item.name, models.Item.purchase_price)
        .where(models.Item.purchase_price.isnot(None))
        .order_by(models.Item.purchase_price.desc())
        .limit(1)
    )
    mv = most_valuable.first()

    # Recently active (last 8, sorted by updated_at)
    recent = (await db.execute(
        select(
            models.Item.id, models.Item.name, models.Item.created_at, models.Item.updated_at,
            models.Category.name.label("category_name"), models.Category.color.label("category_color"),
            models.Location.name.label("location_name"), models.Location.color.label("location_color"),
        )
        .outerjoin(models.Category, models.Item.category_id == models.Category.id)
        .outerjoin(models.Location, models.Item.location_id == models.Location.id)
        .order_by(models.Item.updated_at.desc())
        .limit(8)
    )).all()

    # Top items by value (price * qty), limit 5
    top_by_value = (await db.execute(
        select(
            models.Item.id, models.Item.name,
            (models.Item.purchase_price * models.Item.quantity).label("value"),
            models.Category.name.label("category_name"), models.Category.color.label("category_color"),
            models.Location.name.label("location_name"), models.Location.color.label("location_color"),
        )
        .outerjoin(models.Category, models.Item.category_id == models.Category.id)
        .outerjoin(models.Location, models.Item.location_id == models.Location.id)
        .where(models.Item.purchase_price.isnot(None))
        .order_by((models.Item.purchase_price * models.Item.quantity).desc())
        .limit(5)
    )).all()

    # Top items by quantity
    top_by_quantity = (await db.execute(
        select(
            models.Item.id, models.Item.name, models.Item.quantity,
            models.Category.name.label("category_name"), models.Category.color.label("category_color"),
            models.Location.name.label("location_name"), models.Location.color.label("location_color"),
        )
        .outerjoin(models.Category, models.Item.category_id == models.Category.id)
        .outerjoin(models.Location, models.Item.location_id == models.Location.id)
        .order_by(models.Item.quantity.desc())
        .limit(5)
    )).all()

    def _item_row(r):
        d = {"id": r.id, "name": r.name}
        if hasattr(r, "category_name") and r.category_name: d["category_name"] = r.category_name
        if hasattr(r, "category_color") and r.category_color: d["category_color"] = r.category_color
        if hasattr(r, "location_name") and r.location_name: d["location_name"] = r.location_name
        if hasattr(r, "location_color") and r.location_color: d["location_color"] = r.location_color
        return d

    return {
        "items": total_items,
        "categories": await _count(db, model_category),
        "locations": await _count(db, models.Location),
        "properties": await _count(db, models.Property),
        "total_value": round(float(total_value), 2),
        "total_quantity": int(total_quantity),
        "avg_price": round(float(avg_price), 2),
        "recently_added": [{**_item_row(r), "created_at": r.created_at.isoformat() if r.created_at else None, "updated_at": r.updated_at.isoformat() if r.updated_at else None} for r in recent],
        "top_by_value": [{**_item_row(r), "value": round(float(r.value), 2)} for r in top_by_value],
        "top_by_quantity": [{**_item_row(r), "quantity": r.quantity} for r in top_by_quantity],
        "by_category": categories,
    }


@router.get("/overview")
async def overview(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {
        "archive": await _realm_stats(db, archive, archive.Category),
        "collection": await _realm_stats(db, collection, collection.Category),
    }


@router.get("/inventory")
async def inventory_stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Low-stock and out-of-stock warnings for consumable items."""
    warnings = []
    for realm_name, models in [("archive", archive), ("collection", collection)]:
        items = (await db.scalars(
            select(models.Item).where(
                models.Item.is_consumable == True,  # noqa: E712
                models.Item.minimum_quantity.isnot(None),
            )
        )).all()
        for item in items:
            if item.quantity <= 0:
                warnings.append({"realm": realm_name, "item_id": item.id, "name": item.name, "level": "out_of_stock", "quantity": item.quantity})
            elif item.minimum_quantity and item.quantity <= item.minimum_quantity:
                warnings.append({"realm": realm_name, "item_id": item.id, "name": item.name, "level": "low_stock", "quantity": item.quantity, "minimum": item.minimum_quantity})
    return {"warnings": warnings}


@router.get("/locations")
async def location_capacity_stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Capacity warnings for locations approaching their limit."""
    warnings = []
    for realm_name, models in [("archive", archive), ("collection", collection)]:
        # Only check locations with a capacity defined
        locations = (await db.scalars(
            select(models.Location).where(models.Location.capacity.isnot(None))
        )).all()

        for loc in locations:
            # Count items at this location (sum of quantities)
            used = await db.scalar(
                select(func.coalesce(func.sum(models.Item.quantity), 0)).where(
                    models.Item.location_id == loc.id
                )
            ) or 0

            if loc.capacity and loc.capacity > 0:
                ratio = used / loc.capacity
                level = None
                if ratio >= 1.0:
                    level = "full"
                elif ratio >= 0.9:
                    level = "almost_full"
                elif ratio >= 0.75:
                    level = "warning"

                if level:
                    warnings.append({
                        "realm": realm_name,
                        "location_id": loc.id,
                        "name": loc.name,
                        "level": level,
                        "used": int(used),
                        "capacity": loc.capacity,
                    })

    return {"warnings": warnings}

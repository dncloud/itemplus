"""Checkout and checkout request routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from itemplus.core.database import get_db
from itemplus.core.dependencies import get_current_admin, get_current_user, require_permission
from itemplus.core.websocket import ws_manager
from itemplus.models import CheckoutRequest, RequestStatus, archive, collection
from itemplus.models.user import User
from itemplus.schemas.checkout import (
    CheckinRequest,
    CheckoutCreate,
    CheckoutRequestCreate,
    CheckoutRequestResponse,
    CheckoutResponse,
)

router = APIRouter(tags=["checkout"])

_realms = {"archive": archive, "collection": collection}


def _get_models(realm: str):
    models = _realms.get(realm)
    if not models:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid realm: {realm}")
    return models


@router.post("/checkout/{realm}/{item_id}", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def checkout_item(
    realm: str,
    item_id: int,
    body: CheckoutCreate,
    user: User = Depends(require_permission("checkout.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Check out an item to a user. Requires checkout.manage permission."""
    models = _get_models(realm)
    item = await db.get(models.Item, item_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")

    # Check not already checked out
    active = await db.scalar(
        select(models.Checkout).where(
            models.Checkout.item_id == item_id,
            models.Checkout.status == "active",
        )
    )
    if active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Item already checked out")

    checkout = models.Checkout(
        item_id=item_id,
        user_id=body.user_id or user.id,
        due_date=body.due_date,
        notes=body.notes,
    )
    db.add(checkout)
    await db.commit()
    await db.refresh(checkout)
    logger.info("[AUDIT] user=%d action=checkout.create realm=%s item=%d", user.id, realm, item_id)
    await ws_manager.broadcast(f"stats.{realm}_updated")
    return await _enrich_checkout(db, checkout, realm)


@router.post("/checkin/{realm}/{item_id}", status_code=status.HTTP_200_OK)
async def checkin_item(
    realm: str,
    item_id: int,
    body: CheckinRequest = CheckinRequest(),
    user: User = Depends(require_permission("checkout.manage")),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: return a checked-out item."""
    models = _get_models(realm)
    checkout = await db.scalar(
        select(models.Checkout).where(
            models.Checkout.item_id == item_id,
            models.Checkout.status == "active",
        )
    )
    if not checkout:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active checkout found")

    from datetime import UTC, datetime
    checkout.status = "returned"
    checkout.returned_at = datetime.now(UTC).isoformat()
    if body.notes:
        checkout.notes = body.notes

    # Mark the corresponding checkout request as completed
    related_request = await db.scalar(
        select(CheckoutRequest).where(
            CheckoutRequest.realm == realm,
            CheckoutRequest.item_id == item_id,
            CheckoutRequest.status == RequestStatus.APPROVED,
        )
    )
    if related_request:
        related_request.status = RequestStatus.COMPLETED

    await db.commit()
    logger.info("[AUDIT] user=%d action=checkout.return realm=%s item=%d", user.id, realm, item_id)
    await ws_manager.broadcast(f"stats.{realm}_updated")
    return {"status": "returned", "item_id": item_id}


class CheckoutUpdate(BaseModel):
    due_date: str | None = None
    created_at: str | None = None  # For testing — backdate the checkout


@router.put("/checkout/{realm}/{checkout_id}")
async def update_checkout(
    realm: str,
    checkout_id: int,
    body: CheckoutUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: edit checkout dates (for testing overdue etc.)."""
    from datetime import datetime
    models = _get_models(realm)
    checkout = await db.get(models.Checkout, checkout_id)
    if not checkout:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checkout not found")

    if body.due_date is not None:
        checkout.due_date = body.due_date
    if body.created_at is not None:
        try:
            checkout.created_at = datetime.fromisoformat(body.created_at)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid date format")

    await db.commit()
    await db.refresh(checkout)
    return await _enrich_checkout(db, checkout, realm)


@router.get("/checkouts/{realm}/active")
async def list_active_checkouts(
    realm: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all currently checked-out items for a realm."""
    models = _get_models(realm)
    checkouts = (await db.scalars(
        select(models.Checkout)
        .where(models.Checkout.status == "active")
        .order_by(models.Checkout.created_at.desc())
    )).all()
    return [await _enrich_checkout(db, c, realm) for c in checkouts]


@router.get("/checkouts/{realm}/history")
async def checkout_history(
    realm: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List completed checkouts for a realm (last 50)."""
    models = _get_models(realm)
    checkouts = (await db.scalars(
        select(models.Checkout)
        .where(models.Checkout.status == "returned")
        .order_by(models.Checkout.updated_at.desc())
        .limit(50)
    )).all()
    return [await _enrich_checkout(db, c, realm) for c in checkouts]


@router.get("/checkouts/my/overdue")
async def my_overdue_checkouts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get overdue items for the current user across all realms."""
    from datetime import UTC, datetime
    now = datetime.now(UTC).isoformat()
    results = []
    for realm_name, models in _realms.items():
        checkouts = (await db.scalars(
            select(models.Checkout).where(
                models.Checkout.user_id == user.id,
                models.Checkout.status == "active",
                models.Checkout.due_date.isnot(None),
                models.Checkout.due_date < now,
            )
        )).all()
        for c in checkouts:
            results.append(await _enrich_checkout(db, c, realm_name))
    return results


# -- Checkout Requests --

async def _enrich_checkout(db: AsyncSession, checkout, realm: str) -> dict:
    """Add item_name, user_name, duration info, and overdue status."""
    from datetime import UTC, datetime

    data = {c.name: getattr(checkout, c.name) for c in checkout.__table__.columns}
    data["realm"] = realm
    models = _realms.get(realm)
    if models:
        item = await db.get(models.Item, checkout.item_id)
        data["item_name"] = item.name if item else None
    user = await db.get(User, checkout.user_id)
    data["user_name"] = user.display_name or user.email if user else None

    # Duration and overdue calculation
    now = datetime.now(UTC)
    start = checkout.created_at
    # Ensure start is timezone-aware
    if start and start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    end_str = checkout.returned_at
    due_str = checkout.due_date

    if start:
        end = datetime.fromisoformat(end_str).replace(tzinfo=UTC) if end_str else now
        duration_days = (end - start).total_seconds() / 86400
        data["duration_days"] = round(duration_days, 1)

    if due_str:
        try:
            due = datetime.fromisoformat(due_str).replace(tzinfo=UTC)
            if checkout.status == "active":
                data["is_overdue"] = now > due
                data["overdue_days"] = max(0, round((now - due).total_seconds() / 86400, 1))
            elif end_str:
                returned = datetime.fromisoformat(end_str).replace(tzinfo=UTC)
                data["was_overdue"] = returned > due
                data["overdue_days"] = max(0, round((returned - due).total_seconds() / 86400, 1))
        except (ValueError, TypeError):
            pass

    return data


async def _enrich_request(db: AsyncSession, req: CheckoutRequest) -> dict:
    """Add item_name and user_name to a checkout request."""
    data = {c.name: getattr(req, c.name) for c in req.__table__.columns}

    # Resolve item name
    models = _realms.get(req.realm)
    if models:
        item = await db.get(models.Item, req.item_id)
        data["item_name"] = item.name if item else None

    # Resolve user name
    user = await db.get(User, req.user_id)
    data["user_name"] = user.display_name or user.email if user else None

    # Resolve approver name
    if req.approved_by:
        approver = await db.get(User, req.approved_by)
        data["approved_by_name"] = approver.display_name or approver.email if approver else None

    return data


@router.post("/checkout/request", status_code=status.HTTP_201_CREATED)
async def create_request(
    body: CheckoutRequestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if item already has a pending request
    existing = await db.scalar(
        select(CheckoutRequest).where(
            CheckoutRequest.realm == body.realm,
            CheckoutRequest.item_id == body.item_id,
            CheckoutRequest.status == RequestStatus.PENDING,
        )
    )

    # Get item to check quantity
    models = _get_models(body.realm)
    item = await db.get(models.Item, body.item_id)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")

    # Count active checkouts + pending requests
    active_checkouts = await db.scalar(
        select(func.count()).select_from(models.Checkout).where(
            models.Checkout.item_id == body.item_id,
            models.Checkout.status == "active",
        )
    ) or 0

    pending_count_result = await db.scalars(
        select(CheckoutRequest).where(
            CheckoutRequest.realm == body.realm,
            CheckoutRequest.item_id == body.item_id,
            CheckoutRequest.status == RequestStatus.PENDING,
        )
    )
    pending_count = len(list(pending_count_result.all()))

    # Block if active + pending >= available quantity
    if (active_checkouts + pending_count) >= item.quantity:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Alle {item.quantity} Exemplare sind bereits ausgeliehen oder angefragt",
        )

    req = CheckoutRequest(
        realm=body.realm,
        item_id=body.item_id,
        user_id=user.id,
        requested_duration_days=body.requested_duration_days,
        notes=body.notes,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    await ws_manager.send_to_admins("admin.checkout_requested", {"request_id": req.id})
    return await _enrich_request(db, req)


@router.get("/checkout/requests")
async def list_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(CheckoutRequest).order_by(CheckoutRequest.created_at.desc())
    if not user.is_admin:
        q = q.where(CheckoutRequest.user_id == user.id)
    requests = (await db.scalars(q)).all()
    return [await _enrich_request(db, r) for r in requests]


@router.put("/checkout/requests/{req_id}/approve")
async def approve_request(
    req_id: int,
    user: User = Depends(require_permission("checkout.manage")),
    db: AsyncSession = Depends(get_db),
):
    from datetime import UTC, datetime, timedelta

    req = await db.get(CheckoutRequest, req_id)
    if not req or req.status != RequestStatus.PENDING:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found or not pending")

    # Check item not already checked out
    models = _get_models(req.realm)
    active_checkout = await db.scalar(
        select(models.Checkout).where(
            models.Checkout.item_id == req.item_id,
            models.Checkout.status == "active",
        )
    )
    if active_checkout:
        raise HTTPException(status.HTTP_409_CONFLICT, "Item ist bereits ausgeliehen")

    # Create actual checkout
    due_date = None
    if req.requested_duration_days:
        due_date = (datetime.now(UTC) + timedelta(days=req.requested_duration_days)).isoformat()

    checkout = models.Checkout(
        item_id=req.item_id,
        user_id=req.user_id,
        due_date=due_date,
        notes=req.notes,
    )
    db.add(checkout)

    req.status = RequestStatus.APPROVED
    req.approved_by = user.id
    await db.commit()
    await db.refresh(req)
    logger.info("[AUDIT] user=%d action=checkout.approve request=%d", user.id, req_id)
    await ws_manager.send_to_user(req.user_id, "checkout.approved", {"request_id": req.id})
    await ws_manager.broadcast(f"stats.{req.realm}_updated")
    return await _enrich_request(db, req)


@router.put("/checkout/requests/{req_id}/reject")
async def reject_request(
    req_id: int,
    user: User = Depends(require_permission("checkout.manage")),
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(CheckoutRequest, req_id)
    if not req or req.status != RequestStatus.PENDING:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found or not pending")
    req.status = RequestStatus.REJECTED
    req.approved_by = user.id
    await db.commit()
    await db.refresh(req)
    logger.info("[AUDIT] user=%d action=checkout.reject request=%d", user.id, req_id)
    await ws_manager.send_to_user(req.user_id, "checkout.rejected", {"request_id": req.id})
    return await _enrich_request(db, req)

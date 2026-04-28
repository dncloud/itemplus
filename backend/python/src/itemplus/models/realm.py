"""Realm model factory — generates Archive and Collection models from a single definition.

Instead of duplicating ~10 model classes for each realm, we define the schema once
and call create_realm_models("archive") / create_realm_models("collection").
"""

from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from itemplus.core.database import Base
from itemplus.models.base import TimestampMixin


class PropertyType(StrEnum):
    TEXT = "text"
    TEXTBLOCK = "textblock"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATE = "date"
    SELECT = "select"
    MULTISELECT = "multiselect"
    RATING = "rating"
    DIMENSIONS = "dimensions"
    AGE_RATING = "age_rating"
    CONDITION = "condition"
    PRIORITY = "priority"
    WEIGHT = "weight"


class AttachmentType(StrEnum):
    IMAGE = "image"
    DOCUMENT = "document"
    LINK = "link"


class CheckoutStatus(StrEnum):
    ACTIVE = "active"
    RETURNED = "returned"


class RequestStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    COMPLETED = "completed"


def _model(cls_name: str, *bases, **attrs: Any):
    """Create a SQLAlchemy model class with a unique name to avoid registry collisions."""
    attrs["__qualname__"] = cls_name
    return type(cls_name, bases, {"__annotations__": attrs.pop("__annotations__", {}), **attrs})


def create_realm_models(realm: str):
    """Create all SQLAlchemy models for a given realm (archive / collection)."""
    p = realm  # prefix for table names
    R = realm.title()  # prefix for class names

    # -- Category --
    Category = _model(
        f"{R}Category", TimestampMixin, Base,
        __tablename__=f"{p}_categories",
        __annotations__={
            "id": Mapped[int],
            "name": Mapped[str],
            "description": Mapped[str | None],
            "color": Mapped[str | None],
            "position": Mapped[int],
        },
        id=mapped_column(primary_key=True),
        name=mapped_column(String(255)),
        description=mapped_column(Text, default=None),
        color=mapped_column(String(7), default=None),
        position=mapped_column(Integer, default=0),
    )

    # -- Property --
    Property = _model(
        f"{R}Property", TimestampMixin, Base,
        __tablename__=f"{p}_properties",
        __annotations__={
            "id": Mapped[int],
            "category_id": Mapped[int],
            "name": Mapped[str],
            "property_type": Mapped[str],
            "unit": Mapped[str | None],
            "options": Mapped[dict | None],
            "required": Mapped[bool],
            "show_in_list": Mapped[bool],
            "display_width": Mapped[str],
            "position": Mapped[int],
        },
        id=mapped_column(primary_key=True),
        category_id=mapped_column(ForeignKey(f"{p}_categories.id", ondelete="CASCADE"), index=True),
        name=mapped_column(String(255)),
        property_type=mapped_column(String(50)),
        unit=mapped_column(String(50), default=None),
        options=mapped_column(JSON, default=None),
        required=mapped_column(Boolean, default=False),
        show_in_list=mapped_column(Boolean, default=False),
        display_width=mapped_column(String(10), default="third"),  # third, half, full
        position=mapped_column(Integer, default=0),
    )

    # -- Location --
    Location = _model(
        f"{R}Location", TimestampMixin, Base,
        __tablename__=f"{p}_locations",
        __annotations__={
            "id": Mapped[int],
            "name": Mapped[str],
            "description": Mapped[str | None],
            "color": Mapped[str | None],
            "parent_id": Mapped[int | None],
            "manager_id": Mapped[int | None],
            "image": Mapped[str | None],
            "capacity": Mapped[int | None],
            "position": Mapped[int],
        },
        id=mapped_column(primary_key=True),
        name=mapped_column(String(255)),
        description=mapped_column(Text, default=None),
        color=mapped_column(String(7), default=None),
        parent_id=mapped_column(ForeignKey(f"{p}_locations.id", ondelete="SET NULL"), index=True, default=None),
        manager_id=mapped_column(Integer, index=True, default=None),
        image=mapped_column(Text, default=None),
        capacity=mapped_column(Integer, default=None),
        position=mapped_column(Integer, default=0),
    )

    # -- Item --
    Item = _model(
        f"{R}Item", TimestampMixin, Base,
        __tablename__=f"{p}_items",
        __annotations__={
            "id": Mapped[int],
            "name": Mapped[str],
            "description": Mapped[str | None],
            "category_id": Mapped[int | None],
            "location_id": Mapped[int | None],
            "quantity": Mapped[int],
            "is_consumable": Mapped[bool],
            "minimum_quantity": Mapped[int | None],
            "manufacturer_id": Mapped[int | None],
            "supplier_id": Mapped[int | None],
            "vendor_id": Mapped[int | None],
            "purchase_date": Mapped[str | None],
            "purchase_price": Mapped[float | None],
            "purchase_currency": Mapped[str | None],
        },
        id=mapped_column(primary_key=True),
        name=mapped_column(String(255), index=True),
        description=mapped_column(Text, default=None),
        category_id=mapped_column(ForeignKey(f"{p}_categories.id", ondelete="SET NULL"), index=True, default=None),
        location_id=mapped_column(ForeignKey(f"{p}_locations.id", ondelete="SET NULL"), index=True, default=None),
        quantity=mapped_column(Integer, default=1),
        is_consumable=mapped_column(Boolean, default=False),
        minimum_quantity=mapped_column(Integer, default=None),
        manufacturer_id=mapped_column(Integer, default=None),
        supplier_id=mapped_column(Integer, default=None),
        vendor_id=mapped_column(Integer, default=None),
        purchase_date=mapped_column(String(10), default=None),
        purchase_price=mapped_column(Float, default=None),
        purchase_currency=mapped_column(String(3), default=None),
    )

    # -- ItemProperty --
    ItemProperty = _model(
        f"{R}ItemProperty", Base,
        __tablename__=f"{p}_item_properties",
        __annotations__={
            "id": Mapped[int],
            "item_id": Mapped[int],
            "property_id": Mapped[int],
            "value": Mapped[Any | None],
        },
        id=mapped_column(primary_key=True),
        item_id=mapped_column(ForeignKey(f"{p}_items.id", ondelete="CASCADE"), index=True),
        property_id=mapped_column(ForeignKey(f"{p}_properties.id", ondelete="CASCADE"), index=True),
        value=mapped_column(JSON, default=None),
    )

    # -- Attachment --
    Attachment = _model(
        f"{R}Attachment", TimestampMixin, Base,
        __tablename__=f"{p}_attachments",
        __annotations__={
            "id": Mapped[int],
            "item_id": Mapped[int],
            "filename": Mapped[str],
            "file_path": Mapped[str],
            "attachment_type": Mapped[str],
            "url": Mapped[str | None],
            "description": Mapped[str | None],
            "gallery": Mapped[bool],
            "order": Mapped[int],
            "size": Mapped[int | None],
        },
        id=mapped_column(primary_key=True),
        item_id=mapped_column(ForeignKey(f"{p}_items.id", ondelete="CASCADE"), index=True),
        filename=mapped_column(String(255)),
        file_path=mapped_column(Text),
        attachment_type=mapped_column(String(50), default=AttachmentType.IMAGE),
        url=mapped_column(Text, default=None),
        description=mapped_column(Text, default=None),
        gallery=mapped_column(Boolean, default=False),
        order=mapped_column(Integer, default=0),
        size=mapped_column(Integer, default=None),
    )

    # -- Checkout --
    Checkout = _model(
        f"{R}Checkout", TimestampMixin, Base,
        __tablename__=f"{p}_checkouts",
        __annotations__={
            "id": Mapped[int],
            "item_id": Mapped[int],
            "user_id": Mapped[int],
            "status": Mapped[str],
            "due_date": Mapped[str | None],
            "returned_at": Mapped[str | None],
            "notes": Mapped[str | None],
        },
        id=mapped_column(primary_key=True),
        item_id=mapped_column(ForeignKey(f"{p}_items.id", ondelete="CASCADE"), index=True),
        user_id=mapped_column(Integer, index=True),
        status=mapped_column(String(20), default=CheckoutStatus.ACTIVE),
        due_date=mapped_column(String(50), default=None),
        returned_at=mapped_column(String(50), default=None),
        notes=mapped_column(Text, default=None),
    )

    # -- Manufacturer --
    Manufacturer = _model(
        f"{R}Manufacturer", TimestampMixin, Base,
        __tablename__=f"{p}_manufacturers",
        __annotations__={
            "id": Mapped[int],
            "name": Mapped[str],
            "logo": Mapped[str | None],
            "website": Mapped[str | None],
            "email": Mapped[str | None],
            "phone": Mapped[str | None],
            "address": Mapped[dict | None],
            "support_email": Mapped[str | None],
            "support_phone": Mapped[str | None],
            "support_url": Mapped[str | None],
        },
        id=mapped_column(primary_key=True),
        name=mapped_column(String(255)),
        logo=mapped_column(Text, default=None),
        website=mapped_column(String(500), default=None),
        email=mapped_column(String(255), default=None),
        phone=mapped_column(String(50), default=None),
        address=mapped_column(JSON, default=None),
        support_email=mapped_column(String(255), default=None),
        support_phone=mapped_column(String(50), default=None),
        support_url=mapped_column(String(500), default=None),
    )

    # -- Supplier --
    Supplier = _model(
        f"{R}Supplier", TimestampMixin, Base,
        __tablename__=f"{p}_suppliers",
        __annotations__={
            "id": Mapped[int],
            "name": Mapped[str],
            "logo": Mapped[str | None],
            "website": Mapped[str | None],
            "email": Mapped[str | None],
            "phone": Mapped[str | None],
            "address": Mapped[dict | None],
            "contact_person": Mapped[str | None],
            "account_manager": Mapped[str | None],
        },
        id=mapped_column(primary_key=True),
        name=mapped_column(String(255)),
        logo=mapped_column(Text, default=None),
        website=mapped_column(String(500), default=None),
        email=mapped_column(String(255), default=None),
        phone=mapped_column(String(50), default=None),
        address=mapped_column(JSON, default=None),
        contact_person=mapped_column(String(255), default=None),
        account_manager=mapped_column(String(255), default=None),
    )

    # -- Vendor --
    Vendor = _model(
        f"{R}Vendor", TimestampMixin, Base,
        __tablename__=f"{p}_vendors",
        __annotations__={
            "id": Mapped[int],
            "name": Mapped[str],
            "logo": Mapped[str | None],
            "website": Mapped[str | None],
            "email": Mapped[str | None],
            "phone": Mapped[str | None],
            "address": Mapped[dict | None],
            "contact_person": Mapped[str | None],
            "customer_number": Mapped[str | None],
        },
        id=mapped_column(primary_key=True),
        name=mapped_column(String(255)),
        logo=mapped_column(Text, default=None),
        website=mapped_column(String(500), default=None),
        email=mapped_column(String(255), default=None),
        phone=mapped_column(String(50), default=None),
        address=mapped_column(JSON, default=None),
        contact_person=mapped_column(String(255), default=None),
        customer_number=mapped_column(String(100), default=None),
    )

    return type("RealmModels", (), {
        "Category": Category,
        "Property": Property,
        "Location": Location,
        "Item": Item,
        "ItemProperty": ItemProperty,
        "Attachment": Attachment,
        "Checkout": Checkout,
        "Manufacturer": Manufacturer,
        "Supplier": Supplier,
        "Vendor": Vendor,
    })


class CheckoutRequest(TimestampMixin, Base):
    """Cross-realm checkout requests (global table)."""
    __tablename__ = "checkout_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    realm: Mapped[str] = mapped_column(String(20))
    item_id: Mapped[int] = mapped_column(index=True)
    user_id: Mapped[int] = mapped_column(index=True)
    status: Mapped[str] = mapped_column(String(20), default=RequestStatus.PENDING)
    requested_duration_days: Mapped[int | None] = mapped_column(Integer)
    approved_by: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)


# Instantiate realm models
archive = create_realm_models("archive")
collection = create_realm_models("collection")

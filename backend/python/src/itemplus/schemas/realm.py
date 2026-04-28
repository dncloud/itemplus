"""Schemas for realm entities (shared by archive and collection)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


# -- Category --

class CategoryCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    position: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    position: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    color: str | None = None
    position: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# -- Property --

class PropertyCreate(BaseModel):
    category_id: int
    name: str
    property_type: str | None = None
    type: str | None = None  # alias — iOS app sends "type"
    unit: str | None = None
    options: dict | None = None
    required: bool = False
    show_in_list: bool = False
    display_width: str = "third"  # third, half, full
    position: int = 0

    def resolved_type(self) -> str:
        return self.property_type or self.type or "text"


class PropertyUpdate(BaseModel):
    name: str | None = None
    property_type: str | None = None
    type: str | None = None
    unit: str | None = None
    options: dict | None = None
    required: bool | None = None
    show_in_list: bool | None = None
    display_width: str | None = None
    position: int | None = None

    def resolved_type(self) -> str | None:
        return self.property_type or self.type


class PropertyResponse(BaseModel):
    id: int
    category_id: int
    name: str
    property_type: str
    unit: str | None = None
    options: dict | None = None
    required: bool = False
    show_in_list: bool = False
    display_width: str = "third"
    position: int = 0
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# -- Location --

class LocationCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    parent_id: int | None = None
    manager_id: int | None = None
    image: str | None = None
    capacity: int | None = None
    position: int = 0


class LocationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    parent_id: int | None = None
    manager_id: int | None = None
    image: str | None = None
    capacity: int | None = None
    position: int | None = None


class LocationResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    color: str | None = None
    parent_id: int | None = None
    manager_id: int | None = None
    image: str | None = None
    capacity: int | None = None
    position: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# -- Item --

class ItemCreate(BaseModel):
    name: str
    description: str | None = None
    category_id: int | None = None
    location_id: int | None = None
    quantity: int = 1
    is_consumable: bool = False
    minimum_quantity: int | None = None
    manufacturer_id: int | None = None
    supplier_id: int | None = None
    vendor_id: int | None = None
    purchase_date: str | None = None
    purchase_price: float | None = None
    purchase_currency: str | None = None
    properties: dict[str, Any] | None = None  # {property_id: value}


class ItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category_id: int | None = None
    location_id: int | None = None
    quantity: int | None = None
    is_consumable: bool | None = None
    minimum_quantity: int | None = None
    manufacturer_id: int | None = None
    supplier_id: int | None = None
    vendor_id: int | None = None
    purchase_date: str | None = None
    purchase_price: float | None = None
    purchase_currency: str | None = None
    properties: dict[str, Any] | None = None


class ItemResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    category_id: int | None = None
    category_name: str | None = None
    location_id: int | None = None
    location_name: str | None = None
    quantity: int = 1
    is_consumable: bool = False
    minimum_quantity: int | None = None
    manufacturer_id: int | None = None
    manufacturer_name: str | None = None
    manufacturer_info: dict[str, Any] | None = None
    supplier_id: int | None = None
    supplier_name: str | None = None
    supplier_info: dict[str, Any] | None = None
    vendor_id: int | None = None
    vendor_name: str | None = None
    vendor_info: dict[str, Any] | None = None
    purchase_date: str | None = None
    purchase_price: float | None = None
    purchase_currency: str | None = None
    properties: dict[str, Any] | None = None
    properties_display: dict[str, Any] | None = None
    checked_out_to: dict[str, Any] | None = None
    attachments: list["AttachmentResponse"] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# -- Attachment --

class AttachmentResponse(BaseModel):
    id: int
    item_id: int
    filename: str
    file_path: str
    attachment_type: str
    url: str | None = None
    description: str | None = None
    gallery: bool = False
    order: int = 0
    size: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# -- Vendor / Manufacturer / Supplier (shared schema) --

class VendorCreate(BaseModel):
    name: str
    logo: str | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    address: dict | None = None
    contact_person: str | None = None
    customer_number: str | None = None
    account_manager: str | None = None
    support_email: str | None = None
    support_phone: str | None = None
    support_url: str | None = None


class VendorUpdate(BaseModel):
    name: str | None = None
    logo: str | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    address: dict | None = None
    contact_person: str | None = None
    customer_number: str | None = None
    account_manager: str | None = None
    support_email: str | None = None
    support_phone: str | None = None
    support_url: str | None = None


class VendorResponse(BaseModel):
    id: int
    name: str
    logo: str | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    address: dict | None = None
    contact_person: str | None = None
    customer_number: str | None = None
    account_manager: str | None = None
    support_email: str | None = None
    support_phone: str | None = None
    support_url: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

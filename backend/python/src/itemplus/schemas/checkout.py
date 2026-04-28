from datetime import datetime

from pydantic import BaseModel


class CheckoutCreate(BaseModel):
    user_id: int | None = None  # Admin can checkout for another user
    notes: str | None = None
    due_date: str | None = None


class CheckinRequest(BaseModel):
    notes: str | None = None


class CheckoutResponse(BaseModel):
    id: int
    item_id: int
    user_id: int
    status: str
    due_date: str | None = None
    notes: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class CheckoutRequestCreate(BaseModel):
    realm: str
    item_id: int
    requested_duration_days: int | None = None
    notes: str | None = None


class CheckoutRequestResponse(BaseModel):
    id: int
    realm: str
    item_id: int
    user_id: int
    status: str
    requested_duration_days: int | None = None
    approved_by: int | None = None
    notes: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

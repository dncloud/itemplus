from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: int
    sub: str | None = None  # apple_sub — iOS app expects "sub"
    email: str | None = None
    name: str | None = None  # display_name — iOS app expects "name"
    is_admin: bool = False
    is_active: bool = False
    permissions: list[str] = []
    last_login: datetime | None = None
    last_ip: str | None = None
    last_device: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        return cls(
            id=user.id,
            sub=user.apple_sub,
            email=user.email,
            name=user.display_name,
            is_admin=user.is_admin,
            is_active=user.is_active,
            permissions=user.permissions or [],
            last_login=user.last_login,
            created_at=user.created_at,
        )


class UserUpdate(BaseModel):
    display_name: str | None = None
    name: str | None = None  # alias from web client
    email: str | None = None

    def resolved_display_name(self) -> str | None:
        return self.display_name if self.display_name is not None else self.name


class UserAdminUpdate(BaseModel):
    display_name: str | None = None
    name: str | None = None  # alias
    email: str | None = None
    is_admin: bool | None = None
    is_active: bool | None = None
    permissions: list[str] | None = None

    def resolved_display_name(self) -> str | None:
        return self.display_name if self.display_name is not None else self.name

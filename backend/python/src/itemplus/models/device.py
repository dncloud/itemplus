"""Device sessions — tracks connected browsers and iOS devices."""

from datetime import datetime

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from itemplus.core.database import Base
from itemplus.models.base import TimestampMixin


class DeviceSession(TimestampMixin, Base):
    __tablename__ = "device_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(index=True)
    device_type: Mapped[str] = mapped_column(String(20))  # "browser" or "ios"
    device_name: Mapped[str | None] = mapped_column(String(255))  # "Mac Safari", "iPhone 15 Pro"
    ip_address: Mapped[str | None] = mapped_column(String(45))
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen: Mapped[datetime | None] = mapped_column()
    user_agent: Mapped[str | None] = mapped_column(Text)


class QRLoginToken(Base):
    __tablename__ = "qr_login_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column()
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_by_user_id: Mapped[int | None] = mapped_column()


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column()
    used: Mapped[bool] = mapped_column(Boolean, default=False)

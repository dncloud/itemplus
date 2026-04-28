from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from itemplus.core.database import Base
from itemplus.models.base import TimestampMixin


class AppSetting(TimestampMixin, Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, default=None)

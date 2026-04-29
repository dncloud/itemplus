from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from itemplus.core.database import Base
from itemplus.models.base import TimestampMixin


class LabelTemplate(TimestampMixin, Base):
    __tablename__ = "label_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    system_key: Mapped[str | None] = mapped_column(String(255), unique=True, default=None)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    target: Mapped[str] = mapped_column(String(50), default="both")
    dpi: Mapped[int] = mapped_column(Integer, default=600)
    width_mm: Mapped[int] = mapped_column(Integer, default=20)
    height_mm: Mapped[int] = mapped_column(Integer, default=20)
    gap_mm: Mapped[float] = mapped_column(Float, default=3.0)
    speed: Mapped[int] = mapped_column(Integer, default=4)
    density: Mapped[int] = mapped_column(Integer, default=8)
    direction: Mapped[int] = mapped_column(Integer, default=1)
    reference_x: Mapped[int] = mapped_column(Integer, default=0)
    reference_y: Mapped[int] = mapped_column(Integer, default=0)
    shift_x: Mapped[int] = mapped_column(Integer, default=0)
    shift_y: Mapped[int] = mapped_column(Integer, default=0)
    copies_default: Mapped[int] = mapped_column(Integer, default=1)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    tspl_template: Mapped[str] = mapped_column(Text)

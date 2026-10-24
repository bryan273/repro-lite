from core.database import Base
from datetime import datetime as PyDateTime
from typing import Optional
from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class Checks(Base):
    __tablename__ = "checks"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    paper_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    verdict: Mapped[str] = mapped_column(String, nullable=False)
    metric: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    dataset: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    target_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    measured_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rerun_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    tolerance_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    flags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    elapsed_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    lang: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now)
    updated_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now, onupdate=PyDateTime.now)
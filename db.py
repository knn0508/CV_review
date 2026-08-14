"""Postgres persistence. Jobs and candidates are stored here so they survive
a backend restart — everything else (ranking cache) stays in-memory since
it's derived, not source data."""

from __future__ import annotations

import datetime
import os

from sqlalchemy import JSON, String
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/cv_screening"
)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class JobRow(Base):
    __tablename__ = "jobs"

    job_id: Mapped[str] = mapped_column(String, primary_key=True)
    field: Mapped[str] = mapped_column(String, index=True)
    spec: Mapped[dict] = mapped_column(JSON)  # JobSpec.model_dump()
    parse_source: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)


class CandidateRow(Base):
    __tablename__ = "candidates"

    file_hash: Mapped[str] = mapped_column(String, primary_key=True)
    filename: Mapped[str] = mapped_column(String)
    field: Mapped[str] = mapped_column(String, index=True)
    profile: Mapped[dict] = mapped_column(JSON)  # CandidateProfile.model_dump()
    extracted: Mapped[dict] = mapped_column(JSON)  # ExtractedDoc fields
    parse_source: Mapped[str] = mapped_column(String)
    classify_source: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime.datetime] = mapped_column(default=datetime.datetime.utcnow)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session

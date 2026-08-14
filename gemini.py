"""Thin Gemini wrapper. Everything returns a validated Pydantic object.

Model choice (as of Aug 2026 — the Flash and Pro lines are on different
version tracks, so read tier and number together):
  FLASH_LITE  gemini-3.5-flash-lite  cheapest; classification, high volume
  FLASH       gemini-3.6-flash       parsing, judging, review — the workhorse
  PRO         gemini-3.1-pro         still the flagship; final re-rank only
"""

from __future__ import annotations

import os
from typing import Type, TypeVar

from google import genai
from pydantic import BaseModel

FLASH_LITE = "gemini-3.5-flash-lite"
FLASH = "gemini-3.6-flash"
PRO = "gemini-3.1-pro-preview"
EMBED = "gemini-embedding-2"

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Create the Gemini client on first use, not while importing the app."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Configure it before using AI-backed endpoints."
            )
        _client = genai.Client(api_key=api_key)
    return _client

T = TypeVar("T", bound=BaseModel)


def _text_of(interaction) -> str:
    if getattr(interaction, "output_text", None):
        return interaction.output_text
    for out in reversed(getattr(interaction, "outputs", [])):
        if getattr(out, "text", None):
            return out.text
    raise RuntimeError("No text in Gemini response")


def structured(prompt: str, schema: Type[T], *, model: str = FLASH,
               system: str | None = None) -> T:
    """One call, one validated object.

    Note: do NOT restate the schema or give example JSON in the prompt —
    it duplicates what the response_format already enforces and measurably
    degrades output quality.
    """
    interaction = _get_client().interactions.create(
        model=model,
        input=prompt if system is None else f"{system}\n\n{prompt}",
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": schema.model_json_schema(),
        },
    )
    return schema.model_validate_json(_text_of(interaction))


def embed(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    resp = _get_client().models.embed_content(model=EMBED, contents=texts)
    return [e.values for e in resp.embeddings]

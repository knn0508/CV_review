"""ASGI entry point used by Uvicorn.

The implementation modules currently live at the repository root. Re-exporting
the FastAPI instance here keeps the documented app.main:app command working
without requiring an installation step or changing the existing module layout.
"""

from main import app

__all__ = ["app"]
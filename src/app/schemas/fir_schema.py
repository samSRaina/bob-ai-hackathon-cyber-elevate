# Pydantic v2 schemas — expanded in Phase 2
from pydantic import BaseModel
from typing import Optional


class HealthResponse(BaseModel):
    status: str
    service: str

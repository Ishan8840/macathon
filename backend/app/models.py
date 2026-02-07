from pydantic import BaseModel, Field
from typing import Optional


class LatLon(BaseModel):
    lat: float
    lon: float


class BuildingOut(BaseModel):
    building_id: str
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    bearing_deg: float = Field(ge=0.0, lt=360.0)
    delta_deg: float = Field(ge=0.0, le=180.0)
    distance_m: float = Field(ge=0.0)
    centroid: LatLon
    estimate: int = Field(ge=0)
    forecast_12m: int = Field(ge=0)
    range_low: int = Field(ge=0)
    range_high: int = Field(ge=0)


class Meta(BaseModel):
    radius_m: int
    cone_deg: int
    heading_deg: float
    timestamp_ms: int


class IdentifyResponse(BaseModel):
    building: Optional[BuildingOut]
    meta: Meta

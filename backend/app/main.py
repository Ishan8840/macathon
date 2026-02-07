from typing import Dict, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import time
from .models import IdentifyResponse, BuildingOut, LatLon, Meta
from .selection import pick_house, get_building_name_free
from .gemini_client import generate_summary


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_RADIUS_M = 150
DEFAULT_CONE_DEG = 60


def fetch_houses_in_radius(lat: float, lon: float, radius_m: int) -> List[Dict]:
    # must return: {house_id, lat, lon}
    return [
        {"house_id": "A", "lat": lat + 0.0003, "lon": lon + 0.0002},
        {"house_id": "B", "lat": lat + 0.0010, "lon": lon + 0.0009},
        {"house_id": "C", "lat": lat - 0.0006, "lon": lon + 0.0001},
    ]



@app.get("/identify", response_model=IdentifyResponse)
def identify(
    lat: float = Query(...),
    lon: float = Query(...),
    heading: float = Query(..., ge=0.0, lt=360.0),
    radius_m: int = Query(DEFAULT_RADIUS_M, ge=10, le=500),
):
    now_ms = int(time.time() * 1000)

    houses = fetch_houses_in_radius(lat, lon, radius_m)

    best = pick_house(
        user_lat=lat,
        user_lon=lon,
        heading_deg=heading,
        houses=houses,
        radius_m=radius_m,
        cone_deg=DEFAULT_CONE_DEG,
    )

    meta = Meta(
        radius_m=radius_m,
        cone_deg=DEFAULT_CONE_DEG,
        heading_deg=heading,
        timestamp_ms=now_ms,
    )

    # If nothing in front / no good match
    if best is None:
        return IdentifyResponse(building=None, meta=meta)

    # Build response in your existing schema
    building = BuildingOut(
        building_id=best["house_id"],          # <-- key change: real picked id
        label="Selected building",
        confidence=best["confidence"],
        bearing_deg=best["bearing_deg"],
        delta_deg=best["delta_deg"],
        distance_m=best["distance_m"],
        centroid=LatLon(lat=best["lat"], lon=best["lon"]),
        estimate=0,            # placeholder until you attach pricing
        forecast_12m=0,        # placeholder
        range_low=0,           # placeholder
        range_high=0,          # placeholder
    )

    return IdentifyResponse(building=building, meta=meta)


@app.get("/building")
def building(lat: float, lon: float):
    try:
        details = get_building_name_free(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Nominatim error: {e}")
    
    predicted = generate_summary(details)

    # 3) return
    return {
        "predicted": predicted,
    }


@app.get("/health")
def health():
    return {"ok": True}
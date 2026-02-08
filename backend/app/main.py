from typing import Dict, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import time
from .models import IdentifyResponse, BuildingOut, LatLon, Meta
from .selection import pick_house, get_building_name_free
from .gemini_client import generate_summary
from .radius import get_buildings_within_radius
from contextlib import asynccontextmanager
import asyncpg
import os

DATABASE_URL = os.environ["SUPABASE_DB_URL"]   

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_RADIUS_M = 150
DEFAULT_CONE_DEG = 60


@app.get("/health")
def health():
    return {"ok": True}

@app.get("/buildings/nearby")
async def buildings_nearby(
    lat: float,
    lng: float,
    heading_deg: float,
    radius_m: float = 100.0,
):
    try:
        buildings = await get_buildings_within_radius(
            user_lat=lat, user_lng=lng, heading_deg=heading_deg, radius_m=radius_m
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"DB/radius error: {e}")

    try:
        house = pick_house(lat, lng, heading_deg, buildings, radius_m)
        details = get_building_name_free(house['lat'], house['lon'])
        predicted = generate_summary(details)
        return predicted
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"pick_house error: {e}")